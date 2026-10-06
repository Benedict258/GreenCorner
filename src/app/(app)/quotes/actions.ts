"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { deleteQuote, duplicateQuote, saveQuote, type LineInput } from "@/lib/quotes";
import { clearCart } from "@/lib/shop";

// Returns errors instead of throwing: production builds hide thrown messages from the browser.
export async function saveQuoteAction(id: number | null, name: string, notes: string, lines: LineInput[], fromCart = false): Promise<{ id: number } | { error: string }> {
  await requireAdmin();
  try {
    const saved = await saveQuote(id, String(name).slice(0, 200), String(notes).slice(0, 2000), lines);
    // The cart has become this quote. Lines removed in the builder are not left behind in the cart.
    if (fromCart) {
      await clearCart();
      revalidatePath("/", "layout");
    }
    revalidatePath("/quotes");
    return { id: saved };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function duplicateQuoteAction(id: number) {
  await requireAdmin();
  const copy = await duplicateQuote(id);
  redirect(`/quotes/${copy}`);
}

export async function deleteQuoteAction(id: number) {
  await requireAdmin();
  await deleteQuote(id);
  redirect("/quotes");
}
