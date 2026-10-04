import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowLeft, CalendarDays, Gauge, MapPin, Navigation, ShieldCheck, Trash2,
} from "lucide-react";
import { useHistoryStore, type RunRecord } from "../features/history/store";
import { clock } from "../features/live/format";
import { Reveal, useTween } from "../components/motion";
import ContourArt from "../components/ContourArt";

const colorOf = (n: number) =>
  n >= 70 ? "#2e9e4f" : n >= 40 ? "#e6a817" : "#d64545";
const badgeOf = (n: number) =>
  n >= 70
    ? "bg-green-100 text-green-800"
    : n >= 40
    ? "bg-amber-100 text-amber-800"
    : "bg-red-100 text-red-800";
const wordOf = (n: number) => (n >= 70 ? "green" : n >= 40 ? "yellow" : "red");

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

function Chart({ runs }: { runs: RunRecord[] }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const slot = Math.min(36, 300 / runs.length);
  const x0 = (300 - slot * runs.length) / 2;
  const y = (v: number) => 100 - v * 0.9;

  return (
    <svg
      viewBox="0 0 300 124"
      className="w-full"
      role="img"
      aria-label={`Safety scores of your last ${runs.length} runs, oldest on the left`}
    >
      <line x1="0" x2="300" y1={y(70)} y2={y(70)} stroke="#ddd6fe" strokeDasharray="3 3" />
      <line x1="0" x2="300" y1={y(40)} y2={y(40)} stroke="#ddd6fe" strokeDasharray="3 3" />
      <text x="298" y={y(70) - 2} textAnchor="end" fontSize="8" fill="#7c3aed">70</text>
      <text x="298" y={y(40) - 2} textAnchor="end" fontSize="8" fill="#7c3aed">40</text>
      {runs.map((r, i) => {
        const d = new Date(r.startedAt);
        const h = Math.max(2, r.score * 0.9);
        return (
          <g key={r.id}>
            <rect
              x={x0 + i * slot + slot * 0.12}
              y={100 - h}
              width={slot * 0.76}
              height={h}
              rx={3}
              fill={colorOf(r.score)}
              style={{
                transformBox: "fill-box",
                transformOrigin: "bottom",
                transform: grown ? "scaleY(1)" : "scaleY(0)",
                transition: `transform .7s cubic-bezier(.2,.8,.2,1) ${i * 60}ms`,
              }}
            >
              <title>{`${d.toLocaleDateString("en-GB")}: score ${r.score}`}</title>
            </rect>
            <text
              x={x0 + i * slot + slot / 2}
              y={114}
              textAnchor="middle"
              fontSize="7.5"
              fill="#6b7280"
            >
              {d.getDate()}/{d.getMonth() + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Activity;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-3 text-center shadow-sm">
      <span className="mx-auto mb-1.5 grid h-8 w-8 place-items-center rounded-xl bg-brand-100 text-brand-700">
        <Icon size={17} aria-hidden="true" />
      </span>
      <p className="text-xl font-extrabold text-brand-950">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const runs = useHistoryStore((s) => s.runs);
  const removeRun = useHistoryStore((s) => s.removeRun);
  const clear = useHistoryStore((s) => s.clear);

  const stats = useMemo(() => {
    const sow = startOfWeek();
    const week = runs.filter((r) => r.startedAt >= sow);
    const sum = (list: RunRecord[]) => list.reduce((t, r) => t + r.distanceKm, 0);
    return {
      weekRuns: week.length,
      weekKm: sum(week),
      weekAvg: week.length
        ? Math.round(week.reduce((t, r) => t + r.score, 0) / week.length)
        : null,
      totalRuns: runs.length,
      totalKm: sum(runs),
    };
  }, [runs]);

  const weekRunsAnim = useTween(stats.weekRuns);
  const weekKmAnim = useTween(stats.weekKm);
  const weekAvgAnim = useTween(stats.weekAvg ?? 0);

  const recent = useMemo(() => runs.slice(0, 12).reverse(), [runs]);

  const askClear = () => {
    if (window.confirm("Delete your whole run history from this device?")) clear();
  };

  return (
    <div className="page-bg min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-6">
        <div className="mb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/home")}
            aria-label="Back to the map"
            className="rounded-xl p-2 text-brand-800 hover:bg-white"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-extrabold text-brand-950">Run history</h1>
        </div>

        {runs.length === 0 ? (
          <div className="animate-fade-up relative overflow-hidden rounded-3xl p-8 text-center grad-aside text-white">
            <ContourArt className="pointer-events-none absolute -right-24 -top-24 w-[24rem] max-w-none opacity-40" rings={12} seed={2} />
            <div className="relative">
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
                <Activity size={28} aria-hidden="true" />
              </span>
              <h2 className="text-xl font-extrabold">No runs yet</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-white/75">
                Plan a route and start a run. Finished runs of at least 100 m
                (or 2 minutes) appear here, with their safety score.
              </p>
              <button
                type="button"
                onClick={() => navigate("/plan")}
                className="btn-white mt-6"
              >
                <Navigation size={18} aria-hidden="true" /> Plan a route
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="animate-fade-up grid grid-cols-3 gap-3">
              <Stat icon={CalendarDays} value={String(Math.round(weekRunsAnim))} label="runs this week" />
              <Stat icon={MapPin} value={weekKmAnim.toFixed(1)} label="km this week" />
              <Stat
                icon={ShieldCheck}
                value={stats.weekAvg === null ? "-" : String(Math.round(weekAvgAnim))}
                label="avg safety"
              />
            </div>
            <p className="mb-5 mt-2 text-xs text-gray-500">
              All time: {stats.totalRuns} run{stats.totalRuns === 1 ? "" : "s"},{" "}
              {stats.totalKm.toFixed(1)} km
            </p>

            <Reveal>
              <div className="mb-5 rounded-3xl border border-brand-100 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Gauge size={18} className="text-brand-600" aria-hidden="true" />
                  <p className="font-bold text-brand-950">
                    Route safety, last {recent.length} run{recent.length === 1 ? "" : "s"}
                  </p>
                </div>
                {recent.length >= 2 ? (
                  <Chart runs={recent} />
                ) : (
                  <p className="py-4 text-sm text-gray-500">
                    Finish a second run to see a trend.
                  </p>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">
                  <span><span style={{ color: "#2e9e4f" }}>●</span> 70 and above</span>
                  <span><span style={{ color: "#e6a817" }}>●</span> 40 to 69</span>
                  <span><span style={{ color: "#d64545" }}>●</span> below 40</span>
                </div>
              </div>
            </Reveal>

            <ul className="space-y-3">
              {runs.map((r, i) => {
                const d = new Date(r.startedAt);
                return (
                  <li
                    key={r.id}
                    className="animate-fade-up rounded-2xl border border-brand-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300"
                    style={{ ["--d" as string]: `${Math.min(i, 8) * 60}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-brand-950">
                          {d.toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                          ,{" "}
                          {d.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-700">
                          {r.distanceKm.toFixed(2)} km · {clock(r.durationSec)} ·{" "}
                          {r.distanceKm >= 0.1
                            ? `${clock(r.durationSec / r.distanceKm)} /km`
                            : "no pace"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeOf(r.score)}`}
                      >
                        {r.score} {wordOf(r.score)}
                      </span>
                    </div>
                    {r.weakest && (
                      <p className="mt-1.5 text-xs text-gray-500">
                        Weakest stretch: {r.weakest}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRun(r.id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600"
                    >
                      <Trash2 size={14} aria-hidden="true" /> Remove
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={askClear}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={16} aria-hidden="true" /> Clear history
            </button>
            <p className="mt-3 text-xs text-gray-500">
              History is stored only in this browser. The safety score is the
              score of the route you planned, at the time you planned it.
            </p>
          </>
        )}
      </div>
    </div>
  );
}