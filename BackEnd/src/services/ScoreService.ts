import { loadWeights } from "../repositories/segmentRepository";
import {
  SegmentRow, lighting, isolation, footTraffic, traffic, surface,
} from "./subScores";
import { reportEffects, ReportEffect } from "./ReportEffects";

type Weights = Record<string, { day: number; night: number }>;
type Adjusted = {
  day: Record<string, number>;
  night: Record<string, number>;
};
export type ScoreOptions = {
  hour: number;
  sunrise: number;
  sunset: number;
  traits?: string[];
};
export type Color = "green" | "yellow" | "red";

let cache: { at: number; weights: Weights } | null = null;

async function getWeights(): Promise<Weights> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.weights;
  const rows = await loadWeights();
  const weights: Weights = {};
  for (const r of rows) {
    weights[r.factor] ??= { day: 0, night: 0 };
    weights[r.factor][r.period as "day" | "night"] = r.weight;
  }
  cache = { at: Date.now(), weights };
  return weights;
}

// how much each profile trait raises a factor's weight
const BOOSTS: Record<string, Record<string, number>> = {
  alone: { isolation: 1.4, foot_traffic: 1.2 },
  night: { lighting: 1.4 },
  dog: { traffic: 1.3 },
  beginner: { surface: 1.5 },
  lowVision: { surface: 1.6, traffic: 1.4, lighting: 1.3 },
};

function adjust(
  w: Weights, period: "day" | "night", traits: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  let sum = 0;
  for (const key of Object.keys(w)) {
    let v = w[key][period];
    for (const t of traits) v *= BOOSTS[t]?.[key] ?? 1;
    out[key] = v;
    sum += v;
  }
  if (sum > 0) for (const key of Object.keys(out)) out[key] /= sum;
  return out;
}

async function buildAdjusted(traits: string[] = []): Promise<Adjusted> {
  const w = await getWeights();
  return { day: adjust(w, "day", traits), night: adjust(w, "night", traits) };
}

export const toColor = (n: number): Color =>
  n >= 70 ? "green" : n >= 40 ? "yellow" : "red";

export function scoreOne(
  s: SegmentRow, adj: Adjusted, o: ScoreOptions, fx?: ReportEffect
) {
  const night = o.hour >= o.sunset || o.hour < o.sunrise;
  const period = night ? "night" : "day";
  const w = adj[period];

  const parts = {
    lighting: lighting(s, night),
    isolation: isolation(s, night),
    foot_traffic: footTraffic(s, o.hour),
    traffic: traffic(s),
    surface: surface(s),
    reports: {
      score: fx ? Math.max(0, Math.min(100, Math.round(100 - fx.penalty))) : 100,
    },
  };

  let total = 0;
  const factors: Record<string, number> = {};
  for (const [key, v] of Object.entries(parts)) {
    total += v.score * (w[key] ?? 0);
    factors[key] = v.score;
  }

  let score = Math.round(total);
  if (fx?.harassment) {
    score = Math.min(score, 39);
  } else if (fx?.hazard) {
    // drop one level
    score = score >= 70 ? Math.min(score, 69) : score >= 40 ? Math.min(score, 39) : score;
  }

  return {
    score,
    color: toColor(score),
    confidence: parts.lighting.low ? "low" : "high",
    period,
    factors,
    override: fx?.harassment ? "harassment" : fx?.hazard ? "hazard" : null,
  };
}

export async function scoreMany(rows: SegmentRow[], o: ScoreOptions) {
  const adj = await buildAdjusted(o.traits);
  const fx = await reportEffects(rows.map((r) => Number(r.id)));
  return rows.map((row) => ({
    row,
    ...scoreOne(row, adj, o, fx.get(Number(row.id))),
  }));
}

export async function scoreWithWeights(row: SegmentRow, o: ScoreOptions) {
  const adj = await buildAdjusted(o.traits);
  const fx = await reportEffects([Number(row.id)]);
  return scoreOne(row, adj, o, fx.get(Number(row.id)));
}

export async function weightsForProfiles() {
  const keys = ["default", "alone", "night", "dog", "beginner", "lowVision"];
  const out: Record<string, Adjusted> = {};
  for (const k of keys) {
    out[k] = await buildAdjusted(k === "default" ? [] : [k]);
  }
  return out;
}