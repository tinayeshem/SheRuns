import { Router, Request } from "express";
import { planLoops, planTrip, Mode } from "../services/RouteService";

export const routeRouter = Router();

const KNOWN_TRAITS = new Set(["alone", "night", "dog", "beginner", "lowVision", "wellLit"]);

function readCommon(req: Request) {
  const modeRaw = String(req.query.mode ?? "safest");
  const mode: Mode = (["fastest", "safest", "scenic"] as const).includes(modeRaw as Mode)
    ? (modeRaw as Mode)
    : "safest";

  const hour =
    req.query.hour !== undefined ? Number(req.query.hour) : new Date().getHours();
  const sunrise = req.query.sunrise !== undefined ? Number(req.query.sunrise) : 6.5;
  const sunset = req.query.sunset !== undefined ? Number(req.query.sunset) : 19.5;
  if (![hour, sunrise, sunset].every(Number.isFinite)) return null;

  const traits = String(req.query.traits ?? "")
    .split(",")
    .filter((t) => KNOWN_TRAITS.has(t));
  const avoid = String(req.query.avoid ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .slice(0, 80);

  return { mode, hour, sunrise, sunset, traits, avoid };
}

const validPoint = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

routeRouter.get("/loop", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!validPoint(lat, lng)) {
      res.status(400).json({ error: "lat and lng are required" });
      return;
    }

    const kmRaw = Number(req.query.km ?? 5);
    const km = Math.min(12, Math.max(1, Number.isFinite(kmRaw) ? kmRaw : 5));

    const c = readCommon(req);
    if (!c) {
      res.status(400).json({ error: "bad hour, sunrise or sunset" });
      return;
    }

    const result = await planLoops({
      lat, lng, km, mode: c.mode, avoid: c.avoid,
      opts: { hour: c.hour, sunrise: c.sunrise, sunset: c.sunset, traits: c.traits },
    });
    if ("error" in result) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

routeRouter.get("/trip", async (req, res) => {
  try {
    const fromLat = Number(req.query.fromLat);
    const fromLng = Number(req.query.fromLng);
    const toLat = Number(req.query.toLat);
    const toLng = Number(req.query.toLng);
    if (!validPoint(fromLat, fromLng) || !validPoint(toLat, toLng)) {
      res.status(400).json({ error: "fromLat, fromLng, toLat and toLng are required" });
      return;
    }

    const c = readCommon(req);
    if (!c) {
      res.status(400).json({ error: "bad hour, sunrise or sunset" });
      return;
    }

    const result = await planTrip({
      from: { lat: fromLat, lng: fromLng },
      to: { lat: toLat, lng: toLng },
      mode: c.mode,
      avoid: c.avoid,
      opts: { hour: c.hour, sunrise: c.sunrise, sunset: c.sunset, traits: c.traits },
    });
    if ("error" in result) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});