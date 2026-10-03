import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./config/db";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/db-check", async (_req, res) => {
  try {
    const result = await pool.query("SELECT PostGIS_Version() AS version");
    res.json({ database: "connected", postgis: result.rows[0].version });
  } catch (err) {
    console.error(err);
    res.status(500).json({ database: "failed" });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});