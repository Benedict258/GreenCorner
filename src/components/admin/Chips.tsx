import type { OrderStatus } from "@/lib/store/orders";
import { STATUS_LABEL } from "@/lib/store/orders";
import type { RequestStatus } from "@/lib/store/quoteRequests";
import { REQUEST_STATUS_LABEL } from "@/lib/store/quoteRequests";

const ORDER_CLASS: Record<OrderStatus, string> = {
  pending_payment: "chip q-closed",
  paid: "chip s-new",
  confirmed: "chip s-confirmed",
  sourcing: "chip s-sourcing",
  ready: "chip s-ready",
  out_for_delivery: "chip s-out",
  ready_for_pickup: "chip s-out",
  completed: "chip s-done",
  cancelled: "chip s-cancel",
  refunded: "chip s-refund",
};

/** "New" in the admin means paid and not yet confirmed (the customer-facing word is "Paid"). */
export function OrderChip({ status }: { status: OrderStatus }) {
  return <span className={ORDER_CLASS[status]}>{status === "paid" ? "New" : STATUS_LABEL[status]}</span>;
}

export function RequestChip({ status }: { status: RequestStatus }) {
  return <span className={`chip q-${status}`}>{REQUEST_STATUS_LABEL[status]}</span>;
}
