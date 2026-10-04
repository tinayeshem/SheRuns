import { Router, Request, Response } from "express";
import {
  LiveRow, countRecentStarts, createSession, extendSession, finishSession,
  getByToken, markSos, updatePosition,
} from "../repositories/liveRepository";
import {
  hashKey, keyMatches, newOwnerKey, newToken, publicView,
} from "../services/LiveService";
import { notifyAllClear, runAlerts, smsConfigured } from "../services/AlertService";
import { requireUser } from "../middleware/auth";

export const liveRouter = Router();

const TOKEN = /^[a-f0-9]{32}$/;
const OWNER = /^[a-f0-9]{48}$/;
const DEVICE = /^[A-Za-z0-9-]{8,64}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

liveRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function coords(body: any): { lng: number; lat: number } | null {
  const lng = body?.lng;
  const lat = body?.lat;
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
  return { lng, lat };
}

function phones(raw: unknown): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 3) return null;
  const out = new Set<string>();
  for (const p of raw) {
    if (typeof p !== "string") return null;
    const clean = p.replace(/[\s\-().]/g, "");
    if (!E164.test(clean)) return null;
    out.add(clean);
  }
  return [...out];
}

async function owned(req: Request, res: Response): Promise<LiveRow | null> {
  const token = String(req.params.token);
  const key = req.header("x-owner-key") ?? "";
  if (!TOKEN.test(token) || !OWNER.test(key)) {
    res.status(400).json({ error: "bad request" });
    return null;
  }
  const row = await getByToken(token);
  if (!row || !keyMatches(key, row.owner_key_hash)) {
    res.status(404).json({ error: "session not found" });
    return null;
  }
  return row;
}

async function freshView(token: string) {
  const row = await getByToken(token);
  return row ? publicView(row) : null;
}

liveRouter.post("/start", requireUser, async (req, res) =>  {
  try {
    const device = req.user!.id;
    const pos = coords(req.body);
    if (!pos) {
      res.status(400).json({ error: "bad location" });
      return;
    }

    const expectedMin = Math.round(Number(req.body?.expectedMinutes));
    if (!Number.isFinite(expectedMin) || expectedMin < 5 || expectedMin > 360) {
      res.status(400).json({ error: "expected time must be 5 to 360 minutes" });
      return;
    }
    const graceRaw = req.body?.graceMinutes;
    const graceMin = graceRaw === undefined ? 10 : Math.round(Number(graceRaw));
    if (!Number.isFinite(graceMin) || graceMin < 5 || graceMin > 60) {
      res.status(400).json({ error: "grace must be 5 to 60 minutes" });
      return;
    }

    const list = phones(req.body?.alertPhones);
    if (!list) {
      res.status(400).json({
        error: "Contact numbers need a country code, for example +48..., and there can be at most 3.",
      });
      return;
    }

    const rawName = typeof req.body?.name === "string" ? req.body.name : "";
    const name = rawName.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30);

    if ((await countRecentStarts(device)) >= 5) {
      res.status(429).json({ error: "Too many runs started. Try again later." });
      return;
    }

    const token = newToken();
    const ownerKey = newOwnerKey();
    const row = await createSession({
      token,
      ownerKeyHash: hashKey(ownerKey),
      device,
      name: name || null,
      expectedMin,
      graceMin,
      lng: pos.lng,
      lat: pos.lat,
      phones: list,
    });

    res.status(201).json({
      token,
      ownerKey,
      view: publicView(row),
      sms: {
        mode: list.length === 0 ? "off" : smsConfigured() ? "live" : "test",
        contacts: list.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

liveRouter.post("/:token/update", async (req, res) => {
  try {
    const row = await owned(req, res);
    if (!row) return;
    const pos = coords(req.body);
    if (!pos) {
      res.status(400).json({ error: "bad location" });
      return;
    }
    await updatePosition(row.id, pos.lng, pos.lat);
    res.json({ view: await freshView(row.token) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

liveRouter.post("/:token/extend", async (req, res) => {
  try {
    const row = await owned(req, res);
    if (!row) return;
    const minutes = Number(req.body?.minutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60) {
      res.status(400).json({ error: "minutes must be 5 to 60" });
      return;
    }
    await extendSession(row.id, minutes);
    res.json({ view: await freshView(row.token) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

liveRouter.post("/:token/sos", async (req, res) => {
  try {
    const row = await owned(req, res);
    if (!row) return;
    await markSos(row.id);
    // send the texts right away instead of waiting for the next check
    runAlerts().catch((e) => console.error("alerts failed", e));
    res.json({ view: await freshView(row.token) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

liveRouter.post("/:token/finish", async (req, res) => {
  try {
    const row = await owned(req, res);
    if (!row) return;
    await finishSession(row.id);
    res.json({ view: await freshView(row.token) });
    notifyAllClear(row).catch((e) => console.error("all clear failed", e));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});

// public: what a contact sees
liveRouter.get("/:token", async (req, res) => {
  try {
    const token = String(req.params.token);
    if (!TOKEN.test(token)) {
      res.status(404).json({ error: "This link is not valid" });
      return;
    }
    const row = await getByToken(token);
    if (!row) {
      res.status(404).json({ error: "This link is not valid or has expired" });
      return;
    }
    res.json({ view: publicView(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});