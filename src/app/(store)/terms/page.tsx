import Link from "next/link";
import { LegalDoc } from "@/components/store/LegalDoc";

export const metadata = { title: "Terms of use" };

export default function Terms() {
  return (
    <LegalDoc
      title="Terms of use"
      lead="These terms apply when you use the Waste2Light Store website and when you order from it."
      updated="13 October 2026"
      sections={[
        { id: "who", title: "Who we are", body: <p>The Waste2Light Store is run by Waste2Light Ltd, Bosso, Minna, Niger State, Nigeria. You can reach us at info@waste2light.com or +234 813 439 2943.</p> },
        {
          id: "orders",
          title: "Orders and prices",
          body: (
            <>
              <p>Prices are in Nigerian naira and include our service. Prices shown in the shop can change until you pay; the price of your order is fixed when you check out.</p>
              <p>An order is accepted once it is paid and we have confirmed it with you by phone. If we cannot supply a part, we refund it as set out in the <Link href="/refunds">refund policy</Link>.</p>
            </>
          ),
        },
        { id: "delivery", title: "Delivery", body: <p>We deliver in Minna, Niger State only, or you can pick up your order in Bosso. See <Link href="/delivery">Delivery and pickup</Link>.</p> },
        { id: "quotes", title: "Quotations", body: <p>A quotation is valid until the date shown on it. Draft quotations downloaded from the website are estimates only and are not an offer.</p> },
        {
          id: "use",
          title: "Using this website",
          body: (
            <>
              <p>You may browse and buy for your own use, your school or your organisation. You may not copy the catalog, prices or photos in bulk, or use scripts, scrapers or other automated tools to collect them. We limit and block automated access.</p>
              <p>Project guides are for learning. Electronics and batteries can be dangerous if misused: follow the safety notes and supervise children.</p>
            </>
          ),
        },
        { id: "law", title: "Law", body: <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p> },
      ]}
    />
  );
}
