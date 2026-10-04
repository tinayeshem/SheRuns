import { penaltyRows } from "../repositories/reportRepository";

export type ReportEffect = {
  penalty: number;
  harassment: boolean;
  hazard: boolean;
};

type Entry = { at: number; fx: ReportEffect | null };

const TTL = 30_000;
const cache = new Map<number, Entry>();

export function clearReportCache() {
  cache.clear();
}

export async function reportEffects(ids: number[]) {
  const now = Date.now();
  if (cache.size > 300_000) cache.clear();

  const missing = ids.filter((id) => {
    const e = cache.get(id);
    return !e || now - e.at > TTL;
  });

  if (missing.length) {
    const rows = await penaltyRows(missing);
    const agg = new Map<number, ReportEffect>();

    for (const r of rows) {
      const age = Number(r.age_h);
      const decay = age <= 24 ? 1 : age <= 72 ? 0.5 : 0.25;
      const weight = 1 + 0.25 * (Math.min(r.confirmations, 5) - 1);
      const fx = agg.get(r.seg) ?? { penalty: 0, harassment: false, hazard: false };

      fx.penalty = Math.min(100, fx.penalty + r.penalty * decay * weight);
      if (
        r.type === "harassment" && age <= 72 &&
        (r.status === "approved" || r.confirmations >= 2)
      ) {
        fx.harassment = true;
      }
      if ((r.type === "ice" || r.type === "flooding") && age <= 72) {
        fx.hazard = true;
      }
      agg.set(r.seg, fx);
    }

    for (const id of missing) cache.set(id, { at: now, fx: agg.get(id) ?? null });
  }

  const out = new Map<number, ReportEffect>();
  for (const id of ids) {
    const fx = cache.get(id)?.fx;
    if (fx) out.set(id, fx);
  }
  return out;
}