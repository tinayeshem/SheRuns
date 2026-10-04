import { authHeaders } from "./token";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function deleteAccountApi(): Promise<void> {
  const res = await fetch(`${API}/account`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    let msg = `Could not delete the account (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // keep the default message
    }
    throw new Error(msg);
  }
}