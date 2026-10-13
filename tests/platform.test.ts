import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { descriptionSummary, sanitizeDescription } from "../src/lib/sanitize";
import { isEmail, normalizePhone, formatPhone } from "../src/lib/users";
import { toKobo, verifyWebhookSignature } from "../src/lib/paystack";
import { availability, idFromSlug, slugify } from "../src/lib/store/catalog";
import { nextStatus, timelineSteps } from "../src/lib/store/orders";
import { isScraperAgent } from "../src/lib/guard";
import { waNumber } from "../src/lib/messaging";
import { naira } from "../src/components/store/format";
import { pageGroup } from "../src/components/store/PageClass";
import { adminGroup } from "../src/components/admin/AdminChrome";

describe("sanitizeDescription", () => {
  it("keeps plain formatting and drops scripts, links, images and attributes", () => {
    const out = sanitizeDescription('<div style="x"><h2 onclick="evil()">Specs</h2><p>Runs on <b>5V</b>.<script>alert(1)</script></p><img src="x.jpg"><a href="https://x.com">read</a></div>');
    expect(out).toBe("<h3>Specs</h3><p>Runs on <strong>5V</strong>.</p>read");
  });

  it("never shows the supplier's name or stock codes", () => {
    const out = sanitizeDescription("<ul><li>1 × Cell <small>(MSC-2782)</small></li><li>See microscale.net for more</li></ul><p>Made for MicroScale builds and MDL-2315 kits.</p>");
    expect(out).not.toMatch(/micro\s*scale/i);
    expect(out).not.toMatch(/MSC-2782|MDL-2315/);
    expect(out).toContain("<li>1 × Cell</li>");
  });

  it("escapes text so it can never become markup", () => {
    expect(sanitizeDescription("<p>a &lt;b&gt; c</p>")).toBe("<p>a &lt;b&gt; c</p>");
  });

  it("is empty for empty input and summarises the first paragraph", () => {
    expect(sanitizeDescription(null)).toBe("");
    expect(descriptionSummary("<p>First line here.</p><p>Second.</p>")).toBe("First line here.");
  });

  it("cleans every real Microscale description without leaving the supplier's name", () => {
    const json = JSON.parse(readFileSync(join(__dirname, "fixtures", "real", "microscale-page1.json"), "utf8"));
    for (const p of json.products) {
      const out = sanitizeDescription(p.body_html);
      expect(out).not.toMatch(/micro\s*scale|<script|<a |<img|on\w+=|style=/i);
    }
  });
});

describe("Nigerian phone numbers", () => {
  it.each([
    ["0802 555 0148", "+2348025550148"],
    ["802 555 0148", "+2348025550148"],
    ["+234 802 555 0148", "+2348025550148"],
    ["2348025550148", "+2348025550148"],
    ["(0802)-555-0148", "+2348025550148"],
  ])("%s -> %s", (raw, want) => expect(normalizePhone(raw)).toBe(want));

  it.each(["802 555 01", "12345", "", "0802 555 01489"])("rejects %s", (raw) => expect(normalizePhone(raw)).toBeNull());

  it("formats for people and for WhatsApp", () => {
    expect(formatPhone("+2348025550148")).toBe("+234 802 555 0148");
    expect(waNumber("+234 807 878 7646")).toBe("2348078787646");
    expect(waNumber("0807 878 7646")).toBe("2348078787646");
  });

  it("checks emails", () => {
    expect(isEmail("aisha@example.com")).toBe(true);
    expect(isEmail("aisha@example")).toBe(false);
    expect(isEmail("a b@example.com")).toBe(false);
  });
});

describe("Paystack", () => {
  const secret = "sk_test_abc123";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "W2L-ORD-1001-abc" } });
  const sig = createHmac("sha512", secret).update(body).digest("hex");

  it("accepts only bodies signed with our secret key", () => {
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "sk_test_other")).toBe(false);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, sig, "")).toBe(false);
  });

  it("sends amounts in kobo", () => {
    expect(toKobo(37800)).toBe(3780000);
    expect(toKobo(14500.5)).toBe(1450050);
  });
});

describe("store rules", () => {
  it("availability: our own stock covers a supplier stock-out", () => {
    expect(availability(true, 0)).toBe("in");
    expect(availability(null, 0)).toBe("in");
    expect(availability(false, 0)).toBe("out");
    expect(availability(false, 2)).toBe("low");
    expect(availability(false, 10)).toBe("in");
  });

  it("product addresses", () => {
    expect(slugify("Arduino Uno R3 (Compatible) — with USB")).toBe("arduino-uno-r3-compatible-with-usb");
    expect(idFromSlug("123-arduino-uno")).toBe(123);
    expect(idFromSlug("123")).toBe(123);
    expect(idFromSlug("arduino-123")).toBeNull();
  });

  it("order status steps differ for delivery and pickup", () => {
    expect(timelineSteps("delivery")).toEqual(["paid", "confirmed", "sourcing", "ready", "out_for_delivery", "completed"]);
    expect(timelineSteps("pickup")).toContain("ready_for_pickup");
    expect(nextStatus("paid", "delivery")).toBe("confirmed");
    expect(nextStatus("ready", "pickup")).toBe("ready_for_pickup");
    expect(nextStatus("completed", "delivery")).toBeNull();
    expect(nextStatus("pending_payment", "delivery")).toBeNull();
  });

  it("formats naira", () => {
    expect(naira(37800)).toBe("₦37,800");
    expect(naira(0)).toBe("₦0");
    expect(naira(1234.6)).toBe("₦1,235");
  });
});

describe("scraping guard", () => {
  it("refuses copying tools and missing user agents, allows browsers", () => {
    expect(isScraperAgent("python-requests/2.31")).toBe(true);
    expect(isScraperAgent("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe(true);
    expect(isScraperAgent("curl/8.4.0")).toBe(true);
    expect(isScraperAgent(null)).toBe(true);
    expect(isScraperAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36")).toBe(false);
    expect(isScraperAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36")).toBe(false);
  });
});

describe("page style groups", () => {
  it("maps store and admin paths to their design's page class", () => {
    expect(pageGroup("/")).toBe("home");
    expect(pageGroup("/shop")).toBe("shop");
    expect(pageGroup("/shop/12-arduino")).toBe("product");
    expect(pageGroup("/checkout/success/W2L-ORD-1001")).toBe("success");
    expect(pageGroup("/checkout/failed")).toBe("payfail");
    expect(pageGroup("/quote-request/sent/W2L-REQ-0001")).toBe("quoteok");
    expect(adminGroup("/admin/orders/5")).toBe("ad-order");
    expect(adminGroup("/admin/orders")).toBe("ad-orders");
    expect(adminGroup("/admin/settings")).toBe("ad-dash");
  });
});
