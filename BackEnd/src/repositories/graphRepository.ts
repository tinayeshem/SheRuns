import { pool } from "../config/db";

export type GraphRow = {
  id: number;
  name: string | null;
  highway: string | null;
  lit: boolean | null;
  surface: string | null;
  maxspeed: number | null;
  sidewalk: string | null;
  neighbors: number | null;
  length_m: number;
  source: string;
  target: string;
  coords: [number, number][];
};

export async function loadGraphRows(
  w: number, s: number, e: number, n: number
): Promise<GraphRow[]> {
  const { rows } = await pool.query(
    `select id, name, highway, lit, surface, maxspeed, sidewalk, neighbors,
            length_m::float8 as length_m,
            source::text as source, target::text as target,
            (ST_AsGeoJSON(geom)::json)->'coordinates' as coords
     from segments
     where source is not null and target is not null
       and geom && ST_MakeEnvelope($1,$2,$3,$4,4326)`,
    [w, s, e, n]
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    name: r.name,
    highway: r.highway,
    lit: r.lit,
    surface: r.surface,
    maxspeed: r.maxspeed,
    sidewalk: r.sidewalk,
    neighbors: r.neighbors,
    length_m: Number(r.length_m),
    source: String(r.source),
    target: String(r.target),
    coords: r.coords as [number, number][],
  }));
}