import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Check, Clock, ExternalLink, Phone, Radio, ShieldAlert } from "lucide-react";
import MapView from "../map/MapView";
import Logo from "../components/Logo";
import { useLiveLayer } from "../features/live/useLiveLayer";
import { ago, hhmm } from "../features/live/format";
import { ApiError, getShared, type LiveStatus, type LiveView } from "../features/live/api";

const NO_TRAIL: [number, number][] = [];

const BANNER: Record<LiveStatus, string> = {
  active: "bg-green-50 text-green-900 border-green-200",
  signal_lost: "bg-amber-50 text-amber-900 border-amber-200",
  overdue: "bg-red-50 text-red-900 border-red-300",
  sos: "bg-red-50 text-red-900 border-red-400",
  finished: "bg-brand-50 text-brand-900 border-brand-200",
  expired: "bg-brand-50 text-brand-900 border-brand-200",
};

const ICON = {
  active: Radio,
  signal_lost: Clock,
  overdue: ShieldAlert,
  sos: ShieldAlert,
  finished: Check,
  expired: Clock,
} as const;

export default function LiveShare() {
  const { token = "" } = useParams();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [view, setView] = useState<LiveView | null>(null);
  const [viewAt, setViewAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [moved, setMoved] = useState(false);
  const centered = useRef(false);

  const pos = view?.position ?? null;
  useLiveLayer(map, pos, view?.trail ?? NO_TRAIL);

  // keep this private link out of search engines
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => {
      m.remove();
    };
  }, []);

  // clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // refresh every 10 seconds
  useEffect(() => {
    if (!/^[a-f0-9]{32}$/.test(token)) {
      setGone(true);
      return;
    }
    let stopped = false;
    let timer: number | undefined;
    const c = new AbortController();

    const load = async () => {
      try {
        const v = await getShared(token, c.signal);
        if (stopped) return;
        setView(v);
        setViewAt(Date.now());
        setError(null);
      } catch (e) {
        if (stopped || (e as Error).name === "AbortError") return;
        if (e instanceof ApiError && e.status === 404) {
          setGone(true);
          window.clearInterval(timer);
          return;
        }
        setError("Could not refresh. Trying again...");
      }
    };

    load();
    timer = window.setInterval(load, 10000);
    return () => {
      stopped = true;
      c.abort();
      window.clearInterval(timer);
    };
  }, [token]);

  // title warns when the tab is in the background
  useEffect(() => {
    const prev = document.title;
    if (view?.status === "overdue" || view?.status === "sos") {
      document.title = "ALERT: check on the runner";
    }
    return () => {
      document.title = prev;
    };
  }, [view?.status]);

  useEffect(() => {
    if (!map) return;
    const f = () => setMoved(true);
    map.on("dragstart", f);
    return () => {
      map.off("dragstart", f);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !pos || moved) return;
    if (!centered.current) {
      centered.current = true;
      map.jumpTo({ center: [pos.lng, pos.lat], zoom: 16 });
    } else {
      map.easeTo({ center: [pos.lng, pos.lat], duration: 500 });
    }
  }, [map, pos?.lng, pos?.lat, moved]);

  const who = view?.name || "The runner";
  const age =
    view && view.lastUpdateAgeSec !== null
      ? view.lastUpdateAgeSec + (now - viewAt) / 1000
      : null;
  const expectedAt = view
    ? hhmm(new Date(viewAt + view.secondsToExpected * 1000))
    : "";

  const text = (): string => {
    if (!view) return "";
    switch (view.status) {
      case "active":
        return `Live. Last update ${age === null ? "just now" : ago(age) + " ago"}.`;
      case "signal_lost":
        return `No update for ${age === null ? "a while" : ago(age)}. Their phone may have lost signal, or the screen is locked.`;
      case "overdue":
        return `Overdue. ${who} was expected back at ${expectedAt}. Try calling. If you cannot reach them, call 112.`;
      case "sos":
        return `SOS. ${who} pressed the alert button. Call them now. If you cannot reach them, call 112 and give the position below.`;
      case "finished":
        return `${who} finished the run and marked themselves safe. This link is now closed.`;
      case "expired":
        return "This link has expired.";
    }
  };

  const urgent = view?.status === "overdue" || view?.status === "sos";
  const StatusIcon = view ? ICON[view.status] : Radio;

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} center={[19.945, 50.0647]} zoom={13} />
      </div>

      {moved && pos && (
        <button type="button" onClick={() => setMoved(false)} className="map-chip">
          Recenter
        </button>
      )}

      <div className="sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-200 md:hidden" />

        <div className="mb-4">
          <Logo />
        </div>

        {gone && (
          <div className="rounded-2xl bg-brand-50/70 p-4">
            <p className="mb-1 text-lg font-extrabold text-brand-950">Link not available</p>
            <p className="text-sm text-gray-600">This link is not valid, or it has expired.</p>
          </div>
        )}

        {!gone && !view && <p className="text-sm text-gray-500">Loading...</p>}

        {!gone && view && (
          <div>
            <h1 className="mb-3 text-xl font-extrabold text-brand-950">{who}'s run</h1>

            <div
              className={`mb-3 flex items-start gap-3 rounded-2xl border p-3 text-sm ${BANNER[view.status]}`}
              role={urgent ? "alert" : "status"}
            >
              <StatusIcon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{text()}</span>
            </div>

            {view.position && (
              <div className="mb-3 rounded-2xl bg-brand-50/70 p-3 text-sm">
                <p className="text-brand-900">
                  Position: {view.position.lat.toFixed(5)}, {view.position.lng.toFixed(5)}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${view.position.lat},${view.position.lng}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-flex items-center gap-1.5 font-medium text-brand-700 underline"
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open in Google Maps
                </a>
              </div>
            )}

            {view.status !== "finished" && view.status !== "expired" && (
              <p className="mb-3 text-sm text-gray-600">
                Expected back by <span className="font-semibold text-brand-950">{expectedAt}</span>.
                A warning appears {view.graceMin} minutes later.
              </p>
            )}

            {urgent && (
              <a
                href="tel:112"
                className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 font-extrabold text-white shadow-lg shadow-red-600/30 hover:bg-red-700"
              >
                <Phone size={18} aria-hidden="true" /> Call 112
              </a>
            )}

            {error && <p className="mb-2 text-sm text-amber-700">{error}</p>}
            <p className="text-xs text-gray-500">
              Keep this page open to see updates. It refreshes every 10 seconds.
              No alerts are sent to your phone from this page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}