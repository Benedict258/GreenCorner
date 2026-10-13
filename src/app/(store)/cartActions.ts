"use server";
import { revalidatePath } from "next/cache";
import { addKitPartsToCart, addKitToCart, addProductToCart, currentCartId, ensureCart, loadCart, setLineQuantity, type CartView } from "@/lib/store/cart";
import { currentCustomer } from "@/lib/users";

// The cart actions used by Add to cart buttons, the drawer and the cart page. Errors are returned, not
// thrown, because production builds hide thrown messages from the browser.

export interface DrawerLine {
  id: number;
  kind: "product" | "kit";
  title: string;
  sub: string;
  href: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  problem: string | null;
}

export interface DrawerCart {
  lines: DrawerLine[];
  subtotal: number;
  count: number;
  blocked: boolean;
}

export type CartResult = { ok: true; cart: DrawerCart; message?: string } | { ok: false; error: string; cart?: DrawerCart };

function toDrawer(c: CartView): DrawerCart {
  return {
    lines: c.lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      title: l.title,
      sub: l.kind === "kit" ? `${l.kitItems?.length ?? 0} components · complete kit` : `₦${l.unitPrice.toLocaleString("en-NG")} each`,
      href: l.href,
      image: l.image,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      problem: l.missing ? "No longer available" : l.availability === "out" ? (l.kind === "kit" ? "Part of this kit is no longer sold" : "Out of stock") : l.kind === "kit" && l.availability === "low" ? "One part is out of stock: we'll call you" : null,
    })),
    subtotal: c.subtotal,
    count: c.count,
    blocked: c.blocked,
  };
}

const refresh = () => revalidatePath("/", "layout");

async function cartForWrite(): Promise<string> {
  const user = await currentCustomer();
  return ensureCart(user?.id ?? null);
}

export async function getCartAction(): Promise<DrawerCart> {
  return toDrawer(await loadCart(await currentCartId()));
}

export async function addToCartAction(productId: number, quantity: number): Promise<CartResult> {
  try {
    const cartId = await cartForWrite();
    const { title } = await addProductToCart(cartId, Number(productId), quantity);
    refresh();
    return { ok: true, cart: toDrawer(await loadCart(cartId)), message: `Added ${title}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addKitAction(projectId: number, kits: number): Promise<CartResult> {
  try {
    const cartId = await cartForWrite();
    const { title } = await addKitToCart(cartId, Number(projectId), kits);
    refresh();
    return { ok: true, cart: toDrawer(await loadCart(cartId)), message: `Added ${title}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addKitPartsAction(projectId: number, refs: string[], kits: number): Promise<CartResult> {
  try {
    if (!Array.isArray(refs) || refs.length === 0) return { ok: false, error: "Tick at least one part." };
    const cartId = await cartForWrite();
    const n = await addKitPartsToCart(cartId, Number(projectId), refs.map(String), kits);
    refresh();
    return { ok: true, cart: toDrawer(await loadCart(cartId)), message: `Added ${n} part${n === 1 ? "" : "s"}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function setQuantityAction(lineId: number, quantity: number): Promise<CartResult> {
  try {
    const cartId = await currentCartId();
    if (!cartId) return { ok: false, error: "Your cart has expired. Add the items again." };
    await setLineQuantity(cartId, Number(lineId), quantity);
    refresh();
    return { ok: true, cart: toDrawer(await loadCart(cartId)) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
