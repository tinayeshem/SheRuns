import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import {
  ArrowLeft, ArrowUpDown, Check, LocateFixed, MapPin, Repeat, Route as RouteIcon, Search, X,
} from "lucide-react";
import MapView from "../map/MapView";
import { useConditions } from "../features/conditions/useConditions";
import { useProfileStore } from "../store/profileStore";
import { fetchLoops, geocode, type LoopParams } from "../features/routing/api";
import { useRouteLayer } from "../features/routing/useRouteLayer";
import type { Color, LoopResponse, Mode, Place } from "../features/routing/types";

const RYNEK: Place = { label: "Main Square, Kraków", lat: 50.0614, lng: 19.9366 };

type Field = "start" | "end";
type Kind = "loop" | "trip";

const MODES: { key: Mode; label: string }[] = [
  { key: "fastest", label: "Fastest" },
  { key: "safest", label: "Safest" },
  { key: "scenic", label: "Scenic and safe" },
];

const FACTOR_LABELS: Record<string, string> = {
  lighting: "lighting",
  isolation: "isolation",
  foot_traffic: "foot traffic",
  traffic: "traffic",
  surface: "surface",
  reports: "reports",
};

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

const hh = (h: number) => String(h % 24).padStart(2, "0") + ":00";
const toHour = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h + m / 60;
};

function AddressField({
  id, label, dot, value, placeholder, chosen, searching, pinning, message, items,
  extra, onChange, onSearch, onPin, onClear, onPick,
}: {
  id: string;
  label: string;
  dot: string;
  value: string;
  placeholder: string;
  chosen: boolean;
  searching: boolean;
  pinning: boolean;
  message?: string;
  items: Place[] | null;
  extra?: ReactNode;
  onChange: (v: string) => void;
  onSearch: () => void;
  onPin: () => void;
  onClear: () => void;
  onPick: (p: Place) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-2 text-sm font-semibold text-brand-950">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
        {label}
        {chosen && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Check size={13} aria-hidden="true" /> Selected
          </span>
        )}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearch();
              }
            }}
            className="field pr-9"
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              aria-label={`Clear ${label.toLowerCase()}`}
              className="absolute inset-y-0 right-0 px-2.5 text-gray-400 hover:text-brand-700"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onSearch}
          disabled={searching}
          aria-label={`Search the ${label.toLowerCase()} address`}
          className="btn-primary px-3.5 py-2.5"
        >
          <Search size={18} />
        </button>
        <button
          type="button"
          onClick={onPin}
          aria-pressed={pinning}
          aria-label={`Pin the ${label.toLowerCase()} on the map`}
          className={`rounded-[14px] border px-3 transition ${
            pinning
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-brand-200 bg-white text-brand-700 hover:bg-brand-50"
          }`}
        >
          <MapPin size={18} />
        </button>
      </div>

      {extra}
      {searching && <p className="mt-1 text-xs text-gray-500">Searching...</p>}
      {message && <p className="mt-1 text-xs text-red-600">{message}</p>}

      {items && (
        <ul className="mt-2 overflow-hidden rounded-xl border border-brand-100 bg-white">
          {items.map((p, i) => (
            <li key={i} className={i > 0 ? "border-t border-brand-50" : ""}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
                <span>{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function RoutePlanner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data, error: condError } = useConditions();
  const traits = useProfileStore((s) => s.traits);
  const savedMode = useProfileStore((s) => s.routeMode);

  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [kind, setKind] = useState<Kind>("loop");
  const [start, setStart] = useState<Place | null>(RYNEK);
  const [end, setEnd] = useState<Place | null>(null);
  const [text, setText] = useState<Record<Field, string>>({ start: RYNEK.label, end: "" });
  const [suggest, setSuggest] = useState<{ field: Field; items: Place[] } | null>(null);
  const [searching, setSearching] = useState<Field | null>(null);
  const [fieldMsg, setFieldMsg] = useState<Partial<Record<Field, string>>>({});
  const [pinning, setPinning] = useState<Field | null>(null);

  const [km, setKm] = useState(5);
  const [mode, setMode] = useState<Mode>(savedMode);
  const [hour, setHour] = useState(new Date().getHours());

  const [result, setResult] = useState<LoopResponse | null>(null);
  const [used, setUsed] = useState<LoopParams | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const autoRan = useRef(false);

  const sunset = data ? toHour(data.sunset) : 18;
  const route = result?.routes.find((r) => r.id === selected) ?? null;

  const markerStart = result ? result.start : start;
  const markerEnd = result?.end ?? (kind === "trip" ? end : null);
  useRouteLayer(map, route, markerStart, markerEnd);

  const clearResults = () => {
    controller.current?.abort();
    setLoading(false);
    setResult(null);
    setUsed(null);
    setSelected(null);
    setError(null);
  };

  const choose = (field: Field, place: Place, fly: boolean) => {
    if (field === "start") setStart(place);
    else setEnd(place);
    setText((t) => ({ ...t, [field]: place.label }));
    setSuggest(null);
    setFieldMsg((m) => ({ ...m, [field]: undefined }));
    clearResults();
    if (fly) map?.flyTo({ center: [place.lng, place.lat], zoom: 15 });
  };

  const edit = (field: Field, value: string) => {
    setText((t) => ({ ...t, [field]: value }));
    if (field === "start") setStart(null);
    else setEnd(null);
    setSuggest(null);
    setFieldMsg((m) => ({ ...m, [field]: undefined }));
    clearResults();
  };

  const search = async (field: Field) => {
    const q = text[field].trim();
    if (q.length < 3) {
      setFieldMsg((m) => ({ ...m, [field]: "Type at least 3 characters." }));
      return;
    }
    setSearching(field);
    setSuggest(null);
    setFieldMsg((m) => ({ ...m, [field]: undefined }));
    try {
      const items = await geocode(q);
      if (items.length === 0) {
        setFieldMsg((m) => ({
          ...m,
          [field]: "No match in Kraków. Add the street number, or use the pin button.",
        }));
      } else if (items.length === 1) {
        choose(field, items[0], true);
      } else {
        setSuggest({ field, items });
      }
    } catch (e) {
      setFieldMsg((m) => ({ ...m, [field]: (e as Error).message }));
    } finally {
      setSearching(null);
    }
  };

  const fromGps = () => {
    if (!navigator.geolocation) {
      setFieldMsg((m) => ({ ...m, start: "Location is not available in this browser." }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        choose(
          "start",
          { label: "My location", lat: p.coords.latitude, lng: p.coords.longitude },
          true
        ),
      () =>
        setFieldMsg((m) => ({
          ...m,
          start: "Could not get your location. Allow it in the browser.",
        })),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const swap = () => {
    const s = start;
    const e = end;
    setStart(e);
    setEnd(s);
    setText((t) => ({ start: t.end, end: t.start }));
    setSuggest(null);
    clearResults();
  };

  // tap the map to set the start or the end
  useEffect(() => {
    if (!map || !pinning) return;
    const field = pinning;
    const onClick = (e: MapMouseEvent) => {
      choose(field, { label: "Pin on the map", lat: e.lngLat.lat, lng: e.lngLat.lng }, false);
      setPinning(null);
    };
    map.getCanvas().style.cursor = "crosshair";
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, pinning]);

  const find = async () => {
    if (!start) {
      setError("Choose a start: search an address, use your location, or pin it on the map.");
      return;
    }
    if (kind === "trip" && !end) {
      setError("Choose an end address, or switch to Loop.");
      return;
    }

    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);

    const p: LoopParams = {
      lat: start.lat,
      lng: start.lng,
      km,
      mode,
      hour,
      sunset,
      traits,
      end: kind === "trip" && end ? { lat: end.lat, lng: end.lng } : undefined,
    };

    try {
      const r = await fetchLoops(p, c.signal);
      if (c.signal.aborted) return;
      setResult(r);
      setSelected(r.routes[0]?.id ?? null);
      setUsed({
        ...p,
        lat: r.start.lat,
        lng: r.start.lng,
        end: r.end ? { lat: r.end.lat, lng: r.end.lng } : undefined,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (controller.current === c) setLoading(false);
    }
  };

  useEffect(() => {
    if (autoRan.current || !params.get("run")) return;
    if (!data && !condError) return;
    autoRan.current = true;
    find();
  }, [data, condError]);

  const snapNote =
    result && result.start.snappedMeters > 150
      ? `The start is ${result.start.snappedMeters} m from the nearest mapped street, so the route begins there.`
      : result?.end && result.end.snappedMeters > 150
      ? `The end is ${result.end.snappedMeters} m from the nearest mapped street, so the route ends there.`
      : null;

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} center={[RYNEK.lng, RYNEK.lat]} zoom={14} />
      </div>

      {pinning && (
        <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-brand-700 px-4 py-2 text-sm text-white shadow-lg">
          <MapPin size={16} aria-hidden="true" />
          Tap the map to set the {pinning === "start" ? "start" : "end"}
          <button type="button" onClick={() => setPinning(null)} className="underline">
            Cancel
          </button>
        </div>
      )}

      <div className={`sheet ${pinning ? "max-md:hidden" : ""}`}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-200 md:hidden" />

        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/home")}
            aria-label="Back to the map"
            className="rounded-xl p-2 text-brand-800 hover:bg-brand-50"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-extrabold text-brand-950">Plan a route</h1>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-2xl bg-brand-50 p-1 text-sm font-semibold">
          {(
            [
              { key: "loop", label: "Loop", icon: Repeat },
              { key: "trip", label: "A to B", icon: RouteIcon },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={kind === key}
              onClick={() => {
                setKind(key);
                setSuggest(null);
                clearResults();
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2 transition ${
                kind === key ? "bg-white text-brand-800 shadow" : "text-brand-700"
              }`}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <AddressField
            id="start-address"
            label="Start"
            dot="bg-brand-500"
            value={text.start}
            placeholder="Street and number, or a place"
            chosen={!!start}
            searching={searching === "start"}
            pinning={pinning === "start"}
            message={fieldMsg.start}
            items={suggest?.field === "start" ? suggest.items : null}
            onChange={(v) => edit("start", v)}
            onSearch={() => search("start")}
            onPin={() => setPinning(pinning === "start" ? null : "start")}
            onClear={() => edit("start", "")}
            onPick={(p) => choose("start", p, true)}
            extra={
              <button
                type="button"
                onClick={fromGps}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 underline"
              >
                <LocateFixed size={14} aria-hidden="true" /> Use my location
              </button>
            }
          />

          {kind === "trip" && (
            <>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap start and end"
                  className="rounded-full border border-brand-200 bg-white p-1.5 text-brand-700 hover:bg-brand-50"
                >
                  <ArrowUpDown size={16} />
                </button>
              </div>
              <AddressField
                id="end-address"
                label="End"
                dot="bg-brand-950"
                value={text.end}
                placeholder="Street and number, or a place"
                chosen={!!end}
                searching={searching === "end"}
                pinning={pinning === "end"}
                message={fieldMsg.end}
                items={suggest?.field === "end" ? suggest.items : null}
                onChange={(v) => edit("end", v)}
                onSearch={() => search("end")}
                onPin={() => setPinning(pinning === "end" ? null : "end")}
                onClear={() => edit("end", "")}
                onPick={(p) => choose("end", p, true)}
              />
            </>
          )}
        </div>

        {kind === "loop" && (
          <div className="mt-4 rounded-2xl bg-brand-50/70 p-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-brand-900">Distance</span>
              <span className="font-bold text-brand-900">{km} km</span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              step={1}
              value={km}
              aria-label="Distance in kilometres"
              onChange={(e) => {
                setKm(Number(e.target.value));
                clearResults();
              }}
              className="w-full"
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => {
                setMode(m.key);
                clearResults();
              }}
              className={`rounded-xl border px-1 py-2 text-xs font-semibold transition ${
                mode === m.key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-brand-800 hover:bg-brand-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <label htmlFor="run-hour" className="text-brand-900">Go at</label>
          <select
            id="run-hour"
            value={hour}
            onChange={(e) => {
              setHour(Number(e.target.value));
              clearResults();
            }}
            className="field w-auto py-1.5"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>{hh(h)}</option>
            ))}
          </select>
          {data && <span className="text-gray-500">Sunset {data.sunset}</span>}
        </div>

        <button
          type="button"
          onClick={find}
          disabled={loading}
          className="btn-primary mt-4 w-full py-3.5 text-base"
        >
          {loading ? "Finding routes..." : "Find routes"}
        </button>
        {loading && (
          <p className="mt-2 text-center text-xs text-gray-500">This can take up to 10 seconds.</p>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {snapNote && <p className="mt-3 text-xs text-amber-700">{snapNote}</p>}

        {result && (
          <div className="mt-5">
            {result.routes.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r.id)}
                className={`mb-2 w-full rounded-2xl border p-3 text-left transition ${
                  selected === r.id
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                    : "border-brand-100 bg-white hover:bg-brand-50/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-brand-950">
                    Route {String.fromCharCode(65 + i)} · {r.distanceKm} km
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.color]}`}>
                    {r.score} {r.color}
                  </span>
                </div>
                {r.tag && (
                  <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                    {r.tag}
                  </span>
                )}
                <div className="mt-1 text-sm text-gray-600">
                  {r.safeWindow
                    ? `Safe ${hh(r.safeWindow.from)} to ${hh(r.safeWindow.to)}`
                    : "Not fully green at this hour"}
                  {r.confidence === "low" && " · low confidence"}
                </div>
                {r.weakest && (
                  <div className="text-sm text-gray-600">
                    Weakest: {r.weakest.name} ({r.weakest.score}),{" "}
                    {FACTOR_LABELS[r.weakest.factor] ?? r.weakest.factor}
                  </div>
                )}
              </button>
            ))}

            {route && used && (
              <div className="mt-3">
                <p className="mb-1 text-sm font-semibold text-brand-950">Streets on this route</p>
                <ul className="mb-3 space-y-1 text-sm">
                  {route.stretches
                    .filter((s) => s.meters >= 80)
                    .slice(0, 10)
                    .map((s, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span style={{ color: DOT[s.color] }}>●</span>
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-gray-500">{s.meters} m</span>
                        <span className="w-8 text-right">{s.score}</span>
                      </li>
                    ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/route", { state: { route, params: used } })}
                    className="btn-primary flex-1"
                  >
                    Route details
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/live-run", { state: { route } })}
                    className="btn-ghost flex-1"
                  >
                    Start run
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}