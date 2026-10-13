import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { ProductCard, ProjectCard } from "@/components/store/Cards";
import { Icon } from "@/components/store/Icon";
import { categoryIcon, countProducts, featuredProducts, listCategories } from "@/lib/store/catalog";
import { listProjects } from "@/lib/store/projects";

export const metadata = { title: { absolute: "Waste2Light Store: components and kits for Nigeria's builders" } };

const PARTNERS: [string, string][] = [
  ["FUTMINNA", "Mechatronics & Electronics Engineering"],
  ["RMRDC", "Niger State"],
  ["Niger State Government", ""],
  ["LEAP Africa", ""],
  ["Superior Minds Academy", ""],
  ["SPE Minna Chapter", "Society of Petroleum Engineers"],
];

export default async function Home() {
  const [total, categories, projects, popular] = await Promise.all([
    countProducts().catch(() => 0),
    listCategories().catch(() => []),
    listProjects({}, { limit: 4 }).catch(() => []),
    featuredProducts(8).catch(() => []),
  ]);
  const totalLabel = total >= 100 ? `${Math.floor(total / 100) * 100}+` : String(total);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero__in">
          <div className="hero__copy">
            <p className="hero__eyebrow">Waste2Light Store · Power. Learn. Build.</p>
            <h1 className="hero__title" id="hero-title">Components and kits for Nigeria&apos;s next builders.</h1>
            <p className="hero__sub">From one sensor to a full classroom of STEM kits: buy the parts you need, or a complete project kit, delivered in Minna.</p>
            <div className="hero__actions">
              <Link className="btn btn--lg btn--white" href="/shop">Shop components</Link>
              <Link className="btn btn--lg btn--light" href="/projects">Explore projects</Link>
            </div>
            <form className="hero__search" role="search" action="/shop">
              <Icon name="search" />
              <label className="sr-only" htmlFor="hero-q">Search components</label>
              <input id="hero-q" name="q" type="search" placeholder={`Search ${totalLabel} components, e.g. Arduino, solar panel, servo`} />
              <button className="btn btn--primary" type="submit">Search</button>
            </form>
          </div>
          <div className="hero__media photo photo--dark" role="img" aria-label="The Waste2Light mark">
            <LogoMark className="hero__mark" />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="start-title">
        <div className="container">
          <div className="section__head"><h2 className="section__title" id="start-title">Three ways to get started</h2></div>
          <div className="grid grid--3">
            <article className="start-card">
              <div className="start-card__icon"><Icon name="cart" /></div>
              <h3 className="start-card__title">Buy components</h3>
              <p className="start-card__text">Add to cart and pay online with card, transfer or USSD.</p>
              <Link className="start-card__link" href="/shop">Shop components <Icon name="arrow" /></Link>
            </article>
            <article className="start-card">
              <div className="start-card__icon"><Icon name="box" /></div>
              <h3 className="start-card__title">Build a project</h3>
              <p className="start-card__text">Pick a project, get every part in one kit.</p>
              <Link className="start-card__link" href="/projects">Explore projects <Icon name="arrow" /></Link>
            </article>
            <article className="start-card">
              <div className="start-card__icon"><Icon name="file" /></div>
              <h3 className="start-card__title">Request a quote</h3>
              <p className="start-card__text">For schools and organisations: send us your list, we&apos;ll call you.</p>
              <Link className="start-card__link" href="/quote-request">Request a quote <Icon name="arrow" /></Link>
            </article>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="section section--white" aria-labelledby="cats-title">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title" id="cats-title">Shop by category</h2>
              <Link className="section__link" href="/shop">All {total.toLocaleString("en-NG")} components <Icon name="arrow" /></Link>
            </div>
            <div className="grid grid--cats">
              {categories.slice(0, 10).map((c) => (
                <Link key={c.name} className="cat-tile" href={`/shop?category=${encodeURIComponent(c.name)}`}>
                  <span className="cat-tile__icon"><Icon name={categoryIcon(c.name)} /></span>
                  <span className="cat-tile__name">{c.name}</span>
                  <span className="cat-tile__count">{c.count.toLocaleString("en-NG")} items</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section className="section" aria-labelledby="proj-title">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title" id="proj-title">Featured projects</h2>
              <Link className="section__link" href="/projects">See all projects <Icon name="arrow" /></Link>
            </div>
            <div className="grid grid--4">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="section section--white" aria-labelledby="pop-title">
          <div className="container">
            <div className="section__head">
              <h2 className="section__title" id="pop-title">Popular components</h2>
              <Link className="section__link" href="/shop">Shop all <Icon name="arrow" /></Link>
            </div>
            <div className="row-scroll" role="list" tabIndex={0} aria-label="Popular components, scroll sideways">
              {popular.map((p) => <ProductCard key={p.id} p={p} role="listitem" />)}
            </div>
          </div>
        </section>
      )}

      <section className="section" aria-labelledby="about-title">
        <div className="container about">
          <div className="about__media photo" role="img" aria-label="The 800W wind turbine prototype built in Minna">
            <img className="photo__img" src="/images/turbine.svg" alt="" />
          </div>
          <div>
            <h2 className="about__title" id="about-title">Lighting tomorrow with today&apos;s waste.</h2>
            <p className="about__text">Waste2Light started by turning discarded plastic bottles into rechargeable lanterns. Today we build renewable-energy systems, run Green Energy Corners in schools and train young innovators in Minna. This store is our components and kits branch: the same parts we use in our labs, available to every student, school and maker.</p>
            <div className="about__links">
              <Link className="btn btn--secondary" href="/about">Our story</Link>
              <a className="btn btn--text" href="https://waste2light.com">Visit waste2light.com</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--white" aria-labelledby="impact-title">
        <div className="container">
          <div className="section__head"><h2 className="section__title" id="impact-title">Impact so far</h2></div>
          <div className="impact">
            <div className="impact__item"><p className="impact__num">50</p><p className="impact__label">rechargeable study lanterns delivered</p></div>
            <div className="impact__item"><p className="impact__num">10</p><p className="impact__label">STEM Innovation Kits distributed</p></div>
            <div className="impact__item"><p className="impact__num">800W</p><p className="impact__label">wind turbine prototype built in Minna</p></div>
            <div className="impact__item"><p className="impact__num">105cm</p><p className="impact__label">locally cast fibreglass turbine blade</p></div>
          </div>
        </div>
      </section>

      <section className="section" id="schools" aria-labelledby="schools-title">
        <div className="container">
          <div className="schools">
            <div>
              <h2 className="schools__title" id="schools-title">Bring hands-on renewable energy into your classroom.</h2>
              <p className="schools__text">Choose a project, tell us how many students, and we&apos;ll send a formal quotation and set it up with you.</p>
            </div>
            <div className="schools__actions">
              <Link className="btn btn--lg btn--primary" href="/quote-request">Request a quote for your school</Link>
              <a className="btn btn--lg btn--secondary" href="https://waste2light.com/green-energy-corner">See the Green Energy Corner</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--white" aria-labelledby="how-title">
        <div className="container">
          <div className="section__head"><h2 className="section__title" id="how-title">How it works</h2></div>
          <ol className="steps">
            <li className="step"><span className="step__num">STEP 1</span><span className="step__icon"><Icon name="list" /></span><h3 className="step__title">Choose your parts or a project</h3><p className="step__text">Search the shop, or pick a ready-made kit.</p></li>
            <li className="step"><span className="step__num">STEP 2</span><span className="step__icon"><Icon name="card" /></span><h3 className="step__title">Pay online or request a quote</h3><p className="step__text">Card, transfer or USSD. Schools can ask for a quotation.</p></li>
            <li className="step"><span className="step__num">STEP 3</span><span className="step__icon"><Icon name="phone" /></span><h3 className="step__title">We call to confirm</h3><p className="step__text">A real person checks your order with you.</p></li>
            <li className="step"><span className="step__num">STEP 4</span><span className="step__icon"><Icon name="truck" /></span><h3 className="step__title">Delivery or pickup in Minna</h3><p className="step__text">Free delivery in Minna, or collect at Bosso.</p></li>
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="partners-title">
        <div className="container">
          <div className="section__head"><h2 className="section__title" id="partners-title">Our partners</h2></div>
          <div className="partners">
            {PARTNERS.map(([name, sub]) => (
              <div key={name} className="partner"><span className="partner__name">{name}</span><span className="partner__sub">{sub}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta" aria-labelledby="cta-title">
        <div className="container cta__in">
          <h2 className="cta__title" id="cta-title">Ready to build?</h2>
          <div className="cta__actions">
            <Link className="btn btn--lg btn--primary" href="/shop">Start shopping</Link>
            <a className="btn btn--lg btn--dark-outline" href="https://wa.me/2348078787646"><Icon name="whatsapp" />Chat on WhatsApp</a>
          </div>
        </div>
      </section>
    </>
  );
}
