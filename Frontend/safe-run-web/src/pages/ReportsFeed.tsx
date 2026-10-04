import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import MapView from "../map/MapView";
import { fetchReports, voteReport } from "../features/reports/api";
import { useReportsLayer } from "../features/reports/useReportsLayer";
import { expiresIn, timeAgo } from "../features/reports/format";
import type { Report } from "../features/reports/types";

export default function ReportsFeed() {
  const navigate = useNavigate();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const seq = useRef(0);

  useReportsLayer(map, reports);

  const load = useCallback(async () => {
    if (!map) return;
    const mine = ++seq.current;
    const b = map.getBounds();
    const w = b.getWest(), s = b.getSouth(), e = b.getEast(), n = b.getNorth();
    if ((e - w) * (n - s) > 0.05) {
      setReports([]);
      setError("Zoom in to see reports");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchReports([w, s, e, n]);
      if (mine === seq.current) setReports(list);
    } catch (err) {
      if (mine === seq.current) setError((err as Error).message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [map]);

  useEffect(() => {
    if (!map) return;
    load();
    map.on("moveend", load);
    return () => {
      map.off("moveend", load);
    };
  }, [map, load]);

  const answer = async (id: string, kind: "confirm" | "gone") => {
    setMsgs((m) => ({ ...m, [id]: "Sending..." }));
    try {
      await voteReport(id, kind);
      setMsgs((m) => ({
        ...m,
        [id]: kind === "confirm" ? "Thanks, confirmed." : "Thanks, noted.",
      }));
      await load();
    } catch (err) {
      setMsgs((m) => ({ ...m, [id]: (err as Error).message }));
    }
  };

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} zoom={14} />
      </div>

      <button
        type="button"
        onClick={() => navigate("/home")}
        className="absolute top-3 left-3 z-10 bg-white rounded-lg shadow px-3 py-1 text-sm"
      >
        Back
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-lg p-4 max-h-[55vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <p className="font-bold">Reports in this area</p>
          <button
            type="button"
            onClick={() => navigate("/report")}
            className="border rounded-lg px-3 py-1 text-sm"
          >
            Report an issue
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && reports.length === 0 && (
          <p className="text-sm text-gray-500">
            No active reports here. Move the map to look elsewhere.
          </p>
        )}

        <ul>
          {reports.map((r) => (
            <li key={r.id} className="border rounded-xl p-3 mb-2">
              <div className="flex justify-between">
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-gray-500">{timeAgo(r.lastConfirmedAt)}</span>
              </div>
              {r.note && <p className="text-sm text-gray-700">{r.note}</p>}
              <p className="text-xs text-gray-500">
                {r.confirmations} confirmation{r.confirmations === 1 ? "" : "s"},{" "}
                {expiresIn(r.expiresAt)}
                {r.status === "pending" && ", awaiting review"}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => answer(r.id, "confirm")}
                  className="flex-1 border rounded-lg py-1 text-sm"
                >
                  Still there?
                </button>
                <button
                  type="button"
                  onClick={() => answer(r.id, "gone")}
                  className="flex-1 border rounded-lg py-1 text-sm"
                >
                  Gone
                </button>
                <button
                  type="button"
                  onClick={() => map?.flyTo({ center: [r.lng, r.lat], zoom: 17 })}
                  className="flex-1 border rounded-lg py-1 text-sm"
                >
                  Show
                </button>
              </div>
              {msgs[r.id] && <p className="text-xs text-gray-600 mt-1">{msgs[r.id]}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}