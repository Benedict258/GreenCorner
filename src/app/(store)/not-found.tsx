import Link from "next/link";
import { Icon } from "@/components/store/Icon";

export default function NotFound() {
  return (
    <div className="container">
      <section className="status" aria-labelledby="nf-title" style={{ padding: "64px 0" }}>
        <span className="status__badge status__badge--warn"><Icon name="search" /></span>
        <h1 className="status__title" id="nf-title">We couldn&apos;t find that page</h1>
        <p className="status__text">It may have moved, or the product is no longer sold.</p>
        <div className="status__actions">
          <Link className="btn btn--primary btn--lg" href="/shop">Shop components</Link>
          <Link className="btn btn--secondary btn--lg" href="/">Go to the home page</Link>
        </div>
      </section>
    </div>
  );
}
