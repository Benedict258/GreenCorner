import Link from "next/link";
import { LegalDoc } from "@/components/store/LegalDoc";

export const metadata = { title: "Refund policy" };

export default function Refunds() {
  return (
    <LegalDoc
      title="Refund policy"
      lead="If something goes wrong with your order, we put it right: a replacement or your money back."
      updated="13 October 2026"
      sections={[
        {
          id: "unavailable",
          title: "When a part is unavailable",
          body: <p>Most parts are bought for you after you pay. If a part turns out to be unavailable, we call you and refund that part in full. If you prefer, we can offer a similar part instead; we only swap with your agreement.</p>,
        },
        {
          id: "faulty",
          title: "Faulty or wrong items",
          body: (
            <>
              <p>Check your order when it arrives. If an item is faulty or not what you ordered, tell us within 7 days of delivery or pickup, by phone, WhatsApp or email, with your order number.</p>
              <p>Bring or send the item back with its packaging. Once we have checked it we replace it, or refund it if no replacement is available.</p>
            </>
          ),
        },
        {
          id: "change",
          title: "Changing your mind",
          body: <p>Unused items in their original packaging can be returned within 7 days for a refund of the item price. Kits that have been opened, and parts that have been soldered, cut or wired, cannot be returned unless they were faulty.</p>,
        },
        {
          id: "how",
          title: "How refunds are paid",
          body: (
            <ul>
              <li>Paid with Paystack: refunded to the same card or account. Banks usually take 5 to 10 working days to show it.</li>
              <li>Paid by bank transfer: refunded to the account you paid from.</li>
              <li>We email you when a refund is made.</li>
            </ul>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: <p>Call +234 813 439 2943, WhatsApp +234 807 878 7646 or email info@waste2light.com. See also <Link href="/delivery">Delivery and pickup</Link>.</p>,
        },
      ]}
    />
  );
}
