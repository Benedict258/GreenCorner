"use server";
import { revalidatePath } from "next/cache";
import { requireOwner, requireStaff } from "@/lib/auth";
import { audit } from "@/lib/guard";
import { setFeatured, setMarkup, setStock, setVisibility } from "@/lib/admin/products";

type R = { ok?: string; error?: string };
const refresh = () => {
  revalidatePath("/admin/products", "layout");
  revalidatePath("/admin/stock");
};

/** Prices are an owner decision. An empty markup goes back to the default. */
export async function setMarkupAction(ref: string, value: string): Promise<R> {
  const s = await requireOwner().catch(() => null);
  if (!s) return { error: "Only an owner can change prices." };
  const v = value.trim() === "" ? null : Number(value);
  try {
    await setMarkup(ref, v);
    await audit(s.email, "markup", "product", ref, { markup: v });
    refresh();
    return { ok: "Saved" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setVisibilityAction(ref: string, visible: boolean): Promise<R> {
  const s = await requireStaff();
  await setVisibility(ref, !visible);
  await audit(s.email, visible ? "product_shown" : "product_hidden", "product", ref);
  refresh();
  return { ok: visible ? "Visible" : "Hidden" };
}

export async function setFeaturedAction(ref: string, featured: boolean): Promise<R> {
  const s = await requireStaff();
  await setFeatured(ref, featured);
  await audit(s.email, "product_featured", "product", ref, { featured });
  refresh();
  return { ok: "Saved" };
}

export async function setStockAction(ref: string, value: string): Promise<R> {
  const s = await requireStaff();
  try {
    await setStock(ref, Number(value || 0));
    await audit(s.email, "stock", "product", ref, { quantity: Number(value || 0) });
    refresh();
    return { ok: "Saved" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
