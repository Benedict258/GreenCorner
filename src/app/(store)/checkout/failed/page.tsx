import Link from "next/link";
import { Icon } from "@/components/store/Icon";

export const metadata = { title: "Payment not completed", robots: { index: false } };

export default function PaymentFailed() {
  return (
    <div className="container">
      <section className="status" aria-labelledby="st-title">
        <span className="status__badge status__badge--warn"><Icon name="alert" /></span>
        <h1 className="status__title" id="st-title">Payment not completed</h1>
        <p className="status__text">Your cart is saved. Nothing has been lost, and you can try again whenever you are ready.</p>
        <div className="status__actions">
          <Link className="btn btn--primary btn--lg" href="/checkout">Try again</Link>
          <Link className="btn btn--secondary btn--lg" href="/quote-request">Request a quote instead</Link>
        </div>
        <p className="status__text">If money left your account, message us on WhatsApp and we will check it for you.</p>
        <a className="btn btn--text" href="https://wa.me/2348078787646"><Icon name="whatsapp" />Chat on WhatsApp</a>
      </section>
    </div>
  );
}
