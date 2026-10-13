import Link from "next/link";
import { dateTime } from "@/components/store/format";
import { query } from "@/lib/db";
import { markNotificationsReadAction } from "../chromeActions";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const rows = await query("select * from notifications order by created_at desc limit 200");
  return (
    <>
      <div className="head">
        <div><h1 className="head__title">Notifications</h1><p className="head__sub">New orders, quote requests, messages and problems.</p></div>
        <form action={async () => { "use server"; await markNotificationsReadAction(); }}><button className="btn btn--secondary" type="submit">Mark all as read</button></form>
      </div>
      <section className="panel" aria-label="Notifications">
        {rows.length === 0 ? <p className="adm-empty">Nothing yet.</p> : (
          <ul className="attn">
            {rows.map((n) => (
              <li key={n.id}>
                <span className={`attn__icon${n.read_at ? "" : " attn__icon--warn"}`} aria-label={n.read_at ? "Read" : "Unread"}>{n.read_at ? "·" : "•"}</span>
                <div>
                  <p className="attn__title">{n.link ? <Link href={n.link}>{n.title}</Link> : n.title}</p>
                  <p className="attn__sub" style={{ whiteSpace: "pre-line" }}>{n.body}</p>
                </div>
                <p className="attn__age">{dateTime(new Date(n.created_at).toISOString())}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
