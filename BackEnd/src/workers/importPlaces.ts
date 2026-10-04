import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "../config/db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const parser = require("osm-pbf-parser");

const FILE = path.join(process.cwd(), "data", "malopolskie-latest.osm.pbf");
const S = 49.96, W = 19.78, N = 50.13, E = 20.22; // Krakow box

function kindOf(t: Record<string, string>): string | null {
  if (t.amenity === "pharmacy") return "pharmacy";
  if (t.amenity === "hospital") return "hospital";
  if (t.amenity === "police") return "police";
  if (t.amenity === "fire_station") return "fire_station";
  if (t.shop === "convenience") return "convenience";
  if (t.shop === "supermarket") return "supermarket";
  return null;
}

type Row = {
  osm: number;
  kind: string;
  name: string | null;
  hours: string | null;
  lon: number;
  lat: number;
};

async function main() {
  if (!fs.existsSync(FILE)) throw new Error(`File not found: ${FILE}`);

  await pool.query(`
    create table if not exists places (
      id bigserial primary key,
      osm_id bigint,
      kind text not null,
      name text,
      opening_hours text,
      geom geometry(Point, 4326) not null
    )`);
  await pool.query(
    "create index if not exists places_geom_idx on places using gist (geom)"
  );

  console.log("Reading file (1-3 minutes)...");
  const rows: Row[] = [];

  await new Promise<void>((resolve, reject) => {
    const input = fs.createReadStream(FILE);
    input.on("error", reject);
    input
      .pipe(parser())
      .on("data", (items: any[]) => {
        for (const it of items) {
          if (it.type !== "node" || !it.tags) continue;
          if (it.lat < S || it.lat > N || it.lon < W || it.lon > E) continue;
          const kind = kindOf(it.tags);
          if (!kind) continue;
          rows.push({
            osm: it.id,
            kind,
            name: it.tags.name ?? null,
            hours: it.tags.opening_hours ?? null,
            lon: it.lon,
            lat: it.lat,
          });
        }
      })
      .on("end", () => resolve())
      .on("error", reject);
  });
  console.log(`Places found: ${rows.length}`);

  await pool.query(
    "delete from places where ST_Intersects(geom, ST_MakeEnvelope($1,$2,$3,$4,4326))",
    [W, S, E, N]
  );

  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const b = rows.slice(i, i + BATCH);
    await pool.query(
      `insert into places (osm_id, kind, name, opening_hours, geom)
       select osm, kind, name, hours, ST_SetSRID(ST_MakePoint(lon, lat), 4326)
       from unnest($1::bigint[], $2::text[], $3::text[], $4::text[],
                   $5::float8[], $6::float8[])
         as t(osm, kind, name, hours, lon, lat)`,
      [
        b.map((r) => r.osm), b.map((r) => r.kind), b.map((r) => r.name),
        b.map((r) => r.hours), b.map((r) => r.lon), b.map((r) => r.lat),
      ]
    );
  }

  const counts = await pool.query(
    "select kind, count(*)::int as n from places group by kind order by n desc"
  );
  console.table(counts.rows);

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});