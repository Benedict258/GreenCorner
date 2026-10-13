import { query, queryOne } from "../db";

// Store settings kept in the settings table (edited in Admin > Settings).

export async function getSetting(key: string, fallback = ""): Promise<string> {
  return (await queryOne("select value from settings where key = $1", [key]))?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await query("insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value", [key, value]);
}

export async function bankTransferEnabled(): Promise<boolean> {
  return (await getSetting("bank_transfer_enabled", "true")) !== "false";
}

export async function callbackPromise(): Promise<string> {
  return getSetting("callback_promise", "1 working day");
}
