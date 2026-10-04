import { Router } from "express";
import {
  adminAbuse, adminList, adminSet, countRecentByDevice, getById,
  insertReport, listActiveInBbox, typeExists, vote,
} from "../repositories/reportRepository";
import { clearReportCache } from "../services/ReportEffects";
import { requireAdmin, requireUser } from "../middleware/auth";

export const reportRouter = Router();
export const adminRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

reportRouter.get("/", async (req, res) => {
  try {
    const parts = String(req.query.bbox ?? "").split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      res.status(400).json({ error: "bbox must be west,south,east,north" });
      return;
    }
    const [w, s, e, n] = parts;
    if ((e - w) * (n - s) > 0.05) {
      res.status(400).json({ error: "area too large, zoom in" });
      return;
    }
    res.json({ reports: await listActiveInBbox(w, s, e, n, 200) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

reportRouter.post("/", requireUser, async (req, res) => {
  try {
    const user = req.user!.id;
    const { type, lng, lat, note } = req.body ?? {};
    if (typeof type !== "string" || !(await typeExists(type))) {
      res.status(400).json({ error: "unknown report type" });
      return;
    }
    if (
      !Number.isFinite(lng) || !Number.isFinite(lat) ||
      Math.abs(lng) > 180 || Math.abs(lat) > 90
    ) {
      res.status(400).json({ error: "bad location" });
      return;
    }
    const text = typeof note === "string" ? note.trim().slice(0, 200) : "";
    if ((await countRecentByDevice(user)) >= 5) {
      res.status(429).json({ error: "Too many reports. Try again later." });
      return;
    }
    const id = await insertReport(type, lng, lat, text || null, user);
    clearReportCache();
    res.status(201).json({ report: await getById(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

reportRouter.post("/:id/:action", requireUser, async (req, res) => {
  try {
      const id = String(req.params.id);
    const action = String(req.params.action);
    if (!UUID.test(id) || (action !== "confirm" && action !== "gone")) {
      res.status(400).json({ error: "bad request" });
      return;
    }
    const result = await vote(id, req.user!.id, action as "confirm" | "gone");
    if (result === "missing") {
      res.status(404).json({ error: "report not found" });
      return;
    }
    if (result === "own") {
      res.status(403).json({ error: "You cannot answer for your own report" });
      return;
    }
    if (result === "already") {
      res.status(409).json({ error: "You already answered for this report" });
      return;
    }
    clearReportCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

adminRouter.use(requireAdmin);

adminRouter.get("/reports", async (req, res) => {
  try {
    const status = String(req.query.status ?? "pending");
    if (!["pending", "approved", "removed"].includes(status)) {
      res.status(400).json({ error: "bad status" });
      return;
    }
    res.json({ reports: await adminList(status) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

adminRouter.post("/reports/:id/:action", async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!UUID.test(id) || (action !== "approve" && action !== "remove")) {
      res.status(400).json({ error: "bad request" });
      return;
    }
    const ok = await adminSet(id, action === "approve" ? "approved" : "removed");
    if (!ok) {
      res.status(404).json({ error: "report not found" });
      return;
    }
    clearReportCache();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

adminRouter.get("/abuse", async (_req, res) => {
  try {
    res.json({ devices: await adminAbuse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});