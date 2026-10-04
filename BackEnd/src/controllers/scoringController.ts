import { Router } from "express";
import { weightsForProfiles } from "../services/ScoreService";

export const scoringRouter = Router();

scoringRouter.get("/weights", async (_req, res) => {
  try {
    res.json(await weightsForProfiles());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});