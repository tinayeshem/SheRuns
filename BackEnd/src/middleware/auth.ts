import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export type AuthUser = { id: string; email: string | null; role: string | null };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

class AuthDown extends Error {}

const TTL = 60_000;
const cache = new Map<string, { user: AuthUser; until: number }>();

// asks Supabase who this token belongs to
async function verify(token: string): Promise<AuthUser | null> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) throw new AuthDown("Login is not configured on the server");

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const hit = cache.get(hash);
  if (hit && hit.until > now) return hit.user;

  let res: globalThis.Response;
  try {
    res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AuthDown("Could not reach the login service");
  }
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new AuthDown("The login service is not available");

  const u: any = await res.json();
  if (!u?.id) return null;
  const user: AuthUser = {
    id: String(u.id),
    email: u.email ?? null,
    role: typeof u.app_metadata?.role === "string" ? u.app_metadata.role : null,
  };
  if (cache.size > 5000) cache.clear();
  cache.set(hash, { user, until: now + TTL });
  return user;
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const m = /^Bearer\s+(\S{20,4000})$/.exec(req.header("authorization") ?? "");
    if (!m) {
      res.status(401).json({ error: "Please log in to do this." });
      return;
    }
    const user = await verify(m[1]);
    if (!user) {
      res.status(401).json({ error: "Your session has expired. Please log in again." });
      return;
    }
    req.user = user;
    next();
  } catch (e) {
    if (e instanceof AuthDown) {
      res.status(503).json({ error: e.message });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireUser(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Administrators only" });
      return;
    }
    next();
  });
}
