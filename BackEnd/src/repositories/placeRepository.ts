import { pool } from "../config/db";

export async function findAlongLine(geojson: string, limit: number) {
  const { rows } = await pool.query(
    `with line as (
       select ST_SetSRID(ST_GeomFromGeoJSON($1::text), 4326) as g
     )
     select p.kind, p.name, p.opening_hours,
            ST_X(p.geom)::float8 as lng, ST_Y(p.geom)::float8 as lat,
            ST_Distance(p.geom::geography, line.g::geography)::float8 as dist_m,
            ST_LineLocatePoint(line.g, p.geom)::float8 as along
     from places p, line
     where ST_DWithin(p.geom, line.g, 0.0025)
       and ST_DWithin(p.geom::geography, line.g::geography, 150)
     order by along
     limit $2`,
    [geojson, limit]
  );
  return rows;
}