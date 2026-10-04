import { Router } from "express";
import { findInBbox, findById } from "../repositories/segmentRepository";
import { scoreMany, scoreWithWeights } from "../services/ScoreService";
import { streetLabel } from "../services/streetLabel";

export const segmentRouter = Router();

function readOptions(q: any) {
  return {
    hour: q.hour !== undefined ? Number(q.hour) : new Date().getHours(),
    sunrise: q.sunrise !== undefined ? Number(q.sunrise) : 6.5,
    sunset: q.sunset !== undefined ? Number(q.sunset) : 19.5,
  };
}

segmentRouter.get("/", async (req, res) => {
  try {
    const parts = String(req.query.bbox ?? "").split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      res.status(400).json({ error: "bbox must be west,south,east,north" });
      return;
    }
    const [w, s, e, n] = parts;
    if ((e - w) * (n - s) > 0.03) {
      res.status(400).json({ error: "area too large, zoom in" });
      return;
    }
    const o = readOptions(req.query);
    if (![o.hour, o.sunrise, o.sunset].every(Number.isFinite)) {
      res.status(400).json({ error: "bad hour, sunrise or sunset" });
      return;
    }

    const LIMIT = 8000;
    const rows = await findInBbox(w, s, e, n, LIMIT);
    const scored = await scoreMany(rows, o);

    res.json({
      type: "FeatureCollection",
      truncated: rows.length === LIMIT,
      features: scored.map(({ row, score, color, confidence }) => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id: row.id, name: streetLabel(row.name, row.highway),
          highway: row.highway, score, color, confidence,
        },
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

segmentRouter.get("/:id", async (req, res) => {
  try {
    const row = await findById(Number(req.params.id));
    if (!row) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const o = readOptions(req.query);
    const result = await scoreWithWeights(row, o);
    res.json({
      id: row.id, name: streetLabel(row.name, row.highway),
      highway: row.highway, hour: o.hour, ...result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});