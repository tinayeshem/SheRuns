export type Place = { label: string; lat: number; lng: number };

export class GeocoderBusy extends Error {}

// the area you imported. Change this box when you import another city.
const BOX = { west: 19.78, south: 49.96, east: 20.22, north: 50.13 };

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { until: number; places: Place[] }>();

let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
let pending = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastCall + 1100 - Date.now());
    if (wait) await new Promise((ok) => setTimeout(ok, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

const userAgent = () =>
  `SafeRun/1.0 (${process.env.GEOCODER_CONTACT || "student project"})`;

const shorten = (name: string) =>
  name
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

async function fetchNominatim(q: string): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    limit: "6",
    countrycodes: "pl",
    viewbox: `${BOX.west},${BOX.north},${BOX.east},${BOX.south}`,
    bounded: "1",
    "accept-language": "pl,en",
  }).toString();

  const res = await fetch(url, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 429) throw new GeocoderBusy();
  if (!res.ok) throw new Error(`Geocoder error ${res.status}`);

  const rows = (await res.json()) as any[];
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const r of rows) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const label = shorten(String(r.display_name ?? ""));
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat, lng });
  }
  return out;
}

export async function searchAddress(q: string): Promise<Place[]> {
  const key = q.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.places;

  if (pending >= 5) throw new GeocoderBusy();
  pending++;
  try {
    const places = await throttled(() => fetchNominatim(q.trim()));
    if (cache.size > 500) cache.clear();
    cache.set(key, { until: Date.now() + TTL, places });
    return places;
  } finally {
    pending--;
  }
}