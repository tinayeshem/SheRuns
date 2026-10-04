import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "../config/db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const parser = require("osm-pbf-parser");

const FILE = path.join(process.cwd(), "data", "malopolskie-latest.osm.pbf");
const S = 49.96, W = 19.78, N = 50.13, E = 20.22; // Krakow box
const CHUNK_M = 200;

const HIGHWAYS = new Set([
  "footway", "path", "pedestrian", "cycleway", "living_street",
  "residential", "service", "unclassified", "tertiary",
  "secondary", "primary", "track",
]);

type LatLon = [number, number];
type Way = { id: number; tags: Record<string, string>; refs: number[] };

function dist(a: LatLon, b: LatLon) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const toWkt = (pts: LatLon[]) =>
  "LINESTRING(" + pts.map((p) => `${p[1]} ${p[0]}`).join(", ") + ")";
const toLit = (v?: string) => (v === "yes" ? true : v === "no" ? false : null);
const toSpeed = (v?: string) => {
  const n = parseInt(v ?? "", 10);
  return Number.isNaN(n) ? null : n;
};

async function main() {
  if (!fs.existsSync(FILE)) throw new Error(`File not found: ${FILE}`);

  await pool.query("alter table segments add column if not exists source bigint");
  await pool.query("alter table segments add column if not exists target bigint");

  console.log("Reading file (1-3 minutes)...");
  const nodes = new Map<number, LatLon>();
  const ways: Way[] = [];

  await new Promise<void>((resolve, reject) => {
    const input = fs.createReadStream(FILE);
    input.on("error", reject);

    input
      .pipe(parser())
      .on("data", (items: any[]) => {
        for (const it of items) {
          if (it.type === "node") {
            if (it.lat >= S && it.lat <= N && it.lon >= W && it.lon <= E) {
              nodes.set(it.id, [it.lat, it.lon]);
            }
          } else if (it.type === "way") {
            const t = it.tags ?? {};
            if (!t.highway || !HIGHWAYS.has(t.highway)) continue;
            const tags = {
              highway: t.highway,
              name: t.name,
              lit: t.lit,
              surface: t.surface,
              maxspeed: t.maxspeed,
              sidewalk: t.sidewalk,
            } as Record<string, string>;

            // split where the way leaves the area, so no false links appear
            let run: number[] = [];
            for (const ref of it.refs as number[]) {
              if (nodes.has(ref)) {
                run.push(ref);
              } else {
                if (run.length >= 2) ways.push({ id: it.id, tags, refs: run });
                run = [];
              }
            }
            if (run.length >= 2) ways.push({ id: it.id, tags, refs: run });
          }
        }
      })
      .on("end", () => resolve())
      .on("error", reject);
  });
  console.log(`Nodes in area: ${nodes.size}, ways: ${ways.length}`);

  // how many times each node is used: 2 or more means a junction
  const uses = new Map<number, number>();
  for (const w of ways) {
    for (const ref of w.refs) uses.set(ref, (uses.get(ref) ?? 0) + 1);
  }

  const rows: any[] = [];
  for (const w of ways) {
    const refs = w.refs;
    let startIdx = 0;
    let acc = 0;
    for (let i = 1; i < refs.length; i++) {
      acc += dist(nodes.get(refs[i - 1])!, nodes.get(refs[i])!);
      const isLast = i === refs.length - 1;
      const junction = (uses.get(refs[i]) ?? 0) >= 2;
      if (isLast || junction || acc >= CHUNK_M) {
        const piece = refs.slice(startIdx, i + 1);
        rows.push({
          osm: w.id,
          name: w.tags.name ?? null,
          highway: w.tags.highway,
          lit: toLit(w.tags.lit),
          surface: w.tags.surface ?? null,
          maxspeed: toSpeed(w.tags.maxspeed),
          sidewalk: w.tags.sidewalk ?? null,
          wkt: toWkt(piece.map((r) => nodes.get(r)!)),
          src: refs[startIdx],
          tgt: refs[i],
        });
        startIdx = i;
        acc = 0;
      }
    }
  }
  console.log(`Segments: ${rows.length}`);

  await pool.query(
    "delete from segments where ST_Intersects(geom, ST_MakeEnvelope($1,$2,$3,$4,4326))",
    [W, S, E, N]
  );

  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const b = rows.slice(i, i + BATCH);
    await pool.query(
      `insert into segments (osm_way_id, name, highway, lit, surface, maxspeed, sidewalk, geom, length_m, source, target)
       select osm, name, highway, lit, surface, maxspeed, sidewalk,
              ST_GeomFromText(wkt, 4326),
              ST_Length(ST_GeomFromText(wkt, 4326)::geography),
              src, tgt
       from unnest($1::bigint[], $2::text[], $3::text[], $4::boolean[],
                   $5::text[], $6::int[], $7::text[], $8::text[],
                   $9::bigint[], $10::bigint[])
         as t(osm, name, highway, lit, surface, maxspeed, sidewalk, wkt, src, tgt)`,
      [
        b.map((r) => r.osm), b.map((r) => r.name), b.map((r) => r.highway),
        b.map((r) => r.lit), b.map((r) => r.surface), b.map((r) => r.maxspeed),
        b.map((r) => r.sidewalk), b.map((r) => r.wkt),
        b.map((r) => r.src), b.map((r) => r.tgt),
      ]
    );
    console.log(`Inserted ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  await pool.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});