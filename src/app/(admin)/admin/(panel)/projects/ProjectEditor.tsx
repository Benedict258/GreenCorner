"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/store/Icon";
import { naira } from "@/components/store/format";
import { deleteProjectAction, findProductsAction, saveProjectAction, uploadMediaAction } from "./actions";

export interface EditorItem { ref: string; title: string; quantity: number; price: number | null; inStock: boolean; hidden?: boolean }
export interface EditorProject {
  id: number | null;
  title: string; slug: string; summary: string; description: string; learn: string;
  level: string; ageGroup: string; topics: string[]; buildTime: string;
  imageUrl: string; videoUrl: string;
  steps: { title: string; text: string; image: string }[];
  safety: string;
  downloads: { label: string; url: string }[];
  published: boolean; position: number;
  items: EditorItem[];
  updatedAt: string | null;
}

const TOPICS = ["Solar", "Wind", "Sensors", "Robotics", "Lighting", "Recycling", "IoT"];
const slugify = (s: string) => s.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

async function upload(file: File): Promise<string> {
  const fd = new FormData();
  fd.set("file", file);
  const r = await uploadMediaAction(fd);
  if (r.error) throw new Error(r.error);
  return r.url!;
}

function UploadButton({ onDone, accept = "image/*", label = "Upload" }: { onDone: (url: string) => void; accept?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <label className="btn btn--secondary btn--sm" style={{ cursor: "pointer" }}>
        {busy ? "Uploading…" : label}
        <input type="file" accept={accept} hidden disabled={busy} onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true); setErr("");
          try { onDone(await upload(f)); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
        }} />
      </label>
      {err && <span className="form-error">{err}</span>}
    </span>
  );
}

export function ProjectEditor({ initial }: { initial: EditorProject }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof EditorProject>(k: K, v: EditorProject[K]) => { setP((x) => ({ ...x, [k]: v })); setDirty(true); };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const kitPrice = useMemo(() => p.items.reduce((n, i) => n + (i.price ?? 0) * i.quantity, 0), [p.items]);
  const outItems = p.items.filter((i) => !i.inStock || i.price === null || i.hidden);

  const save = () => start(async () => {
    setMsg(null);
    const r = await saveProjectAction(p.id, {
      title: p.title, slug: p.slug, summary: p.summary, description: p.description,
      learn: p.learn.split("\n").map((s) => s.trim()).filter(Boolean),
      level: p.level, ageGroup: p.ageGroup, topics: p.topics, buildTime: p.buildTime,
      imageUrl: p.imageUrl.trim() || null, videoUrl: p.videoUrl.trim() || null,
      steps: p.steps.map((s) => ({ title: s.title.trim(), text: s.text.trim(), image: s.image.trim() || null })),
      safety: p.safety, downloads: p.downloads, published: p.published, position: p.position,
      items: p.items.map((i) => ({ ref: i.ref, quantity: i.quantity })),
    });
    if (r.error) { setMsg({ error: r.error }); return; }
    setDirty(false);
    setMsg({ ok: "Saved." });
    if (!p.id && r.id) router.replace(`/admin/projects/${r.id}`);
    else router.refresh();
  });

  return (
    <>
      <p className="crumbs"><Link href="/admin/projects">Projects</Link> / {p.id ? "Edit project" : "New project"}</p>
      <div className="head">
        <div><h1 className="head__title">{p.title || "New project"}</h1><p className="head__sub">{p.updatedAt ? `Last saved ${p.updatedAt}` : "Not saved yet"} · {p.published ? "Published" : "Draft"}{dirty ? " · unsaved changes" : ""}</p></div>
        <div className="head__actions">
          {p.id && <a className="btn btn--secondary" href={`/projects/${p.slug}`} target="_blank" rel="noreferrer">Preview page</a>}
          <button className="btn btn--primary" type="button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
      {msg && <p className={`notice-box${msg.error ? " notice-box--error" : ""}`} role={msg.error ? "alert" : "status"}>{msg.error ?? msg.ok}</p>}
      <div className="layout">
        <div className="stack">
          <section className="panel" aria-labelledby="b-title">
            <div className="panel__head"><h2 className="panel__title" id="b-title">Basics</h2></div>
            <div className="panel__body">
              <div className="grid-2">
                <div className="field"><label className="field__label" htmlFor="ptitle">Title</label><input className="field__input" id="ptitle" value={p.title} onChange={(e) => { set("title", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} /></div>
                <div className="field"><label className="field__label" htmlFor="pslug">Page address</label><input className="field__input" id="pslug" value={p.slug} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} /><p className="field__help">/projects/{p.slug || "…"}</p></div>
              </div>
              <div className="field"><label className="field__label" htmlFor="psum">Short summary</label><textarea className="field__input" id="psum" value={p.summary} maxLength={200} onChange={(e) => set("summary", e.target.value)} /><p className="field__help">Shown on project cards. Keep it under 140 characters ({p.summary.length}).</p></div>
              <div className="grid-2">
                <div className="field"><label className="field__label" htmlFor="plevel">Level</label><select className="field__input" id="plevel" value={p.level} onChange={(e) => set("level", e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
                <div className="field"><label className="field__label" htmlFor="page">Age group</label><input className="field__input" id="page" list="ages" value={p.ageGroup} onChange={(e) => set("ageGroup", e.target.value)} /><datalist id="ages"><option value="Primary" /><option value="Secondary" /><option value="University" /><option value="Adult" /><option value="Primary and secondary" /><option value="Secondary and university" /></datalist></div>
                <div className="field"><label className="field__label" htmlFor="ptime">Build time</label><input className="field__input" id="ptime" value={p.buildTime} placeholder="2 hours" onChange={(e) => set("buildTime", e.target.value)} /></div>
                <div className="field"><label className="field__label" htmlFor="ppos">Order on the page</label><input className="field__input" id="ppos" inputMode="numeric" value={p.position} onChange={(e) => set("position", Number(e.target.value.replace(/\D/g, "")) || 0)} /><p className="field__help">Lower numbers show first.</p></div>
              </div>
              <fieldset className="field" style={{ border: 0, padding: 0 }}>
                <legend className="field__label">Topics</legend>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {TOPICS.map((t) => <label key={t} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={p.topics.includes(t)} onChange={(e) => set("topics", e.target.checked ? [...p.topics, t] : p.topics.filter((x) => x !== t))} />{t}</label>)}
                </div>
              </fieldset>
            </div>
          </section>

          <section className="panel" aria-labelledby="m-title">
            <div className="panel__head"><h2 className="panel__title" id="m-title">Photo and video</h2></div>
            <div className="panel__body">
              <div className="media">
                <div className="media__item media__item--main" style={{ overflow: "hidden" }}>
                  <span className="media__tag">Cover</span>
                  {p.imageUrl ? <img src={p.imageUrl} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="image" />}
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="pimg">Cover photo</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input className="field__input" id="pimg" value={p.imageUrl} placeholder="Upload, or paste an https:// link" onChange={(e) => set("imageUrl", e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                  <UploadButton onDone={(u) => set("imageUrl", u)} label="Upload photo" />
                </div>
                <p className="field__help">A clear photo of the finished build, 4:3, under 3 MB.</p>
              </div>
              <div className="field"><label className="field__label" htmlFor="pvid">Video link <span className="field__opt">(optional, YouTube or Vimeo)</span></label><input className="field__input" id="pvid" value={p.videoUrl} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => set("videoUrl", e.target.value)} /></div>
            </div>
          </section>

          <section className="panel" aria-labelledby="d-title">
            <div className="panel__head"><h2 className="panel__title" id="d-title">Description and learning</h2></div>
            <div className="panel__body">
              <div className="field"><label className="field__label" htmlFor="pdesc">What you&apos;ll build <span className="field__opt">(a blank line starts a new paragraph)</span></label><textarea className="field__input" id="pdesc" rows={6} value={p.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="field"><label className="field__label" htmlFor="plearn">What you&apos;ll learn <span className="field__opt">(one per line)</span></label><textarea className="field__input" id="plearn" rows={5} value={p.learn} onChange={(e) => set("learn", e.target.value)} /></div>
            </div>
          </section>

          <section className="panel" aria-labelledby="s-title">
            <div className="panel__head"><h2 className="panel__title" id="s-title">Build steps</h2><button className="btn btn--secondary btn--sm" type="button" onClick={() => set("steps", [...p.steps, { title: "", text: "", image: "" }])}><Icon name="plus" />Add step</button></div>
            <div className="panel__body">
              {p.steps.length === 0 && <p className="field__help">No steps yet.</p>}
              <ol className="rows">
                {p.steps.map((s, i) => (
                  <li className="rowx" key={i} style={{ alignItems: "start" }}>
                    <span className="rowx__n">{i + 1}</span>
                    <div className="field" style={{ display: "grid", gap: 6 }}>
                      <label className="sr-only" htmlFor={`st${i}`}>Step {i + 1} title</label>
                      <input className="field__input" id={`st${i}`} placeholder="Step title" value={s.title} onChange={(e) => set("steps", p.steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                      <textarea className="field__input" aria-label={`Step ${i + 1} instructions`} placeholder="What to do" value={s.text} onChange={(e) => set("steps", p.steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input className="field__input" aria-label={`Step ${i + 1} photo link`} placeholder="Photo (optional)" value={s.image} onChange={(e) => set("steps", p.steps.map((x, j) => (j === i ? { ...x, image: e.target.value } : x)))} style={{ flex: 1, minWidth: 180 }} />
                        <UploadButton onDone={(u) => set("steps", p.steps.map((x, j) => (j === i ? { ...x, image: u } : x)))} label="Upload" />
                      </div>
                    </div>
                    <span style={{ display: "grid", gap: 4 }}>
                      <button className="icon-btn" type="button" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => { const a = [...p.steps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("steps", a); }}>↑</button>
                      <button className="icon-btn" type="button" aria-label={`Remove step ${i + 1}`} onClick={() => set("steps", p.steps.filter((_, j) => j !== i))}><Icon name="trash" /></button>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="panel" aria-labelledby="sf-title">
            <div className="panel__head"><h2 className="panel__title" id="sf-title">Safety notes and downloads</h2></div>
            <div className="panel__body">
              <div className="field"><label className="field__label" htmlFor="psafe">Safety notes <span className="field__opt">(one per line)</span></label><textarea className="field__input" id="psafe" value={p.safety} onChange={(e) => set("safety", e.target.value)} /></div>
              {p.downloads.map((d, i) => (
                <div className="grid-2" key={i} style={{ alignItems: "end" }}>
                  <div className="field"><label className="field__label" htmlFor={`dl${i}`}>Download name</label><input className="field__input" id={`dl${i}`} value={d.label} placeholder="Wiring diagram" onChange={(e) => set("downloads", p.downloads.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></div>
                  <div className="field">
                    <label className="field__label" htmlFor={`du${i}`}>File or link</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input className="field__input" id={`du${i}`} value={d.url} placeholder="Upload a PDF or paste a link" onChange={(e) => set("downloads", p.downloads.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                      <UploadButton accept="application/pdf,image/*" onDone={(u) => set("downloads", p.downloads.map((x, j) => (j === i ? { ...x, url: u } : x)))} label="Upload" />
                      <button className="icon-btn" type="button" aria-label="Remove download" onClick={() => set("downloads", p.downloads.filter((_, j) => j !== i))}><Icon name="trash" /></button>
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => set("downloads", [...p.downloads, { label: "", url: "" }])}><Icon name="plus" />Add download</button>
            </div>
          </section>

          <KitItems items={p.items} onChange={(items) => set("items", items)} />
        </div>

        <aside className="stack" aria-label="Publishing and kit price">
          <section className="panel" aria-labelledby="pub-title">
            <div className="panel__head"><h2 className="panel__title" id="pub-title">Publishing</h2></div>
            <div className="panel__body">
              <div className="switch-row"><span id="publ">Published on the store</span><label className="switch"><span className="sr-only">Published</span><input type="checkbox" checked={p.published} onChange={(e) => set("published", e.target.checked)} /><span className="switch__track" /></label></div>
              <p className="field__help">Drafts are only visible here. Save to apply.</p>
            </div>
          </section>
          <section className="panel" aria-labelledby="kit-title">
            <div className="panel__head"><h2 className="panel__title" id="kit-title">Live kit price</h2></div>
            <div className="panel__body kit">
              <div className="kit__total"><span>Customer sees</span><span className="price">{naira(kitPrice)}</span></div>
              <p className="kit__sub">Sum of all component lines using our current prices. It updates when prices or quantities change.</p>
              {outItems.length > 0 && <p className="warn"><Icon name="alert" /><span>{outItems.length} component{outItems.length === 1 ? " is" : "s are"} out of stock or not sold: {outItems.map((i) => i.title).join(", ")}. The kit page tells customers we will call to agree a swap.</span></p>}
            </div>
          </section>
          {p.id && (
            <section className="panel">
              <div className="panel__body">
                <button className="btn btn--danger btn--block" type="button" onClick={() => { if (window.confirm("Delete this project? This cannot be undone.")) start(() => deleteProjectAction(p.id!)); }}>Delete project</button>
              </div>
            </section>
          )}
        </aside>
      </div>
      <div className="savebar">
        {p.id && <a className="btn btn--secondary" href={`/projects/${p.slug}`} target="_blank" rel="noreferrer">Preview</a>}
        <button className="btn btn--primary" type="button" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save changes"}</button>
      </div>
    </>
  );
}

function KitItems({ items, onChange }: { items: EditorItem[]; onChange: (i: EditorItem[]) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<EditorItem[]>([]);
  const [searching, start] = useTransition();
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => start(async () => setHits((await findProductsAction(q)).map((h) => ({ ...h, quantity: 1 })))), 250);
    return () => clearTimeout(t);
  }, [q]);
  const add = (h: EditorItem) => {
    const found = items.find((i) => i.ref === h.ref);
    onChange(found ? items.map((i) => (i.ref === h.ref ? { ...i, quantity: i.quantity + 1 } : i)) : [...items, h]);
    setQ("");
    setHits([]);
  };
  return (
    <section className="panel" aria-labelledby="c-title">
      <div className="panel__head"><h2 className="panel__title" id="c-title">Components in this kit</h2></div>
      <div className="panel__body" style={{ position: "relative" }}>
        <label className="field__label" htmlFor="kitq">Add component</label>
        <input className="field__input" id="kitq" type="search" placeholder="Search products, e.g. TP4056, solar panel" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        {(hits.length > 0 || searching) && (
          <ul className="suggest" role="listbox" style={{ top: "100%" }}>
            {searching && hits.length === 0 && <li style={{ padding: 8 }}>Searching…</li>}
            {hits.map((h) => (
              <li key={h.ref}>
                <a href="#" role="option" aria-selected="false" onClick={(e) => { e.preventDefault(); add(h); }} style={{ gridTemplateColumns: "1fr auto" }}>
                  <span className="suggest__name">{h.title}{!h.inStock ? " (out of stock)" : ""}{h.hidden ? " (hidden)" : ""}</span>
                  <span className="suggest__price">{h.price !== null ? naira(h.price) : "No price"}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="table-wrap">
        <table className="table">
          <caption className="sr-only">Kit components with quantity, price and stock</caption>
          <thead><tr><th scope="col">Component</th><th scope="col">Qty</th><th scope="col" className="num">Unit price</th><th scope="col" className="num">Line total</th><th scope="col">Stock</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6}>No components yet. Search above to add them.</td></tr>}
            {items.map((i) => (
              <tr key={i.ref}>
                <td>{i.title}</td>
                <td><label className="sr-only" htmlFor={`q-${i.ref}`}>Quantity of {i.title}</label><input className="qty" id={`q-${i.ref}`} inputMode="numeric" value={i.quantity} onChange={(e) => onChange(items.map((x) => (x.ref === i.ref ? { ...x, quantity: Math.max(1, Math.min(1000, Number(e.target.value.replace(/\D/g, "")) || 1)) } : x)))} /></td>
                <td className="num">{i.price !== null ? naira(i.price) : "–"}</td>
                <td className="num price">{i.price !== null ? naira(i.price * i.quantity) : "–"}</td>
                <td>{i.price === null || i.hidden ? <span className="stock stock--out">Not sold</span> : i.inStock ? <span className="stock stock--in">In stock</span> : <span className="stock stock--out">Out of stock</span>}</td>
                <td><button className="icon-btn" type="button" aria-label={`Remove ${i.title}`} onClick={() => onChange(items.filter((x) => x.ref !== i.ref))}><Icon name="trash" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
