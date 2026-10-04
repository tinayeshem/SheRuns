import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type W = Record<string, number>;
type Profiles = Record<string, { day: W; night: W }>;

const FACTORS = [
  {
    key: "lighting",
    name: "Lighting",
    text: "Is the street lit? Lit streets score high at night, dark ones low.",
    source: "OpenStreetMap lit tag",
  },
  {
    key: "isolation",
    name: "Isolation",
    text: "How many streets and buildings are around? Empty areas and park paths score lower, especially at night.",
    source: "OpenStreetMap street density",
  },
  {
    key: "foot_traffic",
    name: "Foot traffic",
    text: "How busy the area usually is at this hour.",
    source: "Street density and hourly pattern",
  },
  {
    key: "traffic",
    name: "Traffic",
    text: "Footpaths score highest. Fast roads without a sidewalk score lowest.",
    source: "OpenStreetMap road type, speed, sidewalk",
  },
  {
    key: "surface",
    name: "Surface",
    text: "Smooth asphalt scores high. Gravel, dirt and mud score lower.",
    source: "OpenStreetMap surface tag",
  },
  {
    key: "reports",
    name: "Reports",
    text: "Problems reported by runners nearby, such as ice or harassment. They fade with age.",
    source: "Runner reports",
  },
];

const PROFILES = [
  { key: "default", label: "No profile" },
  { key: "alone", label: "I run alone" },
  { key: "night", label: "I run at night" },
  { key: "dog", label: "I run with a dog" },
  { key: "beginner", label: "I'm a beginner" },
  { key: "lowVision", label: "I have low vision" },
];

// Illustrative path: unlit footpath, asphalt, few streets around it.
// The sunset is fixed at 18:00 for this demo.
function demoScores(hour: number): Record<string, number> {
  const night = hour >= 18 || hour < 6.5;
  const h = Math.floor(hour);
  const hf =
    h >= 7 && h <= 9 ? 1 :
    h >= 10 && h <= 16 ? 0.8 :
    h >= 17 && h <= 19 ? 1 :
    h === 6 || h === 20 || h === 21 ? 0.6 : 0.2;
  return {
    lighting: night ? 5 : 40,
    isolation: night ? 18 : 35,
    foot_traffic: Math.round(Math.max(10, 18 * hf)),
    traffic: 100,
    surface: 90,
    reports: 100,
  };
}

const colorOf = (n: number) => (n >= 70 ? "#2e9e4f" : n >= 40 ? "#e6a817" : "#d64545");
const wordOf = (n: number) => (n >= 70 ? "Good to run" : n >= 40 ? "Be careful" : "Avoid");

export default function HowItWorks() {
  const navigate = useNavigate();
  const [hour, setHour] = useState(14);
  const [profile, setProfile] = useState("default");
  const [profiles, setProfiles] = useState<Profiles | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    fetch(`${API}/scoring/weights`, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(setProfiles)
      .catch((e) => {
        if (e?.name !== "AbortError") setFailed(true);
      });
    return () => c.abort();
  }, []);

  const night = hour >= 18 || hour < 6.5;
  const sub = useMemo(() => demoScores(hour), [hour]);
  const weights = profiles?.[profile]?.[night ? "night" : "day"];

  const score = weights
    ? Math.round(
        FACTORS.reduce((t, f) => t + sub[f.key] * (weights[f.key] ?? 0), 0)
      )
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="border rounded-lg px-3 py-1 text-sm bg-white mb-4"
        >
          Back
        </button>

        <h1 className="text-2xl font-bold mb-2">How the safety score works</h1>
        <p className="text-gray-600 mb-6">
          Every street piece gets a score from 0 to 100. The score changes with
          the time of day and with your running profile.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-8 text-center text-sm">
          {[
            { c: "#2e9e4f", t: "70 to 100", w: "Good to run" },
            { c: "#e6a817", t: "40 to 69", w: "Be careful" },
            { c: "#d64545", t: "0 to 39", w: "Avoid" },
          ].map((x) => (
            <div key={x.t} className="bg-white rounded-xl shadow p-3">
              <div className="h-2 rounded-full mb-2" style={{ background: x.c }} />
              <p className="font-medium">{x.t}</p>
              <p className="text-gray-600">{x.w}</p>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-bold mb-3">Six checks for every street</h2>
        <div className="grid gap-2 mb-8">
          {FACTORS.map((f) => (
            <div key={f.key} className="bg-white rounded-xl shadow p-3">
              <p className="font-medium">{f.name}</p>
              <p className="text-sm text-gray-600">{f.text}</p>
              <p className="text-xs text-gray-500 mt-1">Source: {f.source}</p>
            </div>
          ))}
        </div>

        <h2 className="text-lg font-bold mb-1">Try it</h2>
        <p className="text-sm text-gray-600 mb-3">
          An unlit footpath with few buildings around it. Move the time and
          change the profile.
        </p>

        <div className="bg-white rounded-2xl shadow p-4 mb-8">
          <div className="flex justify-between text-sm mb-1">
            <span>Time of day</span>
            <span className="font-medium">{String(hour).padStart(2, "0")}:00</span>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-full mb-3"
          />

          <label htmlFor="profile" className="text-sm block mb-1">
            Profile
          </label>
          <select
            id="profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className="border rounded-lg px-2 py-1 mb-4 w-full"
          >
            {PROFILES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>

          {failed && (
            <p className="text-sm text-red-600">
              Could not load the weights. Is the API running?
            </p>
          )}
          {!weights && !failed && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}

          {weights && score !== null && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  {night ? "Night weights apply" : "Day weights apply"}
                </span>
                <span
                  className="text-white text-sm font-medium rounded-full px-3 py-1"
                  style={{ background: colorOf(score) }}
                >
                  {score}: {wordOf(score)}
                </span>
              </div>

              {FACTORS.map((f) => (
                <div key={f.key} className="flex items-center gap-2 mb-1 text-sm">
                  <span className="w-24 shrink-0">{f.name}</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded">
                    <div
                      className="h-2 rounded"
                      style={{ width: `${sub[f.key]}%`, background: colorOf(sub[f.key]) }}
                    />
                  </div>
                  <span className="w-8 text-right">{sub[f.key]}</span>
                  <span className="w-16 text-right text-gray-500">
                    weight {Math.round((weights[f.key] ?? 0) * 100)}%
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <h2 className="text-lg font-bold mb-3">Rules that protect you</h2>
        <ul className="bg-white rounded-xl shadow p-4 mb-8 text-sm space-y-2 text-gray-700 list-disc pl-8">
          <li>
            A route is not just an average. If 100 m or more of it scores red,
            the whole route is capped at yellow, and we show you the weakest
            stretch.
          </li>
          <li>
            A confirmed harassment report turns a street red at any hour. Ice
            and flooding reports lower it by one level.
          </li>
          <li>
            Reports fade with time. They expire after 7 days unless someone
            confirms they are still there, and moderators review them.
          </li>
        </ul>

        <h2 className="text-lg font-bold mb-3">Data and limits</h2>
        <div className="bg-white rounded-xl shadow p-4 mb-8 text-sm text-gray-700 space-y-2">
          <p>
            Sources: OpenStreetMap contributors (streets, lighting, surface),
            Open-Meteo (weather, air quality, sunset) and runner reports.
          </p>
          <p>
            When a street has no lighting tag, we estimate and show it faded
            with a low confidence label.
          </p>
          <p>
            Foot traffic and isolation are estimated from how many streets are
            nearby, not from real pedestrian counts.
          </p>
          <p className="font-medium">
            Scores are a guide, not a guarantee. Use your own judgment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/profile-setup")}
          className="w-full bg-green-600 text-white rounded-xl py-3 font-medium"
        >
          Set up your safety profile
        </button>
      </div>
    </div>
  );
}