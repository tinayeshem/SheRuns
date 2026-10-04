import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { ArrowLeft, Play, RotateCcw, ShieldCheck } from "lucide-react";
import MapView from "../map/MapView";
import {
  fetchLoops,
  fetchStops,
  fetchAscent,
  type LoopParams,
} from "../features/routing/api";
import { useRouteLayer } from "../features/routing/useRouteLayer";
import { useStopsLayer, KIND_LABEL } from "../features/routing/useStopsLayer";
import type { Color, RouteResult, Stop } from "../features/routing/types";

const BADGE: Record<Color, string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};
const DOT: Record<Color, string> = {
  green: "#2e9e4f",
  yellow: "#e6a817",
  red: "#d64545",
};
const FACTOR_LABELS: Record<string, string> = {
  lighting: "lighting",
  isolation: "isolation",
  foot_traffic: "foot traffic",
  traffic: "traffic",
  surface: "surface",
  reports: "reports",
};

const hh = (h: number) => String(h % 24).padStart(2, "0") + ":00";

export default function RouteDetails() {
  const location = useLocation();
  const st = location.state as { route: RouteResult; params: LoopParams } | null;
  if (!st?.route || !st?.params) return <Navigate to="/plan" replace />;
  return <Details initial={st.route} params={st.params} />;
}

function Details({
  initial,
  params,
}: {
  initial: RouteResult;
  params: LoopParams;
}) {
  const navigate = useNavigate();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [route, setRoute] = useState<RouteResult>(initial);
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopsState, setStopsState] = useState<"loading" | "done" | "error">("loading");
  const [climb, setClimb] = useState<number | null | undefined>(undefined);
  const [avoided, setAvoided] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useRouteLayer(map, route, { lng: params.lng, lat: params.lat }, params.end ?? null);
  useStopsLayer(map, stops);

  useEffect(() => {
    const c = new AbortController();
    setStopsState("loading");
    setClimb(undefined);

    fetchStops(route.geometry.coordinates, c.signal)
      .then((s) => {
        setStops(s);
        setStopsState("done");
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setStops([]);
        setStopsState("error");
      });

    fetchAscent(route.geometry.coordinates, c.signal)
      .then(setClimb)
      .catch((e) => {
        if (e?.name !== "AbortError") setClimb(null);
      });

    return () => c.abort();
  }, [route]);

  const mix = useMemo(() => {
    const t: Record<Color, number> = { green: 0, yellow: 0, red: 0 };
    for (const s of route.stretches) t[s.color] += s.meters;
    const total = t.green + t.yellow + t.red || 1;
    return { ...t, total };
  }, [route]);
  const pct = (c: Color) => Math.round((mix[c] / mix.total) * 100);

  const weakNow = [
    ...(route.weakest ? [route.weakest.id] : []),
    ...route.weakIds,
  ];
  const canAvoid = !!route.weakest && route.weakest.score < 70 && weakNow.length > 0;

  const detour = async () => {
    setBusy(true);
    setNote(null);
    const avoid = [...new Set([...avoided, ...weakNow])];
    try {
      const r = await fetchLoops({ ...params, avoid });
      const best = [...r.routes].sort((a, b) => b.score - a.score)[0];
      if (!best) {
        setNote("No detour found around the weak stretches.");
        return;
      }
      if (best.score <= route.score) {
        setNote(`No safer detour found (best option scores ${best.score}).`);
        return;
      }
      setNote(
        `Detour found: score ${route.score} to ${best.score}, ${route.distanceKm} km to ${best.distanceKm} km.`
      );
      setAvoided(avoid);
      setRoute(best);
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const showOriginal = () => {
    setRoute(initial);
    setAvoided([]);
    setNote(null);
  };

  const listedStops = stops.slice(0, 12);

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} center={[params.lng, params.lat]} zoom={14} />
      </div>

      <div className="sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-200 md:hidden" />

        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/plan")}
            aria-label="Back to the planner"
            className="rounded-xl p-2 text-brand-800 hover:bg-brand-50"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-lg font-extrabold text-brand-950">
            {route.distanceKm} km {params.end ? "route" : "loop"}
          </h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[route.color]}`}>
            {route.score} {route.color}
          </span>
        </div>

        <p className="mb-3 text-sm text-gray-600">
          {climb === undefined && "Climb: loading..."}
          {climb === null && "Climb: not available"}
          {typeof climb === "number" && `Climb about ${climb} m`}
          {route.confidence === "low" && " · low confidence"}
          {route.tag && ` · ${route.tag}`}
        </p>

        <div className="mb-1 flex h-2 overflow-hidden rounded">
          {(["green", "yellow", "red"] as Color[]).map(
            (c) =>
              mix[c] > 0 && (
                <div
                  key={c}
                  style={{ width: `${(mix[c] / mix.total) * 100}%`, background: DOT[c] }}
                />
              )
          )}
        </div>
        <p className="mb-3 text-xs text-gray-600">
          {pct("green")}% green · {pct("yellow")}% yellow · {pct("red")}% red (by street)
        </p>

        <p className="mb-1 text-sm text-brand-950">
          {route.safeWindow
            ? `Safe window: ${hh(route.safeWindow.from)} to ${hh(route.safeWindow.to)}`
            : "Not fully green at the chosen hour"}
        </p>
        {route.weakest && (
          <p className="mb-3 text-sm text-gray-700">
            Weakest: {route.weakest.name} ({route.weakest.score}),{" "}
            {FACTOR_LABELS[route.weakest.factor] ?? route.weakest.factor}
          </p>
        )}

        {canAvoid ? (
          <button
            type="button"
            onClick={detour}
            disabled={busy}
            className="btn-primary mb-2 w-full"
          >
            <ShieldCheck size={18} aria-hidden="true" />
            {busy ? "Finding a detour..." : "Avoid weak stretches"}
          </button>
        ) : (
          <p className="mb-2 text-sm text-gray-600">No weak stretches to avoid.</p>
        )}
        {note && <p className="mb-2 text-sm text-brand-900">{note}</p>}
        {route !== initial && (
          <button
            type="button"
            onClick={showOriginal}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand-700 underline"
          >
            <RotateCcw size={14} aria-hidden="true" /> Show the original route
          </button>
        )}

        <p className="mb-1 mt-3 text-sm font-semibold text-brand-950">
          Safe stops along the route
        </p>
        {stopsState === "loading" && <p className="text-sm text-gray-500">Loading stops...</p>}
        {stopsState === "error" && <p className="text-sm text-gray-500">Could not load stops.</p>}
        {stopsState === "done" && stops.length === 0 && (
          <p className="text-sm text-gray-500">
            No pharmacy, hospital, police station or shop is mapped within 150 m.
          </p>
        )}
        <ul className="mb-3 space-y-1 text-sm">
          {listedStops.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-14 shrink-0 text-gray-500">
                {(s.along * route.distanceKm).toFixed(1)} km
              </span>
              <span className="flex-1 truncate">
                {s.name || KIND_LABEL[s.kind] || s.kind}
                {s.name && ` (${KIND_LABEL[s.kind] ?? s.kind})`}
                {s.openingHours === "24/7" && ", open 24/7"}
              </span>
              <span className="text-gray-500">{s.distanceM} m</span>
            </li>
          ))}
        </ul>
        {stops.length > listedStops.length && (
          <p className="mb-3 text-xs text-gray-500">
            +{stops.length - listedStops.length} more on the map
          </p>
        )}

        <p className="mb-1 text-sm font-semibold text-brand-950">Streets on this route</p>
        <ul className="mb-4 space-y-1 text-sm">
          {route.stretches
            .filter((s) => s.meters >= 80)
            .map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span style={{ color: DOT[s.color] }}>●</span>
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-gray-500">{s.meters} m</span>
                <span className="w-8 text-right">{s.score}</span>
              </li>
            ))}
        </ul>

        <button
          type="button"
          onClick={() => navigate("/live-run", { state: { route } })}
          className="btn-ghost w-full"
        >
          <Play size={18} aria-hidden="true" /> Start run
        </button>
      </div>
    </div>
  );
}