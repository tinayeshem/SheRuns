import crypto from "crypto";
import {
  LiveRow, claimOverdue, claimSos, findDueIds, logSms, releaseClaim, smsCounts,
} from "../repositories/liveRepository";

const DAILY_CAP = Number(process.env.SMS_DAILY_CAP) || 100;
const DEVICE_CAP = 15;
const PHONE_CAP = 4;

function makeClock() {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit", minute: "2-digit", hour12: false,
  };
  try {
    return new Intl.DateTimeFormat("en-GB", {
      ...opts, timeZone: process.env.ALERT_TZ || "Europe/Warsaw",
    });
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/Warsaw" });
  }
}
const clock = makeClock();

const baseUrl = () =>
  (process.env.PUBLIC_URL || process.env.CLIENT_URL || "http://localhost:5173")
    .replace(/\/+$/, "");

export function smsConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
}

const pepper = () => process.env.SMS_PEPPER || process.env.ADMIN_KEY || "dev-pepper";
const phoneHash = (p: string) =>
  crypto.createHmac("sha256", pepper()).update(p).digest("hex");
const mask = (p: string) => "***" + p.slice(-3);
const scrub = (t: string) => t.replace(/\+\d{7,15}/g, "+***");

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!smsConfigured()) {
    console.log(`[SMS test mode] to ${mask(to)}: ${body}`);
    return true;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Twilio error ${res.status} for ${mask(to)}: ${scrub(text).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`SMS failed for ${mask(to)}: ${scrub(String((e as Error).message))}`);
    return false;
  }
}

async function sendToAll(row: LiveRow, kind: string, body: string) {
  let ok = 0;
  for (const phone of row.alert_phones) {
    const hash = phoneHash(phone);
    const c = await smsCounts(row.device_id, hash);
    if (c.total >= DAILY_CAP || c.dev >= DEVICE_CAP || c.ph >= PHONE_CAP) {
      console.warn(`SMS skipped for ${mask(phone)}: daily limit reached`);
      continue;
    }
    if (await sendSms(phone, body)) {
      ok++;
      if (smsConfigured()) await logSms(row.device_id, row.id, kind, hash);
    }
  }
  return ok;
}

const who = (r: LiveRow) => r.display_name || "A runner";
const link = (r: LiveRow) => `${baseUrl()}/live/${r.token}`;

const overdueText = (r: LiveRow) =>
  `Safe Run: ${who(r)} was expected back at ${clock.format(r.expected_end)} and has not checked in. ` +
  `Try calling them. Live location: ${link(r)} If you cannot reach them, call 112.`;

const sosText = (r: LiveRow) =>
  `Safe Run SOS: ${who(r)} pressed the alert button. Call them now. ` +
  `Live location: ${link(r)} If you cannot reach them, call 112.`;

const clearText = (r: LiveRow) =>
  `Safe Run: ${who(r)} is safe and ended the run. No action needed.`;

async function deliver(row: LiveRow, kind: "sos" | "overdue") {
  const body = kind === "sos" ? sosText(row) : overdueText(row);
  const ok = await sendToAll(row, kind, body);
  if (ok === 0) {
    await releaseClaim(row.id, kind);
    console.warn(`Alert "${kind}" was not sent. It will be retried.`);
  }
}

export async function runAlerts() {
  const ids = await findDueIds();
  for (const id of ids) {
    const sos = await claimSos(id);
    if (sos) await deliver(sos, "sos");
    const late = await claimOverdue(id);
    if (late) await deliver(late, "overdue");
  }
}

// tells the contacts who were warned that the runner is fine
export async function notifyAllClear(row: LiveRow) {
  if (!row.alert_phones.length) return;
  if (!row.sos_alert_at && !row.overdue_alert_at) return;
  await sendToAll(row, "clear", clearText(row));
}