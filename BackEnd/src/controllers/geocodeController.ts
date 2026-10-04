import { Router } from "express";
import { GeocoderBusy, searchAddress } from "../integrations/geocoder";

export const geocodeRouter = Router();

const hits = new Map<string, { n: number; reset: number }>();

// 20 searches per minute per address
function limited(ip: string) {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  h.n++;
  return h.n > 20;
}

geocodeRouter.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < 3 || q.length > 120) {
      res.status(400).json({ error: "Type between 3 and 120 characters." });
      return;
    }
    if (limited(req.ip ?? "unknown")) {
      res.status(429).json({ error: "Too many searches. Wait a minute and try again." });
      return;
    }
    res.json({ places: await searchAddress(q) });
  } catch (err) {
    if (err instanceof GeocoderBusy) {
      res.status(503).json({ error: "Address search is busy. Try again in a few seconds." });
      return;
    }
    console.error(err);
    res.status(502).json({ error: "Address search is not available right now." });
  }
});