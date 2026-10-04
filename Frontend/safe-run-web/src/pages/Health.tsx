import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHealth, type IceRisk } from "../features/conditions/useHealth";
import { useProfileStore } from "../store/profileStore";
import {
  fetchLoops,
  fetchAscent,
  type LoopParams,
} from "../features/routing/api";
import type { RouteResult } from "../features/routing/types";

const RYNEK = { lng: 19.9366, lat: 50.0614 };

type Feeling = "fresh" | "ok" | "tired";
const FEELINGS: { key: Feeling; label: string }[] = [
  { key: "fresh", label: "Fresh" },
  { key: "ok", label: "OK" },
  { key: "tired", label: "Tired" },
];
const KM: Record<Feeling, number> = { fresh: 6, ok: 4, tired: 3 };
const CLIMB_WEIGHT: Record<Feeling, number> = { fresh: 0, ok: 1, tired: 2 };

const ICE_LABEL: Record<IceRisk, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

const toHour = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
};

const aqiColor = (n: number) => (n <= 40 ? "#2e9e4f" : n <= 60 ? "#e6a817" : "#d64545");
const iceColor = (r: IceRisk) =>
  r === "low" ? "#2e9e4f" : r === "moderate" ? "#e6a817" : "#d64545";

type Suggestion = {
  route: RouteResult;
  climb: number | null;
  params: LoopParams;
  shortened: boolean;
  feeling: Feeling;
};

export default function Health() {
  const navigate = useNavigate();
  const { data, error: dataError } = useHealth();
  const traits = useProfileStore((s) => s.traits);

  const [start, setStart] = useState(RYNEK);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const sunset = data ? toHour(data.sunset) : 18;

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setStart({ lng: p.coords.longitude, lat: p.coords.latitude });
        setSuggestion(null);
        setFeeling(null);
        setError(null);
      },
      () => setError("Could not get your location. Allow it in the browser."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const suggest = async (f: Feeling) => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;

    setFeeling(f);
    setLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      let km = KM[f];
      let shortened = false;
      if (data && data.aqi > 60) {
        km = Math.max(2, km - 1);
        shortened = true;
      }

      const params: LoopParams = {
        lat: start.lat,
        lng: start.lng,
        km,
        mode: "safest",
        hour: new Date().getHours(),
        sunset,
        traits: f === "tired" ? [...traits, "wellLit"] : traits,
      };

      const res = await fetchLoops(params, c.signal);
      const withClimb = await Promise.all(
        res.routes.map(async (r) => ({
          r,
          climb: await fetchAscent(r.geometry.coordinates, c.signal).catch(() => null),
        }))
      );
      if (c.signal.aborted) return;

      const rank = (x: { r: RouteResult; climb: number | null }) =>
        x.r.score - (CLIMB_WEIGHT[f] * (x.climb ?? 0)) / Math.max(0.5, x.r.distanceKm);
      const best = [...withClimb].sort((a, b) => rank(b) - rank(a))[0];
      if (!best) throw new Error("No loop found, try another start point");

      setSuggestion({
        route: best.r,
        climb: best.climb,
        params: { ...params, lat: res.start.lat, lng: res.start.lng },
        shortened,
        feeling: f,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (controller.current === c) setLoading(false);
    }
  };

  const describe = (s: Suggestion) => {
    const parts: string[] = [];
    if (s.feeling === "tired") parts.push("short");
    if (s.feeling === "tired" || s.feeling === "ok") parts.push("gentle");
    if (s.feeling === "tired") parts.push("well-lit");
    return parts.length ? parts.join(", ") + " loop" : "loop";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">Health and conditions</h1>
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="border rounded-lg px-3 py-1 text-sm bg-white"
          >
            Back
          </button>
        </div>

        {dataError && (
          <p className="text-sm text-red-600 mb-3">
            Could not load conditions. Check your connection.
          </p>
        )}
        {!data && !dataError && (
          <p className="text-sm text-gray-500 mb-3">Loading conditions...</p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white rounded-xl shadow p-3">
                <p className="text-xs text-gray-500">Air quality</p>
                <p className="text-lg font-bold" style={{ color: aqiColor(data.aqi) }}>
                  {data.aqiLabel} ({data.aqi})
                </p>
                {data.pm25 !== null && (
                  <p className="text-xs text-gray-500">
                    PM2.5 {Math.round(data.pm25)} µg/m³
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl shadow p-3">
                <p className="text-xs text-gray-500">Temperature</p>
                <p className="text-lg font-bold">{data.temp}°C</p>
                <p className="text-xs text-gray-500">Sunset {data.sunset}</p>
              </div>
              <div className="bg-white rounded-xl shadow p-3 col-span-2">
                <p className="text-xs text-gray-500">Ice risk (estimate)</p>
                <p className="text-lg font-bold" style={{ color: iceColor(data.ice) }}>
                  {ICE_LABEL[data.ice]}
                </p>
              </div>
            </div>

            {data.warnings.length > 0 ? (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-3 text-sm">
                <p className="font-medium mb-1">Warnings (next 12 hours)</p>
                <ul className="list-disc pl-5 space-y-1">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-gray-600 mb-3">
                No warnings for the next 12 hours.
              </p>
            )}

            {data.cleanest && (
              <p className="text-sm text-gray-700 mb-3">
                Cleanest air in the next 12 hours: {data.cleanest.time} (index{" "}
                {data.cleanest.aqi}).
              </p>
            )}
          </>
        )}

        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="font-bold mb-2">How do you feel today?</p>
          <div className="flex gap-2 mb-3">
            {FEELINGS.map((f) => (
              <button
                key={f.key}
                type="button"
                disabled={loading}
                onClick={() => suggest(f.key)}
                className={`flex-1 border rounded-lg py-2 text-sm disabled:opacity-60 ${
                  feeling === f.key ? "bg-green-600 text-white border-green-600" : ""
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
            <span>
              Start:{" "}
              {start.lat === RYNEK.lat && start.lng === RYNEK.lng
                ? "Main Square"
                : "your location"}
            </span>
            <button
              type="button"
              onClick={useMyLocation}
              className="border rounded-lg px-2 py-1"
            >
              My location
            </button>
          </div>

          {loading && (
            <p className="text-sm text-gray-500">
              Finding a loop for you. This can take up to 10 seconds.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {suggestion && (
            <div className="border rounded-xl p-3">
              <p className="font-medium mb-1">
                Suggested: a {describe(suggestion)}
              </p>
              <p className="text-sm text-gray-700">
                {suggestion.route.distanceKm} km, safety score{" "}
                {suggestion.route.score} ({suggestion.route.color})
              </p>
              <p className="text-sm text-gray-700 mb-2">
                {typeof suggestion.climb === "number"
                  ? `Climb about ${suggestion.climb} m`
                  : "Climb: not available"}
                {suggestion.route.confidence === "low" && " · low confidence"}
              </p>
              {suggestion.shortened && (
                <p className="text-sm text-amber-700 mb-2">
                  Shortened by 1 km because the air quality is poor.
                </p>
              )}
              <button
                type="button"
                onClick={() =>
                  navigate("/route", {
                    state: { route: suggestion.route, params: suggestion.params },
                  })
                }
                className="w-full bg-green-600 text-white rounded-xl py-3 font-medium"
              >
                Show this route
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-500">
          General guidance, not medical advice. If you feel unwell, rest. Air
          data is a model estimate from Open-Meteo, and ice risk is estimated
          from temperature, rain and humidity.
        </p>
      </div>
    </div>
  );
}