import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { customerInitials, defaultDescription, formatDocDate, isIsoDate, lagosToday, makeQuoteNumber, nairaInWords, notesToBullets } from "../src/lib/quoteDocument";
import type { QuoteRecord } from "../src/lib/quotes";

describe("quotation number", () => {
  it("uses the customer's initials and the quote date, like W2L-SMA-20260922", () => {
    expect(customerInitials("Superior Minds Academy")).toBe("SMA");
    expect(makeQuoteNumber("Superior Minds Academy", "2026-09-22", [])).toBe("W2L-SMA-20260922");
  });
  it("skips joining words, ignores punctuation, and caps at 4 letters", () => {
    expect(customerInitials("Government Secondary School, Minna")).toBe("GSSM");
    expect(customerInitials("The Federal University of Technology Minna")).toBe("FUTM");
    expect(customerInitials("St. Mary's College")).toBe("SMSC");
    expect(customerInitials("of the")).toBe("OT");
    expect(customerInitials("!!!")).toBe("CUS");
  });
  it("adds -2, -3 when the same number is already taken that day", () => {
    expect(makeQuoteNumber("Superior Minds Academy", "2026-09-22", ["W2L-SMA-20260922"])).toBe("W2L-SMA-20260922-2");
    expect(makeQuoteNumber("Superior Minds Academy", "2026-09-22", ["W2L-SMA-20260922", "W2L-SMA-20260922-2"])).toBe("W2L-SMA-20260922-3");
  });
});

describe("amount in words", () => {
  it("matches the paper quotation", () => {
    expect(nairaInWords(300000)).toBe("Three Hundred Thousand Naira Only");
  });
  it("handles tens, hundreds, thousands and millions", () => {
    expect(nairaInWords(0)).toBe("Zero Naira Only");
    expect(nairaInWords(15)).toBe("Fifteen Naira Only");
    expect(nairaInWords(98120)).toBe("Ninety-Eight Thousand One Hundred and Twenty Naira Only");
    expect(nairaInWords(1000001)).toBe("One Million One Naira Only");
    expect(nairaInWords(2_450_300_017)).toBe("Two Billion Four Hundred and Fifty Million Three Hundred Thousand Seventeen Naira Only");
  });
  it("rejects negative amounts", () => {
    expect(() => nairaInWords(-1)).toThrow();
  });
});

describe("notes, dates and descriptions", () => {
  it("turns each non-empty line into one bullet", () => {
    expect(notesToBullets("First point\r\n\n- Second point\n• Third\n   ")).toEqual(["First point", "Second point", "Third"]);
  });
  it("prints dates the way the paper quotation does", () => {
    expect(formatDocDate("2026-09-22")).toBe("22 September 2026");
    expect(formatDocDate("2026-10-06")).toBe("06 October 2026");
  });
  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("06/10/2026")).toBe(false);
  });
  it("takes today's date in Lagos, which is ahead of UTC late at night", () => {
    expect(lagosToday(new Date("2026-09-21T23:30:00Z"))).toBe("2026-09-22");
  });
  it("describes a bundle with its contents", () => {
    expect(defaultDescription("STEM Kit", [{ name: "Arduino Uno", quantity: 1 }, { name: "Buzzer", quantity: 2 }])).toBe("STEM Kit — Includes: Arduino Uno, Buzzer x2");
    expect(defaultDescription("Relay", null)).toBe("Relay");
  });
});

describe("quotation PDF", () => {
  const sample: QuoteRecord = {
    id: 1, name: "Superior Minds Academy", attn: "The School Administrator",
    notes: "These 5 Master Kits are supplied for the Green Energy Corner STEM lab at Superior Minds Academy, for facilitator-led demonstrations and lab maintenance under the partnership agreement.\nPayment is requested to disburse this order for supply; kits will be delivered and set up within 2 working days of payment confirmation.\nThis quotation is valid for 14 days from the date above.",
    quoteNumber: "W2L-SMA-20260922", quoteDate: "2026-09-22", validUntil: "2026-10-06", createdAt: "", updatedAt: "", total: 300000,
    lines: [{
      id: 1, position: 0, componentId: null, bundleId: 1, name: "Green Energy Corner STEM Master Kit",
      description: "Green Energy Corner STEM Master Kit — lab-grade kit for classroom demonstration & facilitator use. Includes: Arduino Uno, Solar Cell, Breadboard, Ultrasonic Sensor, Servo Motor, Buzzer x2, LED, Push Button Switch, Jumper Wires, curriculum flash drive, horizontal-axis wind turbine (demonstration unit), gloves, soldering iron, pliers; branded box",
      quantity: 5, supplierUsed: null, supplierPrice: null, markupPct: null, unitPrice: 60000, priceOverride: true, lineTotal: 300000, detail: null, warnings: [],
    }],
  };

  it("renders the paper example as a one-page A4 PDF", async () => {
    const { renderQuotationPdf } = await import("../src/lib/quotePdf");
    const pdf = await renderQuotationPdf(sample);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = pdf.toString("latin1");
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    expect(text).toMatch(/\/MediaBox \[0 0 595\.2\d* 841\.8\d*\]/); // A4 in points
    if (process.env.QUOTE_PDF_OUT) writeFileSync(process.env.QUOTE_PDF_OUT, pdf);
  }, 60_000);

  it("keeps a long quote structured across pages", async () => {
    const { renderQuotationPdf } = await import("../src/lib/quotePdf");
    const lines = Array.from({ length: 12 }, (_, i) => ({ ...sample.lines[0], id: i + 1, description: `Item ${i + 1}: ${sample.lines[0].description}` }));
    const pdf = await renderQuotationPdf({ ...sample, lines, total: 300000 * 12 });
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    if (process.env.QUOTE_PDF_OUT) writeFileSync(process.env.QUOTE_PDF_OUT.replace(/\.pdf$/, "-long.pdf"), pdf);
  }, 60_000);
});
