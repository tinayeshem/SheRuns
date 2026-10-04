import type { AdminReport, Report } from "./types";
import { authHeaders } from "../auth/token";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(await authHeaders()),
    },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}

export async function fetchReports(
  bbox: [number, number, number, number]
): Promise<Report[]> {
  const q = bbox.map((n) => n.toFixed(5)).join(",");
  return (await call(`/reports?bbox=${q}`)).reports;
}

export async function createReport(input: {
  type: string;
  lng: number;
  lat: number;
  note: string;
}): Promise<Report> {
  return (
    await call("/reports", { method: "POST", body: JSON.stringify(input) })
  ).report;
}

export async function voteReport(id: string, kind: "confirm" | "gone") {
  await call(`/reports/${id}/${kind}`, { method: "POST" });
}

export async function adminList(status: string): Promise<AdminReport[]> {
  return (await call(`/admin/reports?status=${status}`)).reports;
}

export async function adminSet(id: string, action: "approve" | "remove") {
  await call(`/admin/reports/${id}/${action}`, { method: "POST" });
}

export async function adminAbuse(): Promise<{ device: string; n: number }[]> {
  return (await call("/admin/abuse")).devices;
}