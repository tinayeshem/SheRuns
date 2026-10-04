export type SegmentRow = {
  id: number;
  name: string | null;
  highway: string | null;
  lit: boolean | null;
  surface: string | null;
  maxspeed: number | null;
  sidewalk: string | null;
  neighbors: number | null;
  geometry?: any;
};
export type Sub = { score: number; low?: boolean };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const PATHS = ["footway", "path", "pedestrian", "cycleway", "track"];

export function lighting(s: SegmentRow, night: boolean): Sub {
  if (s.lit === true) return { score: night ? 95 : 90 };
  if (s.lit === false) return { score: night ? 5 : 40 };
  return { score: night ? 30 : 50, low: true };
}

export function isolation(s: SegmentRow, night: boolean): Sub {
  const n = s.neighbors ?? 0; // 0-99: how dense the streets are around
  let base = n >= 75 ? 90 : n >= 50 ? 70 : n >= 25 ? 50 : n >= 10 ? 35 : 20;
  if (night && PATHS.includes(s.highway ?? "") && n < 50) base *= 0.5;
  return { score: clamp(base) };
}


function hourFactor(hour: number) {
  const h = Math.floor(hour);
  if (h >= 7 && h <= 9) return 1.0;
  if (h >= 10 && h <= 16) return 0.8;
  if (h >= 17 && h <= 19) return 1.0;
  if (h === 6 || h === 20 || h === 21) return 0.6;
  return 0.2;
}

export function footTraffic(s: SegmentRow, hour: number): Sub {
  const base = s.neighbors ?? 0;
  return { score: clamp(Math.max(10, base * hourFactor(hour))) };
}

function n(s: SegmentRow) {
  return s.neighbors ?? 0;
}

export function traffic(s: SegmentRow): Sub {
  const h = s.highway ?? "";
  if (PATHS.includes(h)) return { score: 100 };
  if (h === "living_street") return { score: 95 };

  const defaults: Record<string, number> = {
    service: 20, residential: 30, unclassified: 40,
    tertiary: 50, secondary: 50, primary: 60,
  };
  const speed = s.maxspeed ?? defaults[h] ?? 50;
  const sw = s.sidewalk ? !["no", "none"].includes(s.sidewalk) : null;

  if (speed <= 30) return { score: sw === false ? 60 : sw === true ? 85 : 75 };
  if (speed <= 50) return { score: sw === true ? 55 : sw === false ? 30 : 45 };
  if (speed < 70) return { score: 30 };
  return { score: 10 };
}

const SURFACE: Record<string, number> = {
  asphalt: 90, paved: 90, concrete: 80, paving_stones: 80,
  compacted: 60, fine_gravel: 60, sett: 50, cobblestone: 50,
  gravel: 40, dirt: 40, ground: 40, grass: 40, sand: 40,
  unpaved: 40, mud: 30,
};

export function surface(s: SegmentRow): Sub {
  if (!s.surface) return { score: 65, low: true };
  return { score: SURFACE[s.surface] ?? 60 };
}