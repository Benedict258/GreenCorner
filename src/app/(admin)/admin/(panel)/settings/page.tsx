import { currentStaff } from "@/lib/auth";
import { query } from "@/lib/db";
import { emailEnabled, whatsappEnabled } from "@/lib/messaging";
import { paystackMode } from "@/lib/paystack";
import { getSettings } from "@/lib/settings";
import SettingsForm from "./SettingsForm";
import { StoreSettingsForm } from "./StoreSettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [s, rows, staff] = await Promise.all([getSettings(), query("select key, value from settings"), currentStaff()]);
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value as string]));
  const pay = paystackMode();
  const site = process.env.SITE_URL;
  return (
    <>
      <h1>Settings</h1>

      <div className="card">
        <h2>Connections</h2>
        <table>
          <tbody>
            <tr><td>Paystack</td><td>{pay === "live" ? "Live: real payments" : pay === "test" ? "Test mode: no real money moves" : "Not connected. Add PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY in Vercel."}</td></tr>
            <tr><td>Paystack webhook</td><td>{site ? <code>{site}/api/paystack/webhook</code> : "Set SITE_URL first"} <span className="muted small">(paste this in Paystack: Settings, API Keys and Webhooks)</span></td></tr>
            <tr><td>Email (Resend)</td><td>{emailEnabled() ? `On, sending from ${process.env.MAIL_FROM}` : "Not connected. Add RESEND_API_KEY and MAIL_FROM."}</td></tr>
            <tr><td>WhatsApp</td><td>{whatsappEnabled() ? `On${process.env.WHATSAPP_TEMPLATE ? `, template ${process.env.WHATSAPP_TEMPLATE}` : " (free text only inside a 24-hour chat)"}` : "Not connected. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID."}</td></tr>
            <tr><td>Site address</td><td>{site ?? "Not set. Add SITE_URL (for links in emails and Paystack)."}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Store</h2>
        <StoreSettingsForm v={v} owner={staff?.role === "owner"} />
      </div>

      <div className="card">
        <h2>Microscale sync</h2>
        <SettingsForm s={s} />
        <p className="muted small">
          The scheduled job checks these times every hour and runs the sync for any slot that is due, so a change here applies from the next hour with no redeploy.
        </p>
      </div>
    </>
  );
}
