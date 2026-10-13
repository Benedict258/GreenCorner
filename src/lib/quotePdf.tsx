// The customer quotation as an A4 PDF. Same structure as Waste2Light's paper quotation, in the website's colours.
// Fixed parts (letterhead, payment details, signature block) come from COMPANY; the rest from the saved quote.
import { join } from "node:path";
import { Document, Font, G, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { LOGO_PATHS } from "@/components/Logo";
import { formatNaira } from "./pricing";
import { COMPANY, formatDocDate, nairaInWords, notesToBullets } from "./quoteDocument";
import type { QuoteRecord } from "./quotes";

// Inter has the ₦ sign, so it carries every amount. Manrope (the site's display font) is only for headings.
const FONTS = join(process.cwd(), "assets", "fonts");
Font.register({
  family: "Inter",
  fonts: [
    { src: join(FONTS, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: join(FONTS, "Inter-SemiBold.ttf"), fontWeight: 600 },
    { src: join(FONTS, "Inter-Bold.ttf"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Manrope",
  fonts: [
    { src: join(FONTS, "Manrope-Bold.ttf"), fontWeight: 700 },
    { src: join(FONTS, "Manrope-ExtraBold.ttf"), fontWeight: 800 },
  ],
});
// Keep long words (part numbers, URLs) whole instead of hyphenating them.
Font.registerHyphenationCallback((word) => [word]);

// From src/app/tokens.css (waste2light.com).
const C = {
  brand: "#0c5c2e",
  forest: "#0c4a23",
  leaf: "#35a65a",
  text: "#17231c",
  muted: "#66736b",
  border: "#d8dad5",
  soft: "#e7f4eb",
  white: "#ffffff",
};

const COL = { qty: "9%", desc: "51%", unit: "20%", amount: "20%" };

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, fontFamily: "Inter", fontSize: 9.5, color: C.text, lineHeight: 1.4 },

  letterhead: { flexDirection: "row", alignItems: "center", gap: 10 },
  company: { fontFamily: "Manrope", fontWeight: 800, fontSize: 19, lineHeight: 1.2, color: C.forest, letterSpacing: 0.4 },
  tagline: { fontSize: 9, lineHeight: 1.2, color: C.brand, marginTop: 2 },
  ruleThick: { height: 2, backgroundColor: C.brand, marginTop: 12 },
  title: { fontFamily: "Manrope", fontWeight: 800, fontSize: 14, letterSpacing: 2.5, textAlign: "center", color: C.text, marginTop: 14, marginBottom: 6 },
  ruleThin: { height: 1, backgroundColor: C.brand },

  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 18 },
  billLabel: { fontSize: 8.5, fontWeight: 700, color: C.brand, letterSpacing: 1.2, marginBottom: 3 },
  billName: { fontSize: 12, fontWeight: 700 },
  metaRight: { alignItems: "flex-end" },
  metaLine: { fontSize: 9.5, color: C.muted },
  metaStrong: { color: C.text, fontWeight: 700 },

  // Every row draws its own sides and bottom, so a page break never leaves an open, half-drawn table.
  th: { flexDirection: "row", backgroundColor: C.brand, borderWidth: 1, borderColor: C.brand },
  thCell: { color: C.white, fontWeight: 700, fontSize: 9.5, paddingVertical: 7, paddingHorizontal: 8 },
  tr: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  td: { paddingVertical: 7, paddingHorizontal: 8 },
  cellLine: { borderLeftWidth: 1, borderLeftColor: C.border },
  num: { textAlign: "right" },
  center: { textAlign: "center" },
  totalRow: { flexDirection: "row", borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  box: { borderWidth: 1, borderColor: C.border },
  totalLabel: { backgroundColor: C.soft, fontWeight: 700, textAlign: "right" },
  totalValue: { fontWeight: 700, fontSize: 10.5 },

  words: { marginTop: 10, fontSize: 9.5 },
  wordsLabel: { fontWeight: 600, color: C.muted },

  h2: { fontFamily: "Manrope", fontWeight: 700, fontSize: 11.5, color: C.forest, marginBottom: 6 },
  notes: { marginTop: 20 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 14, color: C.brand, fontWeight: 700 },
  bulletText: { flex: 1 },

  payment: { marginTop: 22 },
  payRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border },
  payLabel: { width: "45%", backgroundColor: C.soft, fontWeight: 600, paddingVertical: 7, paddingHorizontal: 8 },
  payValue: { width: "55%", paddingVertical: 7, paddingHorizontal: 8, borderLeftWidth: 1, borderLeftColor: C.border },

  sign: { marginTop: 30 },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.text, width: "60%", marginTop: 40 },
  signCaption: { fontSize: 9, color: C.muted, marginTop: 4 },

  footer: { position: "absolute", bottom: 24, left: 48, fontSize: 8, color: C.muted },
});

function LogoMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1254 1254">
      <G transform="translate(0,1254) scale(0.1,-0.1)" fill={C.brand}>
        {LOGO_PATHS.map((d, i) => <Path key={i} d={d} />)}
      </G>
    </Svg>
  );
}

export function QuotationDocument({ q }: { q: QuoteRecord }) {
  const bullets = notesToBullets(q.notes);
  return (
    <Document title={`Quotation ${q.quoteNumber}`} author="Waste2Light Ltd" subject={`Quotation for ${q.name}`} creator="Green Corner Quote Tool">
      <Page size="A4" style={s.page}>
        {/* Letterhead: fixed */}
        <View style={s.letterhead}>
          <LogoMark size={40} />
          <View>
            <Text style={s.company}>{COMPANY.name}</Text>
            <Text style={s.tagline}>{COMPANY.tagline}</Text>
          </View>
        </View>
        <View style={s.ruleThick} />
        <Text style={s.title}>QUOTATION</Text>
        <View style={s.ruleThin} />

        {/* Bill To and quotation details */}
        <View style={s.meta}>
          <View style={{ maxWidth: "55%" }}>
            <Text style={s.billLabel}>BILL TO</Text>
            <Text style={s.billName}>{q.name}</Text>
            {q.attn ? <Text style={s.metaLine}>Attn: {q.attn}</Text> : null}
          </View>
          <View style={s.metaRight}>
            <Text style={s.metaLine}>Quotation No: <Text style={s.metaStrong}>{q.quoteNumber}</Text></Text>
            <Text style={s.metaLine}>Date: <Text style={s.metaStrong}>{formatDocDate(q.quoteDate)}</Text></Text>
            {q.validUntil ? <Text style={s.metaLine}>Valid Until: <Text style={s.metaStrong}>{formatDocDate(q.validUntil)}</Text></Text> : null}
          </View>
        </View>

        {/* Items */}
        <View>
          {/* fixed: repeated at the top of every page the table continues on */}
          <View style={s.th} fixed>
            <Text style={[s.thCell, s.center, { width: COL.qty }]}>Qty</Text>
            <Text style={[s.thCell, { width: COL.desc }]}>Description</Text>
            <Text style={[s.thCell, s.num, { width: COL.unit }]}>Unit Price</Text>
            <Text style={[s.thCell, s.num, { width: COL.amount }]}>Amount</Text>
          </View>
          {q.lines.map((l) => (
            <View key={l.id} style={s.tr} wrap={false}>
              <Text style={[s.td, s.center, { width: COL.qty }]}>{l.quantity.toLocaleString("en-NG")}</Text>
              <Text style={[s.td, s.cellLine, { width: COL.desc }]}>{l.description}</Text>
              <Text style={[s.td, s.cellLine, s.num, { width: COL.unit }]}>{formatNaira(l.unitPrice)}</Text>
              <Text style={[s.td, s.cellLine, s.num, { width: COL.amount }]}>{formatNaira(l.lineTotal)}</Text>
            </View>
          ))}
          <View style={s.totalRow} wrap={false}>
            <Text style={[s.td, s.totalLabel, { width: "80%" }]}>Total</Text>
            <Text style={[s.td, s.cellLine, s.num, s.totalValue, { width: COL.amount }]}>{formatNaira(q.total)}</Text>
          </View>
        </View>
        <Text style={s.words}><Text style={s.wordsLabel}>Amount in words: </Text>{nairaInWords(q.total)}.</Text>

        {bullets.length > 0 && (
          <View style={s.notes}>
            <Text style={s.h2} minPresenceAhead={30}>Notes</Text>
            {bullets.map((b, i) => (
              <View key={i} style={s.bullet} wrap={false}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment details and signature: fixed, always kept together on one page */}
        <View wrap={false}>
          <View style={s.payment}>
            <Text style={s.h2}>Payment Details</Text>
            <View style={s.box}>
              {COMPANY.payment.map(([label, value], i) => (
                <View key={label} style={[s.payRow, i === 0 ? { borderTopWidth: 0 } : {}]}>
                  <Text style={s.payLabel}>{label}</Text>
                  <Text style={s.payValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={s.sign}>
            <Text style={s.h2}>{COMPANY.authorizedBy}</Text>
            <View style={s.signLine} />
            <Text style={s.signCaption}>{COMPANY.signatureLine}</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>{q.quoteNumber}</Text>
      </Page>
    </Document>
  );
}

export async function renderQuotationPdf(q: QuoteRecord): Promise<Buffer> {
  return renderToBuffer(<QuotationDocument q={q} />);
}
