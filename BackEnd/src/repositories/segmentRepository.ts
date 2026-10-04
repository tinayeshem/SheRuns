import { pool } from "../config/db";

const COLUMNS = `id, name, highway, lit, surface, maxspeed, sidewalk, neighbors,
                 ST_AsGeoJSON(geom)::json as geometry`;

export async function findInBbox(
  w: number, s: number, e: number, n: number, limit: number
) {
  const { rows } = await pool.query(
    `select ${COLUMNS} from segments
     where geom && ST_MakeEnvelope($1,$2,$3,$4,4326)
     limit $5`,
    [w, s, e, n, limit]
  );
  return rows;
}

export async function findById(id: number) {
  const { rows } = await pool.query(
    `select ${COLUMNS} from segments where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function loadWeights() {
  const { rows } = await pool.query(
    "select factor, period, weight::float8 as weight from scoring_config"
  );
  return rows as { factor: string; period: string; weight: number }[];
}