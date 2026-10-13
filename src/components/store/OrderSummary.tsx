import { naira } from "./format";
import type { Order } from "@/lib/store/orders";
import { formatPhone } from "@/lib/users";

/** Order lines as the customer sees them: kits once, under their name. */
export function customerLines(o: Order): { key: string; title: string; sub: string; total: number }[] {
  const out: { key: string; title: string; sub: string; total: number }[] = [];
  const kits = new Map<string, { key: string; title: string; sub: string; total: number }>();
  for (const l of o.lines) {
    if (l.kitLabel) {
      let k = kits.get(l.kitLabel);
      if (!k) {
        k = { key: `k${l.id}`, title: l.kitLabel, sub: `Complete kit · Qty ${l.kitQuantity ?? 1}`, total: 0 };
        kits.set(l.kitLabel, k);
        out.push(k);
      }
      k.total += l.lineTotal;
    } else {
      out.push({ key: `l${l.id}`, title: l.title, sub: `Qty ${l.quantity}${l.status === "refunded" ? " · refunded" : l.status === "unavailable" ? " · unavailable" : ""}`, total: l.lineTotal });
    }
  }
  return out;
}

export function OrderPanel({ o, title = "Order summary" }: { o: Order; title?: string }) {
  const how = o.fulfilment === "delivery"
    ? `Delivery in Minna${o.address ? `, ${[o.address.street, o.address.area].filter(Boolean).join(", ")}` : ""}`
    : "Pickup at Waste2Light, Bosso, Minna";
  return (
    <div className="panel">
      <h2 className="panel__title">{title}</h2>
      {customerLines(o).map((l) => (
        <div className="pline" key={l.key}><span>{l.title}<small>{l.sub}</small></span><span className="price">{naira(l.total)}</span></div>
      ))}
      <div className="ptotal"><span>{o.paidAt ? "Total paid" : "Total"}</span><span className="price">{naira(o.total)}</span></div>
      <dl className="pmeta">
        <dt>{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</dt><dd>{how}</dd>
        <dt>{o.paidAt ? "Paid with" : "Payment"}</dt><dd>{o.paymentMethod === "paystack" ? "Paystack" : "Bank transfer"}{o.paidAt ? "" : " (waiting)"}</dd>
        <dt>Phone</dt><dd>{formatPhone(o.phone)}</dd>
        <dt>{o.paidAt ? "Receipt sent to" : "Email"}</dt><dd>{o.email}</dd>
        {o.refunded > 0 && <><dt>Refunded</dt><dd>{naira(o.refunded)}</dd></>}
      </dl>
    </div>
  );
}
