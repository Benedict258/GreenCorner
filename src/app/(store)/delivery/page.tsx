import Link from "next/link";
import { LegalDoc } from "@/components/store/LegalDoc";
import { getSetting } from "@/lib/store/storeSettings";

export const metadata = { title: "Delivery and pickup", description: "Free delivery in Minna, Niger State, or pickup at Waste2Light, Bosso." };

export default async function Delivery() {
  const hours = await getSetting("hours_weekday").catch(() => "");
  return (
    <LegalDoc
      title="Delivery and pickup"
      lead="Everything you order is delivered free in Minna, or ready for pickup at our base in Bosso."
      updated="13 October 2026"
      sections={[
        {
          id: "minna",
          title: "Delivery in Minna",
          body: (
            <>
              <p>We deliver in Minna, Niger State only for now. Delivery is free on every order.</p>
              <p>After you pay, we call you within 1 working day to confirm your order, your address and a time that suits you. Please keep your phone on.</p>
              <table>
                <thead><tr><th scope="col">Where</th><th scope="col">Cost</th><th scope="col">When</th></tr></thead>
                <tbody>
                  <tr><td>Minna, Niger State</td><td>Free</td><td>We agree this when we call you</td></tr>
                  <tr><td>Outside Minna</td><td>Not available yet</td><td>Message us on WhatsApp to ask</td></tr>
                </tbody>
              </table>
            </>
          ),
        },
        {
          id: "pickup",
          title: "Pickup at Bosso",
          body: (
            <>
              <p>Choose pickup at checkout and collect your order from Waste2Light, Bosso, Minna. We call you when it is ready.</p>
              <ul>
                <li>Bring your order number (W2L-ORD-xxxx) or the phone you used at checkout.</li>
                <li>{hours ? `Opening hours: ${hours}.` : "Call or WhatsApp us before you come so we can have it ready."}</li>
              </ul>
            </>
          ),
        },
        {
          id: "large",
          title: "Large and class orders",
          body: (
            <>
              <p className="callout">For large orders we&apos;ll agree delivery or pickup with you when we call. Schools can send a cart or a project as a quote request instead of paying online.</p>
              <p>Use <Link href="/quote-request">Request a quote</Link> and we will call you with an official quotation.</p>
            </>
          ),
        },
        {
          id: "payment",
          title: "Payment",
          body: (
            <>
              <p>You pay securely on Paystack&apos;s page with a card, bank transfer or USSD. We never see your card details. You can also pay by direct bank transfer to Waste2Light; we confirm your order when the money arrives.</p>
              <p>Your price is locked when you check out.</p>
            </>
          ),
        },
        {
          id: "refunds",
          title: "Refund policy",
          body: <p>If a part cannot be supplied after you pay, we refund that part and call you. Read the full <Link href="/refunds">refund policy</Link>.</p>,
        },
      ]}
    />
  );
}
