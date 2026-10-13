import Link from "next/link";
import { Icon } from "./Icon";

export function StoreFooter({ categories, projects }: { categories: string[]; projects: { slug: string; title: string }[] }) {
  return (
    <footer className="site-footer">
      <div className="footer__in">
        <div className="footer__top">
          <div className="footer__brand">
            <p className="footer__word">Waste<b>2</b>Light</p>
            <p className="footer__about">The components and kits branch of Waste2Light Ltd. Power. Learn. Build.</p>
          </div>
          <nav aria-label="Shop categories">
            <h2 className="footer__heading">Shop</h2>
            <ul className="footer__list">
              {categories.slice(0, 5).map((c) => <li key={c}><Link href={`/shop?category=${encodeURIComponent(c)}`}>{c}</Link></li>)}
              <li><Link href="/shop">All components</Link></li>
            </ul>
          </nav>
          <nav aria-label="Projects">
            <h2 className="footer__heading">Projects</h2>
            <ul className="footer__list">
              {projects.slice(0, 4).map((p) => <li key={p.slug}><Link href={`/projects/${p.slug}`}>{p.title}</Link></li>)}
              <li><Link href="/quote-request">Request a quote</Link></li>
            </ul>
          </nav>
          <nav aria-label="Help">
            <h2 className="footer__heading">Help</h2>
            <ul className="footer__list">
              <li><Link href="/track">Track order</Link></li>
              <li><Link href="/delivery">Delivery and pickup</Link></li>
              <li><Link href="/refunds">Refund policy</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </nav>
          <nav aria-label="Waste2Light">
            <h2 className="footer__heading">Waste2Light</h2>
            <ul className="footer__list">
              <li><Link href="/about">About</Link></li>
              <li><a href="https://waste2light.com">waste2light.com</a></li>
              <li><a href="https://waste2light.com/green-energy-corner">Green Energy Corner</a></li>
              <li><Link href="/contact">Partner with us</Link></li>
            </ul>
          </nav>
        </div>
        <address className="footer__contact">
          <p className="footer__contact-item"><Icon name="pin" /><span>Waste2Light Ltd<br />Bosso, Minna, Niger State, Nigeria</span></p>
          <p className="footer__contact-item"><Icon name="mail" /><span><a href="mailto:info@waste2light.com">info@waste2light.com</a></span></p>
          <p className="footer__contact-item"><Icon name="phone" /><span><a href="tel:+2348134392943">+234 813 439 2943</a><br />WhatsApp <a href="https://wa.me/2348078787646">+234 807 878 7646</a></span></p>
          <p className="footer__contact-item"><Icon name="globe" /><span><a href="https://www.tiktok.com/@waste2light">TikTok @waste2light</a> · <a href="https://www.linkedin.com/company/waste2light">LinkedIn</a></span></p>
        </address>
        <div className="footer__pay"><span>Secure payments by Paystack</span><span className="pay-mark">Card</span><span className="pay-mark">Bank transfer</span><span className="pay-mark">USSD</span></div>
        <div className="footer__bottom">
          <p>© Waste2Light Ltd. All rights reserved.</p>
          <div className="footer__legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link></div>
        </div>
      </div>
      <a className="wa-float" href="https://wa.me/2348078787646" aria-label="Chat with us on WhatsApp"><Icon name="whatsapp" /><span className="wa-float__label">Chat with us</span></a>
    </footer>
  );
}
