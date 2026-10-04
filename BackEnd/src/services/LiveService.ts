import crypto from "crypto";
import type { LiveRow } from "../repositories/liveRepository";

export type LiveStatus =
  | "active" | "signal_lost" | "overdue" | "sos" | "finished" | "expired";

export const newToken = () => crypto.randomBytes(16).toString("hex");
export const newOwnerKey = () => crypto.randomBytes(24).toString("hex");
export const hashKey = (k: string) =>
  crypto.createHash("sha256").update(k).digest("hex");

export function keyMatches(given: string, hash: string) {
  const a = Buffer.from(hashKey(given), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function statusOf(r: LiveRow, now = Date.now()): LiveStatus {
  if (r.finished_at) return "finished";
  if (now > r.expires_at.getTime()) return "expired";
  if (r.sos_at) return "sos";
  if (now > r.expected_end.getTime() + r.grace_min * 60_000) return "overdue";
  if (r.last_update_at && now - r.last_update_at.getTime() > 3 * 60_000) {
    return "signal_lost";
  }
  return "active";
}

// what a contact (or the runner) is allowed to see
export function publicView(r: LiveRow) {
  const now = Date.now();
  const status = statusOf(r, now);
  const closed = status === "finished" || status === "expired";
  const hasPos = !closed && r.last_lng !== null && r.last_lat !== null;

  return {
    name: r.display_name,
    status,
    graceMin: r.grace_min,
    secondsToExpected: Math.round((r.expected_end.getTime() - now) / 1000),
    lastUpdateAgeSec:
      !closed && r.last_update_at
        ? Math.max(0, Math.round((now - r.last_update_at.getTime()) / 1000))
        : null,
    position: hasPos ? { lng: r.last_lng, lat: r.last_lat } : null,
    trail: closed ? [] : r.trail,
  };
}