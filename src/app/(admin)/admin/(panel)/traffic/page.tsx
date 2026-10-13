import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { audit, blockIp, busiestVisitors, PAGE_LIMITS, unblockIp } from "@/lib/guard";
import { query } from "@/lib/db";
import { dateTime } from "@/components/store/format";

export const metadata = { title: "Traffic" };

async function block(ip: string) {
  "use server";
  const s = await requireOwner();
  await blockIp(ip, `Blocked by ${s.email}`);
  await audit(s.email, "ip_blocked", "ip", ip);
  revalidatePath("/admin/traffic");
}

async function unblock(ip: string) {
  "use server";
  const s = await requireOwner();
  await unblockIp(ip);
  await audit(s.email, "ip_unblocked", "ip", ip);
  revalidatePath("/admin/traffic");
}

export default async function Traffic() {
  const [busy, blocked] = await Promise.all([busiestVisitors(20), query("select * from blocked_ips order by created_at desc")]);
  const perMin = PAGE_LIMITS[0].max;
  return (
    <>
      <div className="head"><div><h1 className="head__title">Traffic</h1><p className="head__sub">Protecting the catalog from copying. Shop pages are limited to {perMin} a minute and {PAGE_LIMITS[1].max} an hour per visitor; known copying tools are refused.</p></div></div>
      <section className="panel" aria-label="Busiest visitors">
        <div className="panel__head" style={{ padding: "16px 20px 0" }}><h2 className="panel__title">Busiest visitors, last hour (shop pages)</h2></div>
        {busy.length === 0 ? <p className="adm-empty">No traffic recorded in the last hour.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Address</th><th scope="col" className="num">Shop pages</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
              <tbody>
                {busy.map((v) => (
                  <tr key={v.ip}>
                    <td>{v.ip}{v.hits > perMin * 10 && <> <span className="adm-pill adm-pill--bad">Looks automated</span></>}</td>
                    <td className="num">{v.hits}</td>
                    <td>{v.blocked ? <form action={unblock.bind(null, v.ip)}><button className="btn btn--sm btn--secondary">Unblock</button></form> : <form action={block.bind(null, v.ip)}><button className="btn btn--sm btn--danger">Block</button></form>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel" aria-label="Blocked addresses">
        <div className="panel__head" style={{ padding: "16px 20px 0" }}><h2 className="panel__title">Blocked addresses</h2></div>
        {blocked.length === 0 ? <p className="adm-empty">None.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th scope="col">Address</th><th scope="col">Why</th><th scope="col">Since</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
              <tbody>{blocked.map((b) => <tr key={b.ip}><td>{b.ip}</td><td>{b.reason}</td><td>{dateTime(new Date(b.created_at).toISOString())}</td><td><form action={unblock.bind(null, b.ip)}><button className="btn btn--sm btn--secondary">Unblock</button></form></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
