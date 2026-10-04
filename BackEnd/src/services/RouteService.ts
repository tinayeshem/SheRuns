import { loadGraphRows, GraphRow } from "../repositories/graphRepository";
import { buildGraph, nearestNode, shortestPath, Step, Graph } from "./graph";
import { scoreMany, ScoreOptions, toColor } from "./ScoreService";
import { streetLabel } from "./streetLabel";

export type Mode = "fastest" | "safest" | "scenic";

export type PlanInput = {
  lat: number;
  lng: number;
  km: number;
  mode: Mode;
  avoid?: number[];
  opts: ScoreOptions;
};

export type TripInput = {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  mode: Mode;
  avoid?: number[];
  opts: ScoreOptions;
};

type Scored = Awaited<ReturnType<typeof scoreMany>>;

const K: Record<Mode, number> = { fastest: 0.1, safest: 2, scenic: 1 };
const PATHS = ["footway", "path", "pedestrian", "cycleway", "track"];
const M_LAT = 111320;
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const MAX_TRIP_M = 12000;

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (deg: number): [number, number] => [
  Math.sin(rad(deg)),
  Math.cos(rad(deg)),
];

function shift(
  lon: number, lat: number, east: number, north: number
): [number, number] {
  return [lon + east / (M_LAT * Math.cos(rad(lat))), lat + north / M_LAT];
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function lengthOf(rows: GraphRow[], steps: Step[]) {
  let t = 0;
  for (const st of steps) t += rows[st.seg].length_m;
  return t;
}

function routeScore(
  rows: GraphRow[], steps: Step[], sc: (seg: number) => number
) {
  let total = 0, sum = 0, red = 0;
  for (const st of steps) {
    const len = rows[st.seg].length_m;
    const v = sc(st.seg);
    total += len;
    sum += v * len;
    if (v < 40) red += len;
  }
  let score = Math.round(sum / total);
  if (red >= 100) score = Math.min(score, 69); // 100 m of red caps the route at yellow
  return score;
}

// everything the app shows about one route
async function describeRoute(
  id: string,
  rows: GraphRow[],
  scored: Scored,
  steps: Step[],
  opts: ScoreOptions
) {
  const len = lengthOf(rows, steps);
  const score = routeScore(rows, steps, (i) => scored[i].score);
  const curHour = Math.min(23, Math.max(0, Math.floor(opts.hour)));

  // safe window: hours around now when the whole route stays green
  const idx = [...new Set(steps.map((x) => x.seg))];
  const subset = idx.map((i) => rows[i]);
  const byHour: number[] = [];
  for (let h = 0; h < 24; h++) {
    const res = await scoreMany(subset, { ...opts, hour: h });
    const map = new Map<number, number>();
    idx.forEach((seg, j) => map.set(seg, res[j].score));
    byHour[h] = routeScore(rows, steps, (i) => map.get(i)!);
  }
  let safeWindow: { from: number; to: number } | null = null;
  if (byHour[curHour] >= 70) {
    let a = curHour;
    let b = curHour;
    while (a > 0 && byHour[a - 1] >= 70) a--;
    while (b < 23 && byHour[b + 1] >= 70) b++;
    safeWindow = { from: a, to: b + 1 };
  }

  // weakest stretch and low-confidence share
  let weakest: any = null;
  let lowLen = 0;
  for (const st of steps) {
    const r = rows[st.seg];
    const sc = scored[st.seg];
    if (sc.confidence === "low") lowLen += r.length_m;
    if (r.length_m >= 30 && (!weakest || sc.score < weakest.score)) {
      let wf = "";
      let wv = 101;
      for (const [key, v] of Object.entries(sc.factors)) {
        if (v < wv) {
          wv = v;
          wf = key;
        }
      }
      const mid = r.coords[Math.floor(r.coords.length / 2)];
      weakest = {
        id: r.id,
        name: streetLabel(r.name, r.highway),
        score: sc.score,
        factor: wf,
        at: mid,
      };
    }
  }

  // stretches: consecutive pieces with the same name, merged
  const stretches: { name: string; meters: number; score: number; color: string }[] = [];
  let cur: { name: string; meters: number; sum: number } | null = null;
  const flush = () => {
    if (!cur) return;
    const sc = Math.round(cur.sum / cur.meters);
    stretches.push({
      name: cur.name,
      meters: Math.round(cur.meters),
      score: sc,
      color: toColor(sc),
    });
  };
  for (const st of steps) {
    const r = rows[st.seg];
    const name = streetLabel(r.name, r.highway);
    const sc = scored[st.seg].score;
    if (cur && cur.name === name) {
      cur.meters += r.length_m;
      cur.sum += sc * r.length_m;
    } else {
      flush();
      cur = { name, meters: r.length_m, sum: sc * r.length_m };
    }
  }
  flush();

  // geometry in walking order
  const coordinates: [number, number][] = [];
  for (const st of steps) {
    const pts = st.rev ? [...rows[st.seg].coords].reverse() : rows[st.seg].coords;
    for (let i = coordinates.length ? 1 : 0; i < pts.length; i++) {
      coordinates.push(pts[i]);
    }
  }

  return {
    id,
    distanceKm: Math.round(len / 100) / 10,
    score,
    color: toColor(score),
    confidence: lowLen / len > 0.5 ? "low" : "high",
    weakest,
    weakIds: [
      ...new Set(
        steps.filter((st) => scored[st.seg].score < 40).map((st) => rows[st.seg].id)
      ),
    ].slice(0, 40),
    safeWindow,
    stretches,
    geometry: { type: "LineString" as const, coordinates },
  };
}

// ---------- loops ----------

// a loop through the start and two more points on a circle
function buildLoop(
  g: Graph, base: number[], startId: string, bearing: number, r: number
): Step[] | null {
  const [slon, slat] = g.nodes.get(startId)!;
  const [dx, dy] = dir(bearing);
  const [clon, clat] = shift(slon, slat, dx * r, dy * r);

  const wps: string[] = [startId];
  for (const k of [120, 240]) {
    const [px, py] = dir(bearing + 180 + k);
    const [lon, lat] = shift(clon, clat, px * r, py * r);
    const hit = nearestNode(g, lon, lat, Math.max(300, r * 0.6));
    if (!hit || wps.includes(hit.id)) return null;
    wps.push(hit.id);
  }
  wps.push(startId);

  const used = new Set<number>();
  const steps: Step[] = [];
  for (let i = 0; i < 3; i++) {
    const path = shortestPath(
      g, wps[i], wps[i + 1],
      (a) => base[a.seg] * (used.has(a.seg) ? 4 : 1)
    );
    if (!path) return null;
    for (const st of path) used.add(st.seg);
    steps.push(...path);
  }
  return steps;
}

export async function planLoops(inp: PlanInput) {
  const L = inp.km * 1000;
  const radius = L * 0.45 + 500;
  const [w, s] = shift(inp.lng, inp.lat, -radius, -radius);
  const [e, n] = shift(inp.lng, inp.lat, radius, radius);

  const rows = await loadGraphRows(w, s, e, n);
  if (rows.length === 0) return { error: "no street data here" };

  const g = buildGraph(rows);
  const start = nearestNode(g, inp.lng, inp.lat, 500);
  if (!start) return { error: "start is too far from mapped streets" };

  const scored = await scoreMany(rows, inp.opts);
  const k = K[inp.mode];
  const avoid = new Set(inp.avoid ?? []);
  const base = rows.map((r, i) => {
    if (avoid.has(r.id)) return Infinity;
    let c = r.length_m * (1 + (k * (100 - scored[i].score)) / 50);
    if (inp.mode === "scenic" && PATHS.includes(r.highway ?? "")) c *= 0.85;
    return c;
  });

  type Cand = {
    bearing: number;
    steps: Step[];
    len: number;
    score: number;
    repeated: number;
    segs: Set<number>;
  };
  const cands: Cand[] = [];

  for (const bearing of BEARINGS) {
    let r = L / 6.75;
    let steps: Step[] | null = null;
    for (let it = 0; it < 3; it++) {
      const next = buildLoop(g, base, start.id, bearing, r);
      if (!next) break;
      steps = next;
      const ratio = lengthOf(rows, next) / L;
      if (ratio > 0.9 && ratio < 1.1) break;
      r *= Math.min(2, Math.max(0.5, 1 / ratio));
    }
    if (!steps) continue;

    const count = new Map<number, number>();
    for (const st of steps) count.set(st.seg, (count.get(st.seg) ?? 0) + 1);
    let repeated = 0;
    for (const st of steps) {
      if ((count.get(st.seg) ?? 0) > 1) repeated += rows[st.seg].length_m;
    }

    cands.push({
      bearing,
      steps,
      len: lengthOf(rows, steps),
      score: routeScore(rows, steps, (i) => scored[i].score),
      repeated,
      segs: new Set(steps.map((x) => x.seg)),
    });
  }

  const ranges: [number, number][] = [[0.8, 1.25], [0.6, 1.5]];
  let pool: Cand[] = [];
  for (const [lo, hi] of ranges) {
    pool = cands.filter(
      (c) => c.len / L >= lo && c.len / L <= hi && c.repeated / c.len <= 0.35
    );
    if (pool.length) break;
  }
  if (!pool.length) {
    return { error: "no loop found, try another distance or start point" };
  }

  pool.sort(
    inp.mode === "fastest"
      ? (a, b) => Math.abs(a.len - L) - Math.abs(b.len - L)
      : (a, b) => b.score - a.score
  );

  const chosen: Cand[] = [];
  for (const c of pool) {
    const similar = chosen.some((o) => {
      let shared = 0;
      for (const sg of c.segs) if (o.segs.has(sg)) shared += rows[sg].length_m;
      return shared / Math.min(c.len, o.len) > 0.6;
    });
    if (!similar) chosen.push(c);
    if (chosen.length === 3) break;
  }

  const routes = [];
  for (const c of chosen) {
    const r = await describeRoute(String(c.bearing), rows, scored, c.steps, inp.opts);
    routes.push({ ...r, tag: null as string | null });
  }

  const [slon, slat] = g.nodes.get(start.id)!;
  return {
    kind: "loop" as const,
    start: { lng: slon, lat: slat, snappedMeters: Math.round(start.meters) },
    targetKm: inp.km,
    mode: inp.mode,
    routes,
  };
}

// ---------- A to B ----------

export async function planTrip(inp: TripInput) {
  const straight = haversine(inp.from.lat, inp.from.lng, inp.to.lat, inp.to.lng);
  if (straight < 100) {
    return { error: "Start and end are too close. Choose places further apart." };
  }
  if (straight > MAX_TRIP_M) {
    return { error: "Start and end are more than 12 km apart." };
  }

  const margin = 800 + straight * 0.3;
  const minLng = Math.min(inp.from.lng, inp.to.lng);
  const maxLng = Math.max(inp.from.lng, inp.to.lng);
  const minLat = Math.min(inp.from.lat, inp.to.lat);
  const maxLat = Math.max(inp.from.lat, inp.to.lat);
  const [w, s] = shift(minLng, minLat, -margin, -margin);
  const [e, n] = shift(maxLng, maxLat, margin, margin);

  const rows = await loadGraphRows(w, s, e, n);
  if (rows.length === 0) return { error: "no street data here" };

  const g = buildGraph(rows);
  const a = nearestNode(g, inp.from.lng, inp.from.lat, 500);
  if (!a) return { error: "The start is too far from mapped streets." };
  const b = nearestNode(g, inp.to.lng, inp.to.lat, 500);
  if (!b) return { error: "The end is too far from mapped streets." };
  if (a.id === b.id) {
    return { error: "Start and end are the same street point. Choose places further apart." };
  }

  const scored = await scoreMany(rows, inp.opts);
  const avoid = new Set(inp.avoid ?? []);

  const costs = (k: number, discourage?: Set<number>) =>
    rows.map((r, i) => {
      if (avoid.has(r.id)) return Infinity;
      let c = r.length_m * (1 + (k * (100 - scored[i].score)) / 50);
      if (inp.mode === "scenic" && PATHS.includes(r.highway ?? "")) c *= 0.85;
      if (discourage?.has(i)) c *= 3;
      return c;
    });

  type Cand = { steps: Step[]; len: number; score: number; segs: Set<number> };
  const cands: Cand[] = [];
  const seen = new Set<string>();
  const add = (steps: Step[] | null) => {
    if (!steps || steps.length === 0) return;
    const sig = steps.map((x) => x.seg).join(",");
    if (seen.has(sig)) return;
    seen.add(sig);
    cands.push({
      steps,
      len: lengthOf(rows, steps),
      score: routeScore(rows, steps, (i) => scored[i].score),
      segs: new Set(steps.map((x) => x.seg)),
    });
  };

  // the same trip with different weight on safety gives different routes
  for (const k of [...new Set([K[inp.mode], 0.1, 1, 2, 4])]) {
    const base = costs(k);
    add(shortestPath(g, a.id, b.id, (arc) => base[arc.seg]));
  }
  if (cands.length === 0) {
    return { error: "No route found between these places. Try other points or another time." };
  }

  // one more option that avoids the streets of the first route
  const alt = costs(K[inp.mode], cands[0].segs);
  add(shortestPath(g, a.id, b.id, (arc) => alt[arc.seg]));

  const shortest = Math.min(...cands.map((c) => c.len));
  const pool = cands.filter((c) => c.len <= shortest * 1.8 + 500);
  pool.sort(
    inp.mode === "fastest"
      ? (x, y) => x.len - y.len
      : (x, y) => y.score - x.score || x.len - y.len
  );

  const chosen: Cand[] = [];
  for (const c of pool) {
    const similar = chosen.some((o) => {
      let shared = 0;
      for (const sg of c.segs) if (o.segs.has(sg)) shared += rows[sg].length_m;
      return shared / Math.min(c.len, o.len) > 0.85;
    });
    if (!similar) chosen.push(c);
    if (chosen.length === 3) break;
  }

  const maxScore = Math.max(...chosen.map((c) => c.score));
  const routes = [];
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    const r = await describeRoute(`t${i}`, rows, scored, c.steps, inp.opts);
    const tags: string[] = [];
    if (c.len === shortest) tags.push("Shortest");
    if (c.score === maxScore) tags.push("Safest");
    routes.push({ ...r, tag: tags.length ? tags.join(" and ") : (null as string | null) });
  }

  const aPos = g.nodes.get(a.id)!;
  const bPos = g.nodes.get(b.id)!;
  return {
    kind: "trip" as const,
    start: { lng: aPos[0], lat: aPos[1], snappedMeters: Math.round(a.meters) },
    end: { lng: bPos[0], lat: bPos[1], snappedMeters: Math.round(b.meters) },
    targetKm: Math.round(straight / 100) / 10,
    mode: inp.mode,
    routes,
  };
}