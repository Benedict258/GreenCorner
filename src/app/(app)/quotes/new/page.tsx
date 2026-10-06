import QuoteBuilder from "../QuoteBuilder";
import { loadBuilderCatalog } from "../builderData";
import { loadCart } from "@/lib/shop";

export const metadata = { title: "New quote" };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const fromCart = (await searchParams).from === "cart";
  const [catalog, cart] = await Promise.all([loadBuilderCatalog(), fromCart ? loadCart() : []]);
  return (
    <QuoteBuilder
      catalog={catalog}
      initial={{ id: null, name: "", notes: "", lines: [] }}
      startLines={cart.map((l) => ({ kind: "component" as const, refId: l.componentId, quantity: l.quantity }))}
      fromCart={fromCart}
    />
  );
}
