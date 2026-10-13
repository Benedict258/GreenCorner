import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Icon } from "@/components/store/Icon";
import { OrderPanel } from "@/components/store/OrderSummary";
import { naira } from "@/components/store/format";
import { COMPANY } from "@/lib/quoteDocument";
import { findOrderForCustomer } from "@/lib/store/orders";
import { callbackPromise } from "@/lib/store/storeSettings";
import { formatPhone } from "@/lib/users";

export const metadata = { title: "Thank you", robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> };

export default async function SuccessPage({ params, searchParams }: Props) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const o = await findOrderForCustomer(decodeURIComponent(number), { token: t });
  if (!o) notFound();
  const first = o.name.split(" ")[0];
  const promise = await callbackPromise();
  const track = `/track/${encodeURIComponent(o.number)}?t=${o.accessToken}`;
  const waiting = o.status === "pending_payment" && o.paymentMethod === "bank_transfer";

  return (
    <div className="container">
      <section className="status" aria-labelledby="st-title">
        <span className={`status__badge ${waiting ? "status__badge--warn" : "status__badge--ok"}`}><Icon name={waiting ? "clock" : "check"} /></span>
        {waiting ? (
          <>
            <h1 className="status__title" id="st-title">Thank you, {first}! Order {o.number} is reserved.</h1>
            <p className="status__text">Transfer <b>{naira(o.total)}</b> to the account below, with <b>{o.number}</b> as the reference. We&apos;ll confirm when it arrives and call you on {formatPhone(o.phone)}.</p>
            <div className="panel" style={{ textAlign: "left" }}>
              <h2 className="panel__title">Pay by bank transfer</h2>
              <dl className="pmeta">{COMPANY.payment.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd><b>{v}</b></dd></Fragment>)}<dt>Amount</dt><dd><b>{naira(o.total)}</b></dd><dt>Reference</dt><dd><b>{o.number}</b></dd></dl>
            </div>
          </>
        ) : (
          <>
            <h1 className="status__title" id="st-title">Thank you, {first}! Order {o.number} is paid.</h1>
            <p className="status__text">We&apos;ll call you on {formatPhone(o.phone)} within {promise} to confirm {o.fulfilment === "delivery" ? "delivery" : "pickup"}.</p>
          </>
        )}
        <div className="status__actions">
          <Link className="btn btn--primary btn--lg" href={track}>Track your order</Link>
          {!waiting && <a className="btn btn--secondary btn--lg" href={`/api/orders/${encodeURIComponent(o.number)}/receipt?t=${o.accessToken}`}><Icon name="download" />Download receipt (PDF)</a>}
        </div>
        <OrderPanel o={o} />
      </section>
    </div>
  );
}
