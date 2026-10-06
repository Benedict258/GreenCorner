"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { addToCart, cartCount, clearCart, setCartQuantity } from "@/lib/shop";

// The cart count is in the header, so cart changes refresh the whole app layout.
const refresh = () => revalidatePath("/", "layout");

// Returns errors instead of throwing: production builds hide thrown messages from the browser.
export async function addToCartAction(ref: string, quantity: number): Promise<{ message: string; count: number } | { error: string }> {
  await requireAdmin();
  try {
    const { name } = await addToCart(String(ref), quantity);
    refresh();
    return { message: `Added ${name}`, count: await cartCount() };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function setCartQuantityAction(componentId: number, form: FormData) {
  await requireAdmin();
  await setCartQuantity(componentId, Number(form.get("quantity")));
  refresh();
}

export async function removeFromCartAction(componentId: number) {
  await requireAdmin();
  await setCartQuantity(componentId, 0);
  refresh();
}

export async function clearCartAction() {
  await requireAdmin();
  await clearCart();
  refresh();
  redirect("/shop");
}
