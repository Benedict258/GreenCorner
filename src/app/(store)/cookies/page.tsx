import { LegalDoc } from "@/components/store/LegalDoc";

export const metadata = { title: "Cookie policy" };

export default function Cookies() {
  return (
    <LegalDoc
      title="Cookie policy"
      lead="We use only the cookies the store needs to work. No advertising or tracking cookies."
      updated="13 October 2026"
      sections={[
        {
          id: "used",
          title: "Cookies we use",
          body: (
            <table>
              <thead><tr><th scope="col">Cookie</th><th scope="col">Why</th><th scope="col">How long</th></tr></thead>
              <tbody>
                <tr><td>w2l_cart</td><td>Remembers your cart</td><td>60 days</td></tr>
                <tr><td>w2l_session</td><td>Keeps you signed in to your account</td><td>30 days</td></tr>
              </tbody>
            </table>
          ),
        },
        { id: "storage", title: "Settings on your device", body: <p>We remember small choices on your device, such as closing the delivery banner. You can clear them in your browser at any time.</p> },
      ]}
    />
  );
}
