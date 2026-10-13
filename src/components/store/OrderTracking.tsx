import { Icon } from "./Icon";
import { naira } from "./format";
import { customerLines } from "./OrderSummary";
import { STATUS_LABEL, timelineSteps, type Order, type OrderStatus } from "@/lib/store/orders";

export function statusChip(s: OrderStatus): string {
  if (s === "completed") return "chip chip--done";
  if (s === "cancelled") return "chip chip--cancel";
  if (s === "refunded") return "chip chip--refund";
  if (s === "pending_payment") return "chip chip--neutral";
  return "chip chip--progress";
}

const MSG: Partial<Record<OrderStatus, string>> = {
  paid: "We have your payment and will call you to confirm.",
  confirmed: "We've confirmed the details with you.",
  sourcing: "We're getting your parts together.",
  ready: "Your order is packed and ready.",
  out_for_delivery: "Your order is on its way.",
  ready_for_pickup: "Come to Waste2Light, Bosso, Minna to collect it.",
  completed: "Delivered. Enjoy building!",
};

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date(iso)).replace(/,(?=[^,]*$)/, ",");
const placed = (iso: string) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));

export function OrderTracking({ o }: { o: Order }) {
  const steps = timelineSteps(o.fulfilment);
  // When each step was reached: the last event that set that status.
  const reached = new Map<OrderStatus, string>();
  for (const e of o.events) if (e.status) reached.set(e.status, e.at);
  if (o.paidAt && !reached.has("paid")) reached.set("paid", o.paidAt);
  const current = steps.indexOf(o.status);
  const ended = o.status === "cancelled" || o.status === "refunded";
  const how = o.fulfilment === "delivery" ? `Delivery in Minna${o.address ? `, ${o.address.area || o.address.street}` : ""}` : "Pickup at Waste2Light, Bosso, Minna";

  return (
    <div className="result">
      <section className="card" aria-labelledby="t-title">
        <div className="card__head">
          <div>
            <h2 className="card__title" id="t-title">Order {o.number}</h2>
            <p className="card__sub">Placed {placed(o.createdAt)}</p>
          </div>
          <span className={statusChip(o.status)}>{STATUS_LABEL[o.status]}</span>
        </div>
        {o.status === "pending_payment" ? (
          <p className="card__sub" style={{ marginTop: 12 }}>
            {o.paymentMethod === "bank_transfer"
              ? `Waiting for your bank transfer of ${naira(o.total)} (reference ${o.number}). We'll update this page when it arrives.`
              : "We have not received the payment yet. If you paid, it can take a few minutes to show."}
          </p>
        ) : (
          <ol className="timeline" aria-label="Order progress">
            {steps.map((s, i) => {
              const done = !ended && (i < current || (i === current && s === "completed"));
              const now = !ended && i === current && s !== "completed";
              const at = reached.get(s);
              return (
                <li key={s} className={`tstep ${done ? "tstep--done" : now ? "tstep--now" : "tstep--todo"}`} aria-current={now ? "step" : undefined}>
                  <span className="tstep__dot">{done && <Icon name="check" />}</span>
                  <span className="tstep__label">{STATUS_LABEL[s]}</span>
                  <span className="tstep__time">{at && (done || now) ? fmt(at) : "Not yet"}</span>
                  {now && MSG[s] && <span className="tstep__msg">{MSG[s]}</span>}
                </li>
              );
            })}
          </ol>
        )}
        {ended && <div className="alt"><span>This order was {STATUS_LABEL[o.status].toLowerCase()}{o.refunded > 0 ? `; ${naira(o.refunded)} refunded` : ""}.</span><span className={statusChip(o.status)}>{STATUS_LABEL[o.status]}</span></div>}
        {!ended && o.refunded > 0 && <div className="alt"><span>{naira(o.refunded)} of this order was refunded.</span><span className="chip chip--refund">Part refunded</span></div>}
      </section>
      <div className="side">
        <section className="card" aria-label="Questions about this order">
          <h2 className="card__title">Questions about this order?</h2>
          <div className="contact-btns">
            <a className="btn btn--primary" href="tel:+2348134392943"><Icon name="phone" />Call +234 813 439 2943</a>
            <a className="btn btn--secondary" href={`https://wa.me/2348078787646?text=${encodeURIComponent(`Hello, about order ${o.number}`)}`}><Icon name="whatsapp" />WhatsApp us</a>
          </div>
        </section>
        <section className="card" aria-label="Order details">
          <h2 className="card__title">Order details</h2>
          {customerLines(o).map((l) => <div className="pline" key={l.key}><span>{l.title}<small>{l.sub}</small></span><span className="price">{naira(l.total)}</span></div>)}
          <div className="ptotal"><span>Total</span><span className="price">{naira(o.total)}</span></div>
          <dl className="pmeta"><dt>{o.fulfilment === "delivery" ? "Delivery" : "Pickup"}</dt><dd>{how}</dd></dl>
          {o.paidAt && <p style={{ marginTop: 12 }}><a className="btn btn--text" href={`/api/orders/${encodeURIComponent(o.number)}/receipt?t=${o.accessToken}`}><Icon name="download" />Download receipt (PDF)</a></p>}
        </section>
      </div>
    </div>
  );
}
