import { Icon } from "@/components/store/Icon";
import { getSetting } from "@/lib/store/storeSettings";
import { ContactForm } from "./ContactForm";

export const metadata = { title: "Contact", description: "Call, WhatsApp, email or visit Waste2Light in Bosso, Minna, Niger State." };

export default async function Contact() {
  const [weekday, saturday] = await Promise.all([getSetting("hours_weekday").catch(() => ""), getSetting("hours_saturday").catch(() => "")]);
  return (
    <div className="container">
      <div className="page-head">
        <h1 className="page-head__title">Contact</h1>
        <p className="page-head__sub">Questions about a part, an order or a class kit? Call, message or visit us in Bosso.</p>
      </div>
      <div className="contact">
        <div className="card">
          <h2 className="card__title">Waste2Light Ltd</h2>
          <address className="info">
            <div className="info__item"><span className="info__icon"><Icon name="pin" /></span><div><p className="info__label">Address</p><p className="info__value">Bosso, Minna, Niger State, Nigeria</p></div></div>
            <div className="info__item"><span className="info__icon"><Icon name="phone" /></span><div><p className="info__label">Phone</p><p className="info__value"><a href="tel:+2348134392943">+234 813 439 2943</a></p></div></div>
            <div className="info__item"><span className="info__icon"><Icon name="whatsapp" /></span><div><p className="info__label">WhatsApp</p><p className="info__value"><a href="https://wa.me/2348078787646">+234 807 878 7646</a></p></div></div>
            <div className="info__item"><span className="info__icon"><Icon name="mail" /></span><div><p className="info__label">Email</p><p className="info__value"><a href="mailto:info@waste2light.com">info@waste2light.com</a></p></div></div>
            <div className="info__item">
              <span className="info__icon"><Icon name="clock" /></span>
              <div>
                <p className="info__label">Opening hours</p>
                {weekday || saturday ? (
                  <dl className="hours">
                    {weekday && <><dt>Monday to Friday</dt><dd>{weekday}</dd></>}
                    {saturday && <><dt>Saturday</dt><dd>{saturday}</dd></>}
                  </dl>
                ) : <p className="info__value">Call or WhatsApp us before you visit.</p>}
              </div>
            </div>
          </address>
          <div className="map" style={{ padding: 0, overflow: "hidden" }}>
            <iframe
              title="Map of Bosso, Minna"
              src="https://www.openstreetmap.org/export/embed.html?bbox=6.495%2C9.625%2C6.555%2C9.68&layer=mapnik&marker=9.6525%2C6.5245"
              style={{ border: 0, width: "100%", height: "100%", minHeight: 240 }}
              loading="lazy"
            />
          </div>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
