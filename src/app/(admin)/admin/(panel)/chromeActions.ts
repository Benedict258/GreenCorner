"use server";
import { requireStaff } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/messaging";

export async function markNotificationsReadAction(id?: number) {
  await requireStaff();
  await markNotificationsRead(id);
}
