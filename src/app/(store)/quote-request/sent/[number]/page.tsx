import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { formatDocDate } from "@/lib/quoteDocument";
import { findRequestForCustomer } from "@/lib/store/quoteRequests";
import { callbackPromise } from "@/lib/store/storeSettings";
import { currentCustomer, formatPhone } from "@/lib/users";

export const metadata = { title: "Request sent", robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> };

export default async function RequestSent({ params, searchParams }: Props) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  const r = await findRequestForCustomer(decodeURIComponent(number), t ?? "");
  if (!r) notFound();
  const [user, promise] = await Promise.all([currentCustomer(), callbackPromise()]);
  return (
    <div className="container">
      <section className="status" aria-labelledby="st-title">
        <span className="status__badge status__badge--ok"><Icon name="check" /></span>
        <h1 className="status__title" id="st-title">Request sent</h1>
        <p className="status__text">We&apos;ll call you within {promise} with an official quotation.</p>
        <p className="status__ref">Reference <b>{r.number}</b></p>
        <div className="status__actions">
          {user ? <Link className="btn btn--primary btn--lg" href="/account/quotes">View my quotes</Link> : <Link className="btn btn--primary btn--lg" href="/account/sign-up">Create an account to track it</Link>}
          <Link className="btn btn--secondary btn--lg" href="/projects">Back to projects</Link>
        </div>
        <div className="panel">
          <h2 className="panel__title">What you sent</h2>
          {r.lines.map((l) => (
            <div className="pline" key={l.id}><span>{l.title}<small>{l.projectId ? "Complete kit" : "Component"} · Qty {l.quantity}{l.note ? ` · ${l.note}` : ""}</small></span><span className="price">{naira(l.lineTotal)}</span></div>
          ))}
          {r.lines.length > 0 && <div className="ptotal"><span>Estimated total</span><span className="price">{naira(r.estimatedTotal)}</span></div>}
          <dl className="pmeta">
            <dt>Organisation</dt><dd>{r.organisation}</dd>
            <dt>Contact</dt><dd>{r.contactName} · {formatPhone(r.phone)}</dd>
            {r.neededBy && <><dt>Needed by</dt><dd>{formatDocDate(r.neededBy)}</dd></>}
            {r.message && <><dt>Message</dt><dd>{r.message}</dd></>}
          </dl>
          <p className="status__text">{user ? "You're signed in, so this request is also saved under Account, then Quotes. " : ""}We will email the official quotation with a &quot;View and pay online&quot; button.</p>
        </div>
      </section>
    </div>
  );
}
