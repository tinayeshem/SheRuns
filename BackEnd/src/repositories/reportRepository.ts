import { pool } from "../config/db";

const SELECT = `
  r.id, r.type, rt.label, r.note, r.confirmations,
  r.gone_votes as "goneVotes", r.status,
  ST_X(r.geom)::float8 as lng, ST_Y(r.geom)::float8 as lat,
  r.created_at as "createdAt", r.last_confirmed_at as "lastConfirmedAt",
  r.expires_at as "expiresAt"`;
const FROM = `from reports r join report_types rt on rt.key = r.type`;

export async function typeExists(key: string) {
  const { rowCount } = await pool.query(
    "select 1 from report_types where key = $1",
    [key]
  );
  return (rowCount ?? 0) > 0;
}

export async function countRecentByDevice(device: string) {
  const { rows } = await pool.query(
    `select count(*)::int as n from reports
     where device_id = $1 and created_at > now() - interval '1 hour'`,
    [device]
  );
  return rows[0].n as number;
}

export async function insertReport(
  type: string, lng: number, lat: number, note: string | null, device: string
) {
  const { rows } = await pool.query(
    `insert into reports (type, note, geom, device_id)
     values ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5)
     returning id`,
    [type, note, lng, lat, device]
  );
  return rows[0].id as string;
}

export async function getById(id: string) {
  const { rows } = await pool.query(
    `select ${SELECT} ${FROM} where r.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listActiveInBbox(
  w: number, s: number, e: number, n: number, limit: number
) {
  const { rows } = await pool.query(
    `select ${SELECT} ${FROM}
     where r.status in ('pending','approved') and r.expires_at > now()
       and r.geom && ST_MakeEnvelope($1,$2,$3,$4,4326)
     order by r.last_confirmed_at desc
     limit $5`,
    [w, s, e, n, limit]
  );
  return rows;
}

export async function vote(
  id: string, device: string, kind: "confirm" | "gone"
): Promise<"ok" | "missing" | "own" | "already"> {
  const own = await pool.query(
    "select device_id from reports where id = $1",
    [id]
  );
  if (own.rowCount === 0) return "missing";
  if (own.rows[0].device_id === device) return "own";

  const client = await pool.connect();
  try {
    await client.query("begin");
    const ins = await client.query(
      `insert into report_votes (report_id, device_id, vote)
       values ($1, $2, $3) on conflict do nothing returning report_id`,
      [id, device, kind]
    );
    if (ins.rowCount === 0) {
      await client.query("rollback");
      return "already";
    }
    if (kind === "confirm") {
      await client.query(
        `update reports
         set confirmations = confirmations + 1,
             last_confirmed_at = now(),
             expires_at = now() + interval '7 days'
         where id = $1 and status in ('pending','approved')`,
        [id]
      );
    } else {
      await client.query(
        `update reports
         set gone_votes = gone_votes + 1,
             status = case when gone_votes + 1 >= 2 and gone_votes + 1 >= confirmations
                           then 'removed' else status end
         where id = $1 and status in ('pending','approved')`,
        [id]
      );
    }
    await client.query("commit");
    return "ok";
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function adminList(status: string) {
  const { rows } = await pool.query(
    `select ${SELECT}, left(r.device_id, 8) as device ${FROM}
     where r.status = $1
     order by r.created_at desc
     limit 100`,
    [status]
  );
  return rows;
}

export async function adminSet(id: string, status: "approved" | "removed") {
  const { rowCount } = await pool.query(
    "update reports set status = $2 where id = $1",
    [id, status]
  );
  return (rowCount ?? 0) > 0;
}

export async function adminAbuse() {
  const { rows } = await pool.query(
    `select left(device_id, 8) as device, count(*)::int as n
     from reports
     where created_at > now() - interval '1 hour' and device_id is not null
     group by device_id
     having count(*) >= 3
     order by n desc
     limit 20`
  );
  return rows;
}

// reports close to the given segments, for the safety score
export async function penaltyRows(ids: number[]) {
  const { rows } = await pool.query(
    `select s.id::int as seg, r.type, rt.penalty::int as penalty,
            r.confirmations, r.status,
            (extract(epoch from (now() - r.last_confirmed_at)) / 3600)::float8 as age_h
     from segments s
     join reports r
       on ST_DWithin(s.geom, r.geom, 0.0006)
      and ST_DWithin(s.geom::geography, r.geom::geography, 30)
     join report_types rt on rt.key = r.type
     where s.id = any($1::bigint[])
       and r.status in ('pending','approved')
       and r.expires_at > now()`,
    [ids]
  );
  return rows as {
    seg: number; type: string; penalty: number;
    confirmations: number; status: string; age_h: number;
  }[];
}