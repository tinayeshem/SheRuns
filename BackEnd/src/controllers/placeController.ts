import { Router } from "express";
import { findAlongLine } from "../repositories/placeRepository";

export const placeRouter = Router();

placeRouter.post("/along", async (req, res) => {
  try {
    const coords = req.body?.coordinates;
    const valid =
      Array.isArray(coords) &&
      coords.length >= 2 &&
      coords.length <= 5000 &&
      coords.every(
        (c: unknown) =>
          Array.isArray(c) &&
          c.length >= 2 &&
          Number.isFinite(c[0]) &&
          Number.isFinite(c[1])
      );
    if (!valid) {
      res.status(400).json({ error: "coordinates must be a list of [lng, lat]" });
      return;
    }

    const geojson = JSON.stringify({ type: "LineString", coordinates: coords });
    const rows = await findAlongLine(geojson, 60);

    res.json({
      stops: rows.map((r: any) => ({
        kind: r.kind,
        name: r.name,
        openingHours: r.opening_hours,
        lng: r.lng,
        lat: r.lat,
        distanceM: Math.round(r.dist_m),
        along: r.along,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});