import { Router } from "express";
import { requireUser } from "../middleware/auth";
import { deleteUserData } from "../repositories/accountRepository";

export const accountRouter = Router();

// legacy keys are JWTs and go in both headers; new secret keys go in apikey only
function adminHeaders(key: string): Record<string, string> {
  return key.startsWith("eyJ")
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}

accountRouter.delete("/", requireUser, async (req, res) => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      res.status(503).json({ error: "Account deletion is not configured on the server" });
      return;
    }
    const id = req.user!.id;
    await deleteUserData(id);

    const r = await fetch(
      `${url.replace(/\/+$/, "")}/auth/v1/admin/users/${encodeURIComponent(id)}`,
      { method: "DELETE", headers: adminHeaders(key), signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok && r.status !== 404) {
      console.error(`Deleting the login failed with status ${r.status}`);
      res.status(502).json({
        error: "Your data was removed, but the login could not be deleted. Try again.",
      });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed" });
  }
});