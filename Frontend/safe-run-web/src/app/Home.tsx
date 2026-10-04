import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  Flag, HeartPulse, History as HistoryIcon, Info, Layers, ListChecks, LogIn, LogOut,
  Moon, Navigation, Settings as SettingsIcon, ShieldCheck, Sun, Sunset, Thermometer, Wind,
} from "lucide-react";
import MapView from "../map/MapView";
import { useConditions } from "../features/conditions/useConditions";
import { useSafetyLayer } from "../features/safety-map/useSafetyLayer";
import { loadSaved } from "../features/live/api";
import { useAuth } from "../features/auth/AuthProvider";

const toHour = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
};

const SCORES_KEY = "safe-run-scores";

export default function Home() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [runActive] = useState(() => loadSaved() !== null);
  const { data, error } = useConditions();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [hour, setHour] = useState(new Date().getHours());
  const [showScores, setShowScores] = useState(() => {
    try {
      return localStorage.getItem(SCORES_KEY) !== "off";
    } catch {
      return true;
    }
  });

  const sunset = data ? toHour(data.sunset) : 18;
  const status = useSafetyLayer(map, hour, sunset);
  const night = hour >= sunset || hour < 6.5;

  // show or hide the colored street lines
  useEffect(() => {
    if (!map) return;
    if (map.getLayer("segments-line")) {
      map.setLayoutProperty(
        "segments-line",
        "visibility",
        showScores ? "visible" : "none"
      );
    }
    try {
      localStorage.setItem(SCORES_KEY, showScores ? "on" : "off");
    } catch {
      // storage not available
    }
  }, [map, showScores, status]);

  const airTone =
    !data ? "" : data.aqi <= 40 ? "bg-emerald-50 text-emerald-700"
    : data.aqi <= 60 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

  const actions = [
    { label: "Report", icon: Flag, to: "/report" },
    { label: "Reports", icon: ListChecks, to: "/reports" },
    { label: "Health", icon: HeartPulse, to: "/health" },
    { label: "History", icon: HistoryIcon, to: "/history" },
    { label: "Settings", icon: SettingsIcon, to: "/settings" },
    { label: "How it works", icon: Info, to: "/how-it-works" },
    ...(isAdmin ? [{ label: "Moderation", icon: ShieldCheck, to: "/admin" }] : []),
  ];

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} />
      </div>

      {runActive && (
        <button type="button" onClick={() => navigate("/live-run")} className="map-banner">
          Run in progress. Tap to resume.
        </button>
      )}

      {showScores && status !== "idle" && (
        <div className="map-chip">
          {status === "zoom" && "Zoom in to see street scores"}
          {status === "loading" && "Loading scores..."}
          {status === "error" && "Could not load scores. Is the API running?"}
        </div>
      )}

      <div className="sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-200 md:hidden" />

        <div className="mb-3 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full grad-brand text-sm font-bold text-white">
              {user ? (user.email ?? "?").charAt(0).toUpperCase() : "G"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand-950">
                {user ? user.email : "Browsing as a guest"}
              </p>
              <p className="text-xs text-gray-500">
                {user ? "Logged in" : "Log in to report and share runs"}
              </p>
            </div>
          </div>
          {user ? (
            <button
              type="button"
              onClick={signOut}
              aria-label="Log out"
              className="rounded-xl p-2 text-gray-500 hover:bg-brand-50 hover:text-brand-700"
            >
              <LogOut size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="btn-ghost px-3 py-2 text-sm"
            >
              <LogIn size={16} aria-hidden="true" /> Log in
            </button>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {error && <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">Conditions unavailable</span>}
          {!error && !data && <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-500">Loading conditions...</span>}
          {data && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-brand-800">
                <Thermometer size={14} aria-hidden="true" /> {data.temp}°C
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${airTone}`}>
                <Wind size={14} aria-hidden="true" /> {data.aqiLabel} ({data.aqi})
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-brand-800">
                <Sunset size={14} aria-hidden="true" /> {data.sunset}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate("/plan?run=1")}
          className="btn-primary run-now mb-4 w-full py-4 text-lg"
        >
          <Navigation size={20} aria-hidden="true" /> RUN NOW
        </button>

        <div className="mb-4 rounded-2xl bg-brand-50/70 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm text-brand-900">
              <Layers size={15} aria-hidden="true" /> Street scores on the map
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showScores}
              aria-label="Show street scores on the map"
              onClick={() => setShowScores((s) => !s)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                showScores ? "bg-brand-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  showScores ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <div className={showScores ? "" : "pointer-events-none opacity-40"}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-brand-900">
                {night ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
                Time of day
              </span>
              <span className="font-bold text-brand-900">{String(hour).padStart(2, "0")}:00</span>
            </div>
            <input
              type="range"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              aria-label="Time of day"
              disabled={!showScores}
              className="w-full"
            />
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-600">
              <span><span style={{ color: "#2e9e4f" }}>●</span> Good</span>
              <span><span style={{ color: "#e6a817" }}>●</span> Careful</span>
              <span><span style={{ color: "#d64545" }}>●</span> Avoid</span>
              <span>Faded = low confidence</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {actions.map(({ label, icon: Icon, to }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(to)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-brand-100 bg-white px-2 py-3 text-xs font-medium text-brand-900 transition hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50"
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}