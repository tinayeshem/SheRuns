import { authHeaders } from "../auth/token";
import type { RouteResult } from "../routing/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type LiveStatus =
  | "active" | "signal_lost" | "overdue" | "sos" | "finished" | "expired";

export type LiveView = {
  name: string | null;
  status: LiveStatus;
  graceMin: number;
  secondsToExpected: number;
  lastUpdateAgeSec: number | null;
  position: { lng: number; lat: number } | null;
  trail: [number, number][];
};

export type SmsInfo = { mode: "off" | "test" | "live"; contacts: number };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call(
  path: string,
  init: RequestInit = {},
  headers: Record<string, string> = {}
) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status);
  }
  return body;
}

const owner = (key: string) => ({ "x-owner-key": key });

export async function startSession(input: {
  name: string;
  expectedMinutes: number;
  graceMinutes: number;
  lng: number;
  lat: number;
  alertPhones: string[];
}): Promise<{ token: string; ownerKey: string; view: LiveView; sms: SmsInfo }> {
  return call(
    "/live/start",
    { method: "POST", body: JSON.stringify(input) },
      await authHeaders()
  );
}

export async function sendUpdate(
  token: string, key: string, lng: number, lat: number
): Promise<LiveView> {
  return (
    await call(
      `/live/${token}/update`,
      { method: "POST", body: JSON.stringify({ lng, lat }) },
      owner(key)
    )
  ).view;
}

export async function extendSession(
  token: string, key: string, minutes: number
): Promise<LiveView> {
  return (
    await call(
      `/live/${token}/extend`,
      { method: "POST", body: JSON.stringify({ minutes }) },
      owner(key)
    )
  ).view;
}

export async function sendSos(token: string, key: string): Promise<LiveView> {
  return (await call(`/live/${token}/sos`, { method: "POST" }, owner(key))).view;
}

export async function finishSession(token: string, key: string): Promise<void> {
  await call(`/live/${token}/finish`, { method: "POST" }, owner(key));
}

export async function getShared(token: string, signal?: AbortSignal): Promise<LiveView> {
  return (await call(`/live/${token}`, { signal })).view;
}

// the runner's phone remembers the session, so a reload resumes the run
const KEY = "safe-run-live";

export type Saved = {
  token: string;
  ownerKey: string;
  route: RouteResult;
  name: string | null;
  startedAt: number;
  sms?: SmsInfo;
};

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (
      typeof s?.token === "string" &&
      typeof s?.ownerKey === "string" &&
      s?.route?.geometry
    ) {
      return s as Saved;
    }
  } catch {
    // ignore broken storage
  }
  return null;
}

export function saveSaved(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage not available
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage not available
  }
}