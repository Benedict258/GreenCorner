import { getProduct } from "@/lib/store/catalog";
import { currentCartId } from "@/lib/store/cart";
import { startingLines } from "@/lib/store/quoteRequests";
import { getProject } from "@/lib/store/projects";
import { currentCustomer } from "@/lib/users";
import { QuoteForm, type QItem } from "./QuoteForm";

export const metadata = {
  title: "Request a quote",
  description: "Schools and organisations: send us your list of components or project kits and we'll call you with an official quotation.",
};

type Params = { project?: string; kits?: string; product?: string; qty?: string };

export default async function QuoteRequestPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const user = await currentCustomer();
  let items: QItem[] = [];

  if (sp.project) {
    const lines = await startingLines({ projectId: Number(sp.project), kits: Number(sp.kits) || 1 });
    const p = lines[0]?.projectId ? await getProject(lines[0].projectId) : null;
    items = lines.map((l) => ({ key: `k${l.projectId}`, ref: null, projectId: l.projectId, title: l.title, sub: `Complete kit · ${p?.items.length ?? 0} components`, unitPrice: l.unitPrice, quantity: l.quantity, note: "", kit: true }));
  } else if (sp.product) {
    const p = await getProduct(Number(sp.product));
    if (p) items = [{ key: `p${p.id}`, ref: p.ref, projectId: null, title: p.title, sub: p.category, unitPrice: p.price, quantity: Math.max(1, Number(sp.qty) || 1), note: "", kit: false }];
  } else {
    const lines = await startingLines({ cartId: await currentCartId() });
    items = lines.map((l, i) => ({ key: `c${i}`, ref: l.ref, projectId: l.projectId, title: l.title, sub: l.projectId ? "Complete kit" : "Component", unitPrice: l.unitPrice, quantity: l.quantity, note: "", kit: !!l.projectId }));
  }

  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">Request a quote</h1>
        <p className="page-head__sub">For schools and organisations. Send us your list and we&apos;ll call you with an official quotation.</p>
      </div>
      <QuoteForm items={items} defaults={{ organisation: "", name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }} />
    </div>
  );
}
