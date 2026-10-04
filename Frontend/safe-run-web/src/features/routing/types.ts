export type Mode = "fastest" | "safest" | "scenic";
export type Color = "green" | "yellow" | "red";

export type Place = { label: string; lat: number; lng: number };

export type Stretch = {
  name: string;
  meters: number;
  score: number;
  color: Color;
};

export type Weakest = {
  id: number;
  name: string;
  score: number;
  factor: string;
  at: [number, number]; // [lng, lat]
} | null;

export type RouteResult = {
  id: string;
  distanceKm: number;
  score: number;
  color: Color;
  confidence: "high" | "low";
  tag?: string | null;
  weakest: Weakest;
  weakIds: number[];
  safeWindow: { from: number; to: number } | null;
  stretches: Stretch[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export type LoopResponse = {
  kind?: "loop" | "trip";
  start: { lng: number; lat: number; snappedMeters: number };
  end?: { lng: number; lat: number; snappedMeters: number };
  targetKm: number;
  mode: Mode;
  routes: RouteResult[];
};

export type Stop = {
  kind: string;
  name: string | null;
  openingHours: string | null;
  lng: number;
  lat: number;
  distanceM: number;
  along: number; // 0 to 1, position along the route
};