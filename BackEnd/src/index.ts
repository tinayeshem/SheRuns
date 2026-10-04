import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./config/db";
import { segmentRouter } from "./controllers/segmentController";
import { routeRouter } from "./controllers/routeController";
import { placeRouter } from "./controllers/placeController";
import { reportRouter, adminRouter } from "./controllers/reportController";
import { scoringRouter } from "./controllers/scoringController";
import { liveRouter } from "./controllers/liveController";
import { accountRouter } from "./controllers/accountController";
import { geocodeRouter } from "./controllers/geocodeController";
import { cleanupLive } from "./repositories/liveRepository";
import { runAlerts, smsConfigured } from "./services/AlertService";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "1mb" }));

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

app.use("/segments", segmentRouter);
app.use("/routes", routeRouter);
app.use("/places", placeRouter);
app.use("/reports", reportRouter);
app.use("/admin", adminRouter);
app.use("/scoring", scoringRouter);
app.use("/live", liveRouter);
app.use("/account", accountRouter);
app.use("/geocode", geocodeRouter);

// delete expired live sessions, locations and phone numbers every 15 minutes
const clean = () => cleanupLive().catch((e) => console.error("cleanup failed", e));
clean();
setInterval(clean, 15 * 60 * 1000);

// look for overdue runs every 30 seconds
const alerts = () => runAlerts().catch((e) => console.error("alerts failed", e));
alerts();
setInterval(alerts, 30 * 1000);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  console.log(
    smsConfigured()
      ? "SMS alerts: live (Twilio)"
      : "SMS alerts: test mode (messages are printed here, not sent)"
  );
});