import { Icon } from "@/components/store/Icon";

export const metadata = {
  title: "About",
  description: "Waste2Light Store is the components and kits branch of Waste2Light Ltd, Bosso, Minna: the same parts we use in our labs, for every student, school and maker.",
};

const PARTNERS: [string, string][] = [
  ["FUTMINNA", "Mechatronics & Electronics Engineering"],
  ["RMRDC", "Niger State"],
  ["Niger State Government", ""],
  ["LEAP Africa", ""],
  ["Superior Minds Academy", ""],
  ["SPE Minna Chapter", "Society of Petroleum Engineers"],
];

export default function About() {
  return (
    <>
      <section className="hero" aria-labelledby="ab-title">
        <div className="container">
          <p className="hero__eyebrow">About</p>
          <h1 className="hero__title" id="ab-title">Waste2Light Store is the components and kits branch of Waste2Light Ltd.</h1>
          <p className="hero__sub">The same parts we use in our labs in Bosso, Minna, available to every student, school and maker.</p>
        </div>
      </section>
      <section className="section" aria-labelledby="story-title">
        <div className="container story">
          <div className="story__media photo" role="img" aria-label="Wind turbine and solar panel illustration"><img className="photo__img" src="/images/turbine.svg" alt="" /></div>
          <div className="story__text">
            <h2 className="section__title" id="story-title">Our story</h2>
            <p>Waste2Light started by turning discarded plastic bottles into rechargeable lanterns for students who study without steady power.</p>
            <p>From there we grew into Green Energy Corners in schools, STEM kits for young innovators, and a locally built 800W wind turbine prototype. This store brings the parts behind all of it to anyone who wants to build.</p>
          </div>
        </div>
      </section>
      <section className="section section--white" aria-labelledby="path-title">
        <div className="container">
          <h2 className="section__title" id="path-title">From bottles to a wind turbine</h2>
          <ol className="path">
            <li className="path__item"><span className="path__step">01</span><h3 className="path__title">Bottles to lanterns</h3><p className="path__text">Discarded plastic bottles become rechargeable study lanterns.</p></li>
            <li className="path__item"><span className="path__step">02</span><h3 className="path__title">Green Energy Corners</h3><p className="path__text">Small renewable-energy labs set up inside schools.</p></li>
            <li className="path__item"><span className="path__step">03</span><h3 className="path__title">STEM Innovation Kits</h3><p className="path__text">Hands-on kits that let students build, test and learn.</p></li>
            <li className="path__item"><span className="path__step">04</span><h3 className="path__title">An 800W wind turbine</h3><p className="path__text">A prototype built in Minna, with a 105cm locally cast fibreglass blade.</p></li>
          </ol>
        </div>
      </section>
      <section className="section" aria-label="Mission">
        <div className="container"><div className="mission"><p className="mission__label">Our mission</p><p className="mission__text">Building a cleaner future through renewable energy and innovation.</p></div></div>
      </section>
      <section className="section section--white" aria-labelledby="focus-title">
        <div className="container">
          <h2 className="section__title" id="focus-title">What we focus on</h2>
          <div className="focus">
            <div className="focus__item"><span className="focus__icon"><Icon name="sun" /></span><h3 className="focus__title">Renewable energy</h3><p className="focus__text">Solar, wind and storage that people in Nigeria can build and fix themselves.</p></div>
            <div className="focus__item"><span className="focus__icon"><Icon name="loop" /></span><h3 className="focus__title">Circular economy</h3><p className="focus__text">Waste is a resource. We design products around what would be thrown away.</p></div>
            <div className="focus__item"><span className="focus__icon"><Icon name="cap" /></span><h3 className="focus__title">STEM education</h3><p className="focus__text">Projects and kits that make science and engineering practical in the classroom.</p></div>
            <div className="focus__item"><span className="focus__icon"><Icon name="tools" /></span><h3 className="focus__title">Local manufacturing</h3><p className="focus__text">Building and casting parts in Minna, and training people to do the same.</p></div>
          </div>
        </div>
      </section>
      <section className="section" aria-labelledby="impact-title">
        <div className="container">
          <h2 className="section__title" id="impact-title">Impact so far</h2>
          <div className="impact">
            <div className="impact__item"><p className="impact__num">50</p><p className="impact__label">rechargeable study lanterns delivered</p></div>
            <div className="impact__item"><p className="impact__num">10</p><p className="impact__label">STEM Innovation Kits distributed</p></div>
            <div className="impact__item"><p className="impact__num">800W</p><p className="impact__label">wind turbine prototype built in Minna</p></div>
            <div className="impact__item"><p className="impact__num">105cm</p><p className="impact__label">locally cast fibreglass turbine blade</p></div>
          </div>
        </div>
      </section>
      <section className="section section--white" aria-labelledby="partners-title">
        <div className="container">
          <h2 className="section__title" id="partners-title">Our partners</h2>
          <div className="partners">{PARTNERS.map(([n, s]) => <div key={n} className="partner"><span className="partner__name">{n}</span><span className="partner__sub">{s}</span></div>)}</div>
        </div>
      </section>
      <section className="section" aria-label="Team">
        <div className="container">
          <div className="team">
            <div><h2 className="team__title">Meet the full team</h2><p className="team__text">See everyone behind Waste2Light on our main website.</p></div>
            <a className="btn btn--secondary" href="https://waste2light.com/about">waste2light.com/about <Icon name="arrow" /></a>
          </div>
        </div>
      </section>
    </>
  );
}
