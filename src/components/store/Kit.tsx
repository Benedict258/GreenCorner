"use client";
import Link from "next/link";
import { createContext, useContext, useState, useTransition } from "react";
import { addKitAction, addKitPartsAction } from "@/app/(store)/cartActions";
import { useCart } from "./CartProvider";
import { Stepper } from "./AddToCart";
import { Icon } from "./Icon";
import { naira } from "./format";

export interface KitRow {
  ref: string;
  quantity: number;
  title: string | null; // null = no longer sold
  href: string | null;
  image: string | null;
  icon: string;
  unitPrice: number;
  out: boolean;
}

const KitCtx = createContext<{ kits: number; setKits: (n: number) => void } | null>(null);

/** Shares the number of kits between the buy box, the parts table and the phone sticky bar. */
export function KitProvider({ children }: { children: React.ReactNode }) {
  const [kits, setKits] = useState(1);
  return <KitCtx.Provider value={{ kits, setKits }}>{children}</KitCtx.Provider>;
}

function useKits() {
  const c = useContext(KitCtx);
  if (!c) throw new Error("KitProvider missing");
  return c;
}

export function KitBuyBox({ projectId, kitPrice, outCount, missing }: { projectId: number; kitPrice: number; outCount: number; missing: boolean }) {
  const { kits, setKits } = useKits();
  const { show } = useCart();
  const [pending, start] = useTransition();
  const buy = () => start(async () => show(await addKitAction(projectId, kits)));
  return (
    <>
      <div className="buybox">
        <div className="buybox__row"><span className="buybox__label">Complete kit</span><span className="price buybox__price">{naira(kitPrice * kits)}</span></div>
        <div className="buybox__qty">
          <span className="buybox__qty-label" id="kits-label">Number of kits</span>
          <Stepper value={kits} onChange={setKits} labelledBy="kits-label" label="Number of kits" />
        </div>
        {missing ? (
          <div className="buybox__note" role="status"><Icon name="alert" /><p>Part of this kit is no longer sold. Request a quote and we&apos;ll suggest a replacement.</p></div>
        ) : outCount > 0 ? (
          <div className="buybox__note" role="status"><Icon name="alert" /><p>{outCount === 1 ? "One part" : `${outCount} parts`} in this kit {outCount === 1 ? "is" : "are"} out of stock. Buy the kit anyway and we&apos;ll call you to agree a swap or a short wait.</p></div>
        ) : null}
        <button className="btn btn--primary btn--lg btn--block" type="button" disabled={pending || missing} aria-busy={pending} onClick={buy}>{pending ? "Adding…" : "Buy the kit"}</button>
        <Link className="btn btn--secondary btn--lg btn--block" href={`/quote-request?project=${projectId}&kits=${Math.max(kits, 1)}`}>Request a quote for a class</Link>
      </div>
      <div className="sticky-bar">
        <div><p className="sticky-bar__label">Complete kit</p><p className="price sticky-bar__price">{naira(kitPrice * kits)}</p></div>
        <button className="btn btn--primary" type="button" disabled={pending || missing} onClick={buy}>Buy the kit</button>
      </div>
    </>
  );
}

export function KitTable({ projectId, title, rows, total }: { projectId: number; title: string; rows: KitRow[]; total: number }) {
  const { kits } = useKits();
  const { show } = useCart();
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.filter((r) => r.title && !r.out).map((r) => r.ref)));
  const [pending, start] = useTransition();
  const toggle = (ref: string) => setPicked((s) => { const n = new Set(s); if (n.has(ref)) n.delete(ref); else n.add(ref); return n; });
  return (
    <>
      <div className="table-wrap">
        <table className="kit">
          <caption className="sr-only">Components in the {title} kit</caption>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Include</span></th>
              <th scope="col"><span className="sr-only">Image</span></th>
              <th scope="col">Component</th>
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">Unit price</th>
              <th scope="col" className="num">Line total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref} className={r.out || !r.title ? "kit__row--out" : "kit__row"}>
                <td className="kit__sel">
                  <input className="kit__check" type="checkbox" aria-label={`Include ${r.title ?? "this part"}`} checked={picked.has(r.ref)} disabled={r.out || !r.title} onChange={() => toggle(r.ref)} />
                </td>
                <td className="kit__img">
                  <span className="kit__thumb">{r.image ? <img src={`${r.image}?w=120`} alt="" width={44} height={44} style={{ objectFit: "contain", width: "100%", height: "100%" }} /> : <Icon name={r.icon} className="" />}</span>
                </td>
                <td className="kit__item">
                  <span className="kit__name">
                    {r.href ? <Link href={r.href} prefetch={false}>{r.title}</Link> : <span>No longer sold</span>}
                    {r.out && r.title && <span className="badge badge--out">Out of stock</span>}
                  </span>
                </td>
                <td className="num kit__qty" data-label="Qty">{r.quantity}</td>
                <td className="num kit__unit" data-label="Unit">{r.title ? naira(r.unitPrice) : "–"}</td>
                <td className="num kit__line" data-label="Total">{r.title ? naira(r.unitPrice * r.quantity) : "–"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td></td><td></td><td colSpan={3}>Kit total</td><td className="num"><span className="price">{naira(total)}</span></td></tr>
          </tfoot>
        </table>
      </div>
      <div className="kit-actions">
        <p>Want only some parts, for example because you already have a panel? Tick what you need and add just those{kits > 1 ? ` (for ${kits} kits)` : ""}.</p>
        <button className="btn btn--secondary" type="button" disabled={pending || picked.size === 0} aria-busy={pending} onClick={() => start(async () => show(await addKitPartsAction(projectId, [...picked], kits)))}>
          {pending ? "Adding…" : "Add selected items only"}
        </button>
      </div>
    </>
  );
}
