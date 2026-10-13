import { LegalDoc } from "@/components/store/LegalDoc";

export const metadata = { title: "Privacy policy" };

export default function Privacy() {
  return (
    <LegalDoc
      title="Privacy policy"
      lead="We collect only what we need to deliver your order and answer your questions, and we never sell it."
      updated="13 October 2026"
      sections={[
        { id: "what", title: "What we collect", body: <ul><li>Your name, phone number, email and delivery address when you order or ask for a quote.</li><li>Your order and quote history, and messages you send us.</li><li>Basic technical data (such as your IP address) to keep the site secure and stop abuse.</li></ul> },
        { id: "why", title: "Why we use it", body: <ul><li>To process, deliver and support your orders, and to call you to confirm them.</li><li>To send order updates, receipts and quotations by email or WhatsApp.</li><li>To protect the website from fraud and automated copying.</li></ul> },
        { id: "payments", title: "Payments", body: <p>Online payments are handled by Paystack. We never see or store your card details.</p> },
        { id: "sharing", title: "Who we share it with", body: <p>Only with the services that help us run the store: Paystack (payments), our email provider (Resend), WhatsApp (messages you agree to receive) and our hosting providers. We do not sell your data.</p> },
        { id: "rights", title: "Your rights", body: <p>You can ask to see, correct or delete your data at any time by emailing info@waste2light.com. This policy follows the Nigeria Data Protection Act 2023.</p> },
      ]}
    />
  );
}
