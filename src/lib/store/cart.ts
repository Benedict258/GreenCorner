import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { query, queryOne, tx } from "../db";
import { getProductsByRef, productPath, SUPPLIER, type Availability } from "./catalog";
import { priceKits, projectPath, kitTotals, type KitItem } from "./projects";

// One cart per visitor, found by a cookie. It is created on the first add, so browsing never writes.
export const CART_COOKIE = "w2l_cart";
const MAX_QTY = 9999;
const CART_DAYS = 60;

export interface CartLineView {
  id: number;
  kind: "product" | "kit";
  ref: string | null;
  projectId: number | null;
  title: string;
  href: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  availability: Availability;
  /** Gone from the shop (hidden, unpriced or deleted): cannot be bought. */
  missing: boolean;
  kitItems?: KitItem[];
}

export interface CartView {
  id: string | null;
  lines: CartLineView[];
  subtotal: number;
  count: number;
  /** True when a line cannot be bought as it stands (missing or out of stock). */
  blocked: boolean;
}

const EMPTY: CartView = { id: null, lines: [], subtotal: 0, count: 0, blocked: false };

function validQty(q: unknown): number {
  const n = Math.floor(Number(q));
  if (!Number.isFinite(n) || n < 1 || n > MAX_QTY) throw new Error(`Quantity must be a whole number from 1 to ${MAX_QTY}.`);
  return n;
}

/** The visitor's cart id from the cookie, if it still exists. Read-only: safe in server components. */
export async function currentCartId(): Promise<string | null> {
  const id = (await cookies()).get(CART_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await queryOne("select id from carts where id = $1", [id]);
  return row?.id ?? null;
}

/** The cart id, creating the cart and its cookie when needed. Only in server actions and route handlers. */
export async function ensureCart(userId: number | null = null): Promise<string> {
  const existing = await currentCartId();
  if (existing) return existing;
  // A signed-in customer with no cookie (new device) picks up their latest cart.
  if (userId) {
    const own = await queryOne("select id from carts where user_id = $1 order by updated_at desc limit 1", [userId]);
    if (own) {
      await setCartCookie(own.id);
      return own.id;
    }
  }
  const id = randomUUID();
  await query("insert into carts (id, user_id) values ($1, $2)", [id, userId]);
  await setCartCookie(id);
  return id;
}

async function setCartCookie(id: string) {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_DAYS * 86400,
  });
}

async function touch(cartId: string) {
  await query("update carts set updated_at = now() where id = $1", [cartId]);
}

export async function addProductToCart(cartId: string, productId: number, quantity: number): Promise<{ title: string }> {
  const qty = validQty(quantity);
  const p = await queryOne(
    `select p.ref, p.title from supplier_products p left join product_settings ps on ps.supplier = p.supplier and ps.ref = p.ref
     where p.id = $1 and p.price_ngn is not null and not coalesce(ps.hidden, false)`,
    [productId],
  );
  if (!p) throw new Error("That product is no longer available.");
  const avail = (await getProductsByRef([p.ref])).get(p.ref);
  if (!avail || avail.availability === "out") throw new Error("That product is out of stock.");
  await query(
    `insert into cart_lines (cart_id, supplier, ref, quantity) values ($1, $2, $3, $4)
     on conflict (cart_id, supplier, ref) where ref is not null do update set quantity = least(cart_lines.quantity + excluded.quantity, ${MAX_QTY})`,
    [cartId, SUPPLIER, p.ref, qty],
  );
  await touch(cartId);
  return { title: p.title };
}

export async function addKitToCart(cartId: string, projectId: number, quantity: number): Promise<{ title: string }> {
  const qty = validQty(quantity);
  const pr = await queryOne("select title from projects where id = $1 and published", [projectId]);
  if (!pr) throw new Error("That project is not available.");
  const items = (await priceKits([projectId])).get(projectId) ?? [];
  if (items.length === 0) throw new Error("This kit has no components yet.");
  // A part that is out of stock does not stop the kit (we call to agree a swap or a short wait);
  // a part no longer sold at all does.
  if (items.some((i) => !i.product)) {
    throw new Error("Part of this kit is no longer sold. Add the other parts one by one, or request a quote.");
  }
  await query(
    `insert into cart_lines (cart_id, project_id, quantity) values ($1, $2, $3)
     on conflict (cart_id, project_id) where project_id is not null do update set quantity = least(cart_lines.quantity + excluded.quantity, ${MAX_QTY})`,
    [cartId, projectId, qty],
  );
  await touch(cartId);
  return { title: `${pr.title} kit` };
}

/** Adds the chosen kit parts one by one (for "Add selected items only"). */
export async function addKitPartsToCart(cartId: string, projectId: number, refs: string[], kits: number): Promise<number> {
  const n = validQty(kits);
  const items = ((await priceKits([projectId])).get(projectId) ?? []).filter((i) => refs.includes(i.ref) && i.product && i.product.availability !== "out");
  for (const i of items) await addProductToCart(cartId, i.product!.id, i.quantity * n);
  return items.length;
}

export async function setLineQuantity(cartId: string, lineId: number, quantity: number): Promise<void> {
  const n = Math.floor(Number(quantity));
  if (!Number.isFinite(n) || n < 0 || n > MAX_QTY) throw new Error("Quantity must be a whole number.");
  if (n === 0) await query("delete from cart_lines where id = $1 and cart_id = $2", [lineId, cartId]);
  else await query("update cart_lines set quantity = $3 where id = $1 and cart_id = $2", [lineId, cartId, n]);
  await touch(cartId);
}

export async function clearCart(cartId: string): Promise<void> {
  await query("delete from cart_lines where cart_id = $1", [cartId]);
}

export async function loadCart(cartId: string | null): Promise<CartView> {
  if (!cartId) return EMPTY;
  const rows = await query(
    `select l.id, l.ref, l.project_id, l.quantity, pr.title as project_title, pr.slug as project_slug, pr.image_url as project_image
     from cart_lines l left join projects pr on pr.id = l.project_id
     where l.cart_id = $1 order by l.added_at, l.id`,
    [cartId],
  );
  if (rows.length === 0) return { ...EMPTY, id: cartId };
  const products = await getProductsByRef(rows.filter((r) => r.ref).map((r) => r.ref));
  const kits = await priceKits(rows.filter((r) => r.project_id).map((r) => r.project_id));
  const lines: CartLineView[] = rows.map((r) => {
    if (r.ref) {
      const p = products.get(r.ref);
      return {
        id: r.id,
        kind: "product",
        ref: r.ref,
        projectId: null,
        title: p?.title ?? "No longer available",
        href: p ? productPath(p) : "/shop",
        image: p?.image ?? null,
        unitPrice: p?.price ?? 0,
        quantity: r.quantity,
        lineTotal: (p?.price ?? 0) * r.quantity,
        availability: p?.availability ?? "out",
        missing: !p,
      };
    }
    const items = kits.get(r.project_id) ?? [];
    const t = kitTotals(items);
    return {
      id: r.id,
      kind: "kit",
      ref: null,
      projectId: r.project_id,
      title: `${r.project_title} kit`,
      href: projectPath({ slug: r.project_slug }),
      image: r.project_image,
      unitPrice: t.kitPrice,
      quantity: r.quantity,
      lineTotal: t.kitPrice * r.quantity,
      availability: items.some((i) => !i.product) ? "out" : t.unavailable > 0 ? "low" : "in",
      missing: items.length === 0,
      kitItems: items,
    };
  });
  return {
    id: cartId,
    lines,
    subtotal: lines.reduce((n, l) => n + (l.missing ? 0 : l.lineTotal), 0),
    count: lines.length,
    blocked: lines.some((l) => l.missing || l.availability === "out"),
  };
}

export async function cartCount(cartId: string | null): Promise<number> {
  if (!cartId) return 0;
  return (await queryOne("select count(*)::int as n from cart_lines where cart_id = $1", [cartId]))?.n ?? 0;
}

/** On sign-in, the visitor's cart joins the customer's own cart, so nothing is lost on either device. */
export async function attachCartToUser(cartId: string | null, userId: number): Promise<void> {
  if (!cartId) return;
  await tx(async (c) => {
    const own = (await c.query("select id from carts where user_id = $1 and id <> $2 order by updated_at desc limit 1", [userId, cartId])).rows[0];
    if (own) {
      // Fold the older cart's lines into the current one, then drop it.
      await c.query(
        `insert into cart_lines (cart_id, supplier, ref, quantity, added_at)
         select $1, supplier, ref, quantity, added_at from cart_lines where cart_id = $2 and ref is not null
         on conflict (cart_id, supplier, ref) where ref is not null do update set quantity = greatest(cart_lines.quantity, excluded.quantity)`,
        [cartId, own.id],
      );
      await c.query(
        `insert into cart_lines (cart_id, project_id, quantity, added_at)
         select $1, project_id, quantity, added_at from cart_lines where cart_id = $2 and project_id is not null
         on conflict (cart_id, project_id) where project_id is not null do update set quantity = greatest(cart_lines.quantity, excluded.quantity)`,
        [cartId, own.id],
      );
      await c.query("delete from carts where id = $1", [own.id]);
    }
    await c.query("update carts set user_id = $2, updated_at = now() where id = $1", [cartId, userId]);
  });
}
