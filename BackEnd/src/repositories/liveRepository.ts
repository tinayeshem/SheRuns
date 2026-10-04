import { pool } from "../config/db";

export type LiveRow = {
  id: string;
  token: string;
  owner_key_hash: string;
  device_id: string | null;
  display_name: string | null;
  expected_end: Date;
  grace_min: number;
  expires_at: Date;
  started_at: Date;
  last_lng: number | null;
  last_lat: number | null;
  last_update_at: Date | null;
  trail: [number, number][];
  sos_at: Date | null;
  finished_at: Date | null;
  alert_phones: string[];
  overdue_alert_at: Date | null;
  sos_alert_at: Date | null;
  alert_fail: number;
};

const COLS = `id, token, owner_key_hash, device_id, display_name, expected_end,
  grace_min, expires_at, started_at, last_lng, last_lat, last_update_at, trail,
  sos_at, finished_at, alert_phones, overdue_alert_at, sos_alert_at, alert_fail`;

export async function countRecentStarts(device: string) {
  const { rows } = await pool.query(
    `select count(*)::int as n from live_sessions
     where device_id = $1 and started_at > now() - interval '1 hour'`,
    [device]
  );
  return rows[0].n as number;
}

export async function createSession(p: {
  token: string;
  ownerKeyHash: string;
  device: string;
  name: string | null;
  expectedMin: number;
  graceMin: number;
  lng: number;
  lat: number;
  phones: string[];
}) {
  const { rows } = await pool.query(
    `insert into live_sessions
       (token, owner_key_hash, device_id, display_name, expected_end, grace_min,
        expires_at, last_lng, last_lat, last_update_at, trail, alert_phones)
     values ($1, $2, $3, $4,
             now() + make_interval(mins => $5::int), $6::int,
             now() + make_interval(mins => $5::int + $6::int + 60),
             $7::float8, $8::float8, now(),
             jsonb_build_array(jsonb_build_array($7::float8, $8::float8)),
             $9::jsonb)
     returning ${COLS}`,
    [
      p.token, p.ownerKeyHash, p.device, p.name, p.expectedMin, p.graceMin,
      p.lng, p.lat, JSON.stringify(p.phones),
    ]
  );
  return rows[0] as LiveRow;
}

export async function getByToken(token: string) {
  const { rows } = await pool.query(
    `select ${COLS} from live_sessions where token = $1`,
    [token]
  );
  return (rows[0] ?? null) as LiveRow | null;
}

// at most one update every 2 seconds per session
export async function updatePosition(id: string, lng: number, lat: number) {
  await pool.query(
    `update live_sessions
     set last_lng = $2::float8,
         last_lat = $3::float8,
         last_update_at = now(),
         trail = (case when jsonb_array_length(trail) >= 100 then trail - 0 else trail end)
                 || jsonb_build_array(jsonb_build_array($2::float8, $3::float8))
     where id = $1 and finished_at is null and expires_at > now()
       and (last_update_at is null or last_update_at < now() - interval '2 seconds')`,
    [id, lng, lat]
  );
}

// extends from now, not from the old finish time, and re-arms the overdue alert
export async function extendSession(id: string, minutes: number) {
  await pool.query(
    `update live_sessions
     set expected_end = least(greatest(expected_end, now()) + make_interval(mins => $2::int),
                              started_at + interval '6 hours'),
         expires_at = greatest(expires_at,
                      least(greatest(expected_end, now())
                              + make_interval(mins => $2::int + grace_min + 60),
                            started_at + interval '9 hours')),
         overdue_alert_at = null,
         alert_fail = 0
     where id = $1 and finished_at is null and expires_at > now()`,
    [id, minutes]
  );
}

export async function markSos(id: string) {
  await pool.query(
    `update live_sessions set sos_at = coalesce(sos_at, now())
     where id = $1 and finished_at is null and expires_at > now()`,
    [id]
  );
}

// ending the run deletes the position, the trail and the phone numbers
export async function finishSession(id: string) {
  await pool.query(
    `update live_sessions
     set finished_at = now(), last_lng = null, last_lat = null,
         trail = '[]'::jsonb, alert_phones = '[]'::jsonb
     where id = $1 and finished_at is null`,
    [id]
  );
}

export async function cleanupLive() {
  await pool.query(
    `update live_sessions
     set last_lng = null, last_lat = null, trail = '[]'::jsonb,
         alert_phones = '[]'::jsonb
     where expires_at < now()
       and (last_lng is not null or jsonb_array_length(alert_phones) > 0)`
  );
  await pool.query(
    `delete from live_sessions where expires_at < now() - interval '1 hour'`
  );
  await pool.query(
    `delete from sms_log where created_at < now() - interval '2 days'`
  );
}

// ---- alerts ----

export async function findDueIds() {
  const { rows } = await pool.query(
    `select id from live_sessions
     where finished_at is null and expires_at > now() and alert_fail < 3
       and jsonb_array_length(alert_phones) > 0
       and (
         (sos_at is not null and sos_alert_at is null)
         or (sos_alert_at is null and overdue_alert_at is null
             and now() > expected_end + make_interval(mins => grace_min))
       )
     limit 50`
  );
  return rows.map((r: any) => r.id as string);
}

// the claim is atomic, so an alert can never be sent twice
export async function claimSos(id: string) {
  const { rows } = await pool.query(
    `update live_sessions set sos_alert_at = now()
     where id = $1 and sos_at is not null and sos_alert_at is null
       and finished_at is null and expires_at > now()
     returning ${COLS}`,
    [id]
  );
  return (rows[0] ?? null) as LiveRow | null;
}

export async function claimOverdue(id: string) {
  const { rows } = await pool.query(
    `update live_sessions set overdue_alert_at = now()
     where id = $1 and overdue_alert_at is null and sos_alert_at is null
       and finished_at is null and expires_at > now()
       and now() > expected_end + make_interval(mins => grace_min)
     returning ${COLS}`,
    [id]
  );
  return (rows[0] ?? null) as LiveRow | null;
}

export async function releaseClaim(id: string, kind: "sos" | "overdue") {
  const col = kind === "sos" ? "sos_alert_at" : "overdue_alert_at";
  await pool.query(
    `update live_sessions set ${col} = null, alert_fail = alert_fail + 1
     where id = $1`,
    [id]
  );
}

export async function smsCounts(device: string | null, phoneHash: string) {
  const { rows } = await pool.query(
    `select
       (select count(*)::int from sms_log
         where created_at > now() - interval '24 hours') as total,
       (select count(*)::int from sms_log
         where device_id = $1::text and created_at > now() - interval '24 hours') as dev,
       (select count(*)::int from sms_log
         where phone_hash = $2 and created_at > now() - interval '24 hours') as ph`,
    [device, phoneHash]
  );
  return rows[0] as { total: number; dev: number; ph: number };
}

export async function logSms(
  device: string | null, sessionId: string, kind: string, phoneHash: string
) {
  await pool.query(
    `insert into sms_log (device_id, session_id, kind, phone_hash)
     values ($1, $2, $3, $4)`,
    [device, sessionId, kind, phoneHash]
  );
}