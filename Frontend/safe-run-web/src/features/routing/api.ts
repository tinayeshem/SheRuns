import type { LoopResponse, Mode, Place, Stop } from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type LoopParams = {
  lat: number;
  lng: number;
  km: number;
  mode: Mode;
  hour: number;
  sunset: number;
  traits: string[];
  avoid?: number[];
  end?: { lat: number; lng: number }; // set for an A to B route
};

async function failure(res: Response, fallback: string): Promise<never> {
  let msg = fallback;
  try {
    const body = await res.json();
    if (body?.error) msg = body.error;
  } catch {
    // keep the default message
  }
  throw new Error(msg);
}

export async function fetchLoops(
  p: LoopParams,
  signal?: AbortSignal
): Promise<LoopResponse> {
  const q = new URLSearchParams({
    mode: p.mode,
    hour: String(p.hour),
    sunset: p.sunset.toFixed(2),
    traits: p.traits.join(","),
  });
  if (p.avoid?.length) q.set("avoid", p.avoid.join(","));

  let path: string;
  if (p.end) {
    q.set("fromLat", p.lat.toFixed(6));
    q.set("fromLng", p.lng.toFixed(6));
    q.set("toLat", p.end.lat.toFixed(6));
    q.set("toLng", p.end.lng.toFixed(6));
    path = "/routes/trip";
  } else {
    q.set("lat", p.lat.toFixed(6));
    q.set("lng", p.lng.toFixed(6));
    q.set("km", String(p.km));
    path = "/routes/loop";
  }

  const res = await fetch(`${API}${path}?${q}`, { signal });
  if (!res.ok) await failure(res, "Could not find routes");
  return res.json();
}

export async function geocode(q: string, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${API}/geocode?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) await failure(res, "Address search failed");
  return (await res.json()).places as Place[];
}

export async function fetchStops(
  coordinates: [number, number][],
  signal?: AbortSignal
): Promise<Stop[]> {
  const res = await fetch(`${API}/places/along`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates }),
    signal,
  });
  if (!res.ok) throw new Error(String(res.status));
  const json = await res.json();
  return json.stops as Stop[];
}

// total climb along the route, from free elevation data (approximate)
export async function fetchAscent(
  coordinates: [number, number][],
  signal?: AbortSignal
): Promise<number | null> {
  if (coordinates.length < 2) return null;
  const n = Math.min(60, coordinates.length);
  const pts = Array.from({ length: n }, (_, i) =>
    coordinates[Math.round((i * (coordinates.length - 1)) / (n - 1))]
  );
  const lat = pts.map((p) => p[1].toFixed(5)).join(",");
  const lng = pts.map((p) => p[0].toFixed(5)).join(",");

  const res = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
    { signal }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const el: number[] = json.elevation;
  if (!Array.isArray(el) || el.length < 2) return null;

  let up = 0;
  for (let i = 1; i < el.length; i++) {
    const d = el[i] - el[i - 1];
    if (d > 1) up += d;
  }
  return Math.round(up);
}