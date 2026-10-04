import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminAbuse, adminList, adminSet } from "../features/reports/api";
import { timeAgo } from "../features/reports/format";
import type { AdminReport } from "../features/reports/types";

type Status = "pending" | "approved" | "removed";

export default function Admin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<AdminReport[]>([]);
  const [abuse, setAbuse] = useState<{ device: string; n: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (st: Status) => {
    setLoading(true);
    setError(null);
    try {
      const [list, ab] = await Promise.all([adminList(st), adminAbuse()]);
      setItems(list);
      setAbuse(ab);
    } catch (e) {
      setError((e as Error).message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  const act = async (id: string, action: "approve" | "remove") => {
    try {
      await adminSet(id, action);
      await load(status);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Moderation queue</h1>
        <button
          type="button"
          onClick={() => navigate("/home")}
          className="border rounded-lg px-3 py-1 text-sm bg-white"
        >
          Back
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        {(["pending", "approved", "removed"] as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`flex-1 border rounded-lg py-1 text-sm ${
              status === s ? "bg-green-600 text-white border-green-600" : "bg-white"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-sm text-gray-500 mb-3">Loading...</p>}

      {abuse.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-3 text-sm">
          <p className="font-medium mb-1">Possible abuse (3 or more reports in 1 hour)</p>
          {abuse.map((a) => (
            <p key={a.device}>
              User {a.device}: {a.n} reports
            </p>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-gray-500">Nothing here.</p>
      )}

      {items.map((r) => (
        <div key={r.id} className="bg-white border rounded-xl p-3 mb-2">
          <div className="flex justify-between">
            <span className="font-medium">{r.label}</span>
            <span className="text-xs text-gray-500">{timeAgo(r.createdAt)}</span>
          </div>
          {r.note && <p className="text-sm text-gray-700">{r.note}</p>}
          <p className="text-xs text-gray-500">
            {r.confirmations} confirmation(s), {r.goneVotes} gone · user {r.device ?? "?"} ·{" "}
            {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
          </p>
          <div className="flex gap-2 mt-2">
            {r.status !== "approved" && (
              <button
                type="button"
                onClick={() => act(r.id, "approve")}
                className="flex-1 border rounded-lg py-1 text-sm"
              >
                Approve
              </button>
            )}
            {r.status !== "removed" && (
              <button
                type="button"
                onClick={() => act(r.id, "remove")}
                className="flex-1 border border-red-300 text-red-700 rounded-lg py-1 text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}