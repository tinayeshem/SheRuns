import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import MapView from "../map/MapView";
import { createReport } from "../features/reports/api";
import { REPORT_TYPES } from "../features/reports/types";

export default function ReportIssue() {
  const navigate = useNavigate();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [pos, setPos] = useState<{ lng: number; lat: number } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      setPos({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      setError(null);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !pos) return;
    const marker = new maplibregl.Marker({ color: "#ea580c" })
      .setLngLat([pos.lng, pos.lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, pos]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lng: p.coords.longitude, lat: p.coords.latitude };
        setPos(here);
        map?.flyTo({ center: [here.lng, here.lat], zoom: 16 });
      },
      () => setError("Could not get your location. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async () => {
    if (!type) {
      setError("Choose what you want to report.");
      return;
    }
    if (!pos) {
      setError("Tap the map to drop a pin.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createReport({ type, lng: pos.lng, lat: pos.lat, note });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} zoom={15} />
      </div>

      <button
        type="button"
        onClick={() => navigate("/home")}
        className="absolute top-3 left-3 z-10 bg-white rounded-lg shadow px-3 py-1 text-sm"
      >
        Back
      </button>

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-lg p-4 max-h-[55vh] overflow-y-auto">
        {done ? (
          <div>
            <p className="font-bold mb-1">Thank you</p>
            <p className="text-sm text-gray-600 mb-4">
              Your report is live. Streets near it are scored lower until it
              expires, and a moderator will review it.
            </p>
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-medium mb-2"
            >
              See nearby reports
            </button>
            <button
              type="button"
              onClick={() => navigate("/home")}
              className="w-full border rounded-xl py-3"
            >
              Back to the map
            </button>
          </div>
        ) : (
          <div>
            <p className="font-bold mb-2">What do you want to report?</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setType(t.key);
                    setError(null);
                  }}
                  className={`border rounded-lg py-2 text-sm ${
                    type === t.key ? "bg-green-600 text-white border-green-600" : ""
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">
                {pos ? "Pin placed. Tap the map to move it." : "Tap the map to drop a pin."}
              </span>
              <button
                type="button"
                onClick={useMyLocation}
                className="border rounded-lg px-2 py-1"
              >
                My location
              </button>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="Note (optional)"
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
              rows={2}
            />

            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="w-full bg-green-600 text-white rounded-xl py-3 font-bold disabled:opacity-60"
            >
              {busy ? "Sending..." : "Submit report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}