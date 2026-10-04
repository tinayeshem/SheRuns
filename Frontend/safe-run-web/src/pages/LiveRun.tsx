import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  ArrowLeft, Check, Copy, MessageSquare, Phone, Plus, Share2, ShieldAlert, ShieldCheck, X,
} from "lucide-react";
import MapView from "../map/MapView";
import { useProfileStore } from "../store/profileStore";
import type { Color, RouteResult } from "../features/routing/types";
import { useRouteLayer } from "../features/routing/useRouteLayer";
import { useLiveLayer } from "../features/live/useLiveLayer";
import { clock, hhmm, meters } from "../features/live/format";
import {
  ApiError, clearSaved, extendSession, finishSession, loadSaved, saveSaved,
  sendSos, sendUpdate, startSession,
  type LiveStatus, type LiveView, type Saved, type SmsInfo,
} from "../features/live/api";
import { normalizePhone } from "../features/live/phone";
import { useHistoryStore } from "../features/history/store";

const STATUS_STYLE: Record<LiveStatus, string> = {
  active: "bg-green-100 text-green-800",
  signal_lost: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
  sos: "bg-red-100 text-red-800",
  finished: "bg-brand-100 text-brand-800",
  expired: "bg-brand-100 text-brand-800",
};
const STATUS_TEXT: Record<LiveStatus, string> = {
  active: "Sharing live",
  signal_lost: "Signal lost",
  overdue: "Overdue: contacts see a warning",
  sos: "SOS marked",
  finished: "Finished",
  expired: "Link expired",
};
const BADGE: Record<Color, string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

export default function LiveRun() {
  const location = useLocation();
  const st = location.state as { route: RouteResult } | null;
  const saved = loadSaved();

  if (st?.route) return <Run key="run" route={st.route} resume={null} old={saved} />;
  if (saved) return <Run key="run" route={saved.route} resume={saved} old={null} />;
  return <Navigate to="/plan" replace />;
}

type Phase = "setup" | "running" | "ended";

function Run({
  route,
  resume,
  old,
}: {
  route: RouteResult;
  resume: Saved | null;
  old: Saved | null;
}) {
  const navigate = useNavigate();
  const contacts = useProfileStore((s) => s.contacts);
  const addRun = useHistoryStore((s) => s.addRun);

  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [phase, setPhase] = useState<Phase>(resume ? "running" : "setup");
  const [session, setSession] = useState<{ token: string; ownerKey: string } | null>(
    resume ? { token: resume.token, ownerKey: resume.ownerKey } : null
  );
  const [name, setName] = useState(resume?.name ?? "");
  const [minutes, setMinutes] = useState(
    Math.max(15, Math.round(route.distanceKm * 6.5 + 10))
  );
  const [grace, setGrace] = useState(10);
  const [smsOn, setSmsOn] = useState(false);
  const [sms, setSms] = useState<SmsInfo | null>(resume?.sms ?? null);

  const { valid, invalid } = useMemo(() => {
    const valid: { name: string; phone: string }[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    for (const c of contacts) {
      const p = normalizePhone(c.phone);
      if (!p) invalid.push(c.name);
      else if (!seen.has(p)) {
        seen.add(p);
        valid.push({ name: c.name, phone: p });
      }
    }
    return { valid: valid.slice(0, 3), invalid };
  }, [contacts]);

  const [view, setView] = useState<LiveView | null>(null);
  const [viewAt, setViewAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState(resume?.startedAt ?? Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);

  const [pos, setPos] = useState<{ lng: number; lat: number } | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [follow, setFollow] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [netFail, setNetFail] = useState(0);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastRef = useRef<{ lng: number; lat: number } | null>(null);
  const countedRef = useRef<{ lng: number; lat: number } | null>(null);

  useRouteLayer(map, route, null);
  useLiveLayer(map, pos, trail);

  // clock
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // GPS
  useEffect(() => {
    if (phase !== "running") return;
    if (!navigator.geolocation) {
      setGpsError("Location is not available in this browser");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setGpsError(null);
        const cur = { lng: p.coords.longitude, lat: p.coords.latitude };
        lastRef.current = cur;
        setPos(cur);
        if (p.coords.accuracy > 50) return;
        const prev = countedRef.current;
        if (!prev) {
          countedRef.current = cur;
          setTrail([[cur.lng, cur.lat]]);
          return;
        }
        const d = meters([prev.lng, prev.lat], [cur.lng, cur.lat]);
        if (d >= 5) {
          countedRef.current = cur;
          setDistanceM((m) => m + d);
          setTrail((t) => [...t.slice(-299), [cur.lng, cur.lat]]);
        }
      },
      () => setGpsError("No GPS signal. Check that location is allowed."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [phase]);

  // heartbeat: send the position every 10 seconds
  useEffect(() => {
    if (phase !== "running" || !session) return;
    let stopped = false;
    const tick = async () => {
      const p = lastRef.current;
      if (!p) return;
      try {
        const v = await sendUpdate(session.token, session.ownerKey, p.lng, p.lat);
        if (stopped) return;
        setView(v);
        setViewAt(Date.now());
        setNetFail(0);
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 404) {
          setError("This run no longer exists on the server. Tap I'm safe to close it.");
        }
        setNetFail((n) => n + 1);
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [phase, session]);

  // keep the screen on while running
  useEffect(() => {
    if (phase !== "running") return;
    let lock: any = null;
    const request = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request("screen");
      } catch {
        // not allowed or not supported
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      try {
        lock?.release?.();
      } catch {
        // already released
      }
    };
  }, [phase]);

  // follow the runner until the map is dragged
  useEffect(() => {
    if (!map) return;
    const off = () => setFollow(false);
    map.on("dragstart", off);
    return () => {
      map.off("dragstart", off);
    };
  }, [map]);
  useEffect(() => {
    if (map && follow && pos && phase === "running") {
      map.easeTo({ center: [pos.lng, pos.lat], duration: 500 });
    }
  }, [map, follow, pos, phase]);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const here = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Location is not available in this browser"));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => reject(new Error("Allow location to start a shared run.")),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });
      const lng = here.coords.longitude;
      const lat = here.coords.latitude;

      if (old) {
        await finishSession(old.token, old.ownerKey).catch(() => {});
        clearSaved();
      }

      const r = await startSession({
        name,
        expectedMinutes: minutes,
        graceMinutes: grace,
        lng,
        lat,
        alertPhones: smsOn ? valid.map((c) => c.phone) : [],
      });
      const started = Date.now();
      saveSaved({
        token: r.token,
        ownerKey: r.ownerKey,
        route,
        name: name.trim() || null,
        startedAt: started,
        sms: r.sms,
      });

      lastRef.current = { lng, lat };
      countedRef.current = { lng, lat };
      setPos({ lng, lat });
      setTrail([[lng, lat]]);
      setDistanceM(0);
      setStartedAt(started);
      setSession({ token: r.token, ownerKey: r.ownerKey });
      setView(r.view);
      setSms(r.sms);
      setViewAt(Date.now());
      setPhase("running");
      navigate("/live-run", { replace: true, state: null });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const extend = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      setView(await extendSession(session.token, session.ownerKey, 15));
      setViewAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const safe = async () => {
    if (!session) return;
    if (!window.confirm("End the run and close the share link?")) return;
    setBusy(true);
    setError(null);
    try {
      await finishSession(session.token, session.ownerKey);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        setError("Could not reach the server. Try again when you have signal.");
        setBusy(false);
        return;
      }
    }
    clearSaved();
    const end = Date.now();
    const durationSec = Math.round((end - startedAt) / 1000);
    if (distanceM >= 100 || durationSec >= 120) {
      addRun({
        startedAt,
        durationSec,
        distanceKm: Math.round(distanceM / 10) / 100,
        plannedKm: route.distanceKm,
        score: route.score,
        color: route.color,
        weakest: route.weakest?.name ?? null,
      });
    }
    setEndedAt(end);
    setPhase("ended");
    setBusy(false);
  };

  const markSos = async () => {
    if (!session) return;
    setBusy(true);
    try {
      setView(await sendSos(session.token, session.ownerKey));
      setViewAt(Date.now());
      setSosSent(true);
    } catch {
      setError("Could not reach the server. Call 112 now.");
    } finally {
      setBusy(false);
    }
  };

  const shareUrl = session ? `${window.location.origin}/live/${session.token}` : "";
  const backBy = view ? hhmm(new Date(viewAt + view.secondsToExpected * 1000)) : "";
  const message = `I'm going for a run. Follow me live: ${shareUrl} If I'm not back by ${backBy}, please call me.`;
  const sosMessage = `SOS. I need help. My live location: ${shareUrl}`;
  const smsHref = (phone: string, body: string) =>
    `sms:${phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(body)}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const doShare = async () => {
    try {
      await navigator.share({ title: "Follow my run", text: message });
    } catch {
      // cancelled
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the link and copy it by hand.");
    }
  };

  const secLeft = view ? view.secondsToExpected - (now - viewAt) / 1000 : null;
  const elapsed = ((endedAt ?? now) - startedAt) / 1000;
  const pace = distanceM >= 100 ? clock(elapsed / (distanceM / 1000)) : null;

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView onReady={setMap} zoom={15} />
      </div>

      {phase === "running" && !follow && (
        <button type="button" onClick={() => setFollow(true)} className="map-chip">
          Recenter
        </button>
      )}

      <div className="sheet">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-brand-200 md:hidden" />

        {phase === "setup" && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="Back"
                className="rounded-xl p-2 text-brand-800 hover:bg-brand-50"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-extrabold text-brand-950">Start your run</h1>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-50/70 p-3">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[route.color]}`}>
                {route.score} {route.color}
              </span>
              <span className="text-sm text-brand-900">{route.distanceKm} km route</span>
            </div>

            <label htmlFor="run-name" className="mb-1 block text-sm font-semibold text-brand-950">
              Name your contacts will see (optional)
            </label>
            <input
              id="run-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="Your first name"
              className="field mb-4"
            />

            <div className="mb-4 rounded-2xl bg-brand-50/70 p-3">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-brand-900">I expect to be back in</span>
                <span className="font-bold text-brand-900">{minutes} min</span>
              </div>
              <input
                type="range"
                min={15}
                max={240}
                step={5}
                value={minutes}
                aria-label="Expected minutes"
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-full"
              />
              <label htmlFor="run-grace" className="mb-1 mt-3 block text-sm text-brand-900">
                Warn my contacts if I am late by
              </label>
              <select
                id="run-grace"
                value={grace}
                onChange={(e) => setGrace(Number(e.target.value))}
                className="field"
              >
                {[5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4 rounded-2xl border border-brand-100 bg-white p-3">
              <label className="flex items-start gap-2.5 text-sm text-brand-950">
                <input
                  type="checkbox"
                  checked={smsOn}
                  disabled={valid.length === 0}
                  onChange={(e) => setSmsOn(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  Text my contacts if I am overdue or press SOS. I have told
                  them they may get a message from Safe Run.
                </span>
              </label>
              {valid.length > 0 ? (
                <p className="mt-2 text-xs text-gray-600">
                  Would text: {valid.map((c) => c.name).join(", ")}. Their
                  numbers go to our server and our SMS provider only if you
                  tick this box, and are deleted when the run ends.
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-600">
                  No contact has a usable number. Add one with the country
                  code, for example +48..., in Settings.
                </p>
              )}
              {invalid.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  Skipped (no country code): {invalid.join(", ")}.
                </p>
              )}
            </div>

            <p className="mb-4 text-xs text-gray-600">
              Your location is sent to our server every 10 seconds while you
              run, and anyone with your share link can see it. It is deleted
              when you end the run. The link stops working about an hour after
              your warning time.
            </p>

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button type="button" onClick={begin} disabled={busy} className="btn-primary w-full py-3.5 text-base">
              {busy ? "Starting..." : "Start run and create share link"}
            </button>
          </div>
        )}

        {phase === "running" && (
          <div>
            {sosOpen && (
              <div className="mb-4 rounded-2xl border-2 border-red-600 bg-white p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-extrabold text-red-700">In danger? Call 112 now.</p>
                  <button
                    type="button"
                    onClick={() => setSosOpen(false)}
                    aria-label="Close"
                    className="rounded-lg p-1 text-gray-500 hover:bg-red-50"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="mb-3 text-xs text-gray-600">
                  This app does not contact emergency services by itself.
                </p>
                <a
                  href="tel:112"
                  className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700"
                >
                  <Phone size={18} aria-hidden="true" /> Call 112
                </a>
                {!sosSent ? (
                  <button
                    type="button"
                    onClick={markSos}
                    disabled={busy}
                    className="w-full rounded-xl border border-red-600 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Mark SOS on my share link
                  </button>
                ) : (
                  <>
                    <p className="mb-2 text-sm text-gray-700">
                      {sms && sms.mode === "live" && sms.contacts > 0
                        ? "SOS is shown on your share link, and your contacts are being texted."
                        : "SOS is shown on your share link. Contacts see it only if the page is open, so text them too."}
                    </p>
                    {contacts.map((c, i) => (
                      <a
                        key={i}
                        href={smsHref(c.phone, sosMessage)}
                        className="mb-1 flex items-center justify-center gap-2 rounded-xl border border-red-600 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                      >
                        <MessageSquare size={16} aria-hidden="true" /> Text {c.name}
                      </a>
                    ))}
                  </>
                )}
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  view ? STATUS_STYLE[view.status] : "bg-brand-100 text-brand-800"
                }`}
              >
                {view ? STATUS_TEXT[view.status] : "Connecting..."}
              </span>
              <span className="text-sm font-medium text-brand-900">
                {secLeft === null
                  ? ""
                  : secLeft >= 0
                  ? `${clock(secLeft)} left`
                  : `Overdue by ${clock(-secLeft)}`}
              </span>
            </div>

            <div className="mb-3 grid grid-cols-3 rounded-2xl bg-brand-50/70 py-3 text-center">
              <div>
                <p className="text-2xl font-extrabold text-brand-950">{clock(elapsed)}</p>
                <p className="text-xs text-gray-500">Time</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-brand-950">{(distanceM / 1000).toFixed(2)}</p>
                <p className="text-xs text-gray-500">km</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-brand-950">{pace ?? "-"}</p>
                <p className="text-xs text-gray-500">min/km</p>
              </div>
            </div>

            {gpsError && <p className="mb-2 text-sm text-red-600">{gpsError}</p>}
            {netFail >= 2 && (
              <p className="mb-2 text-sm text-amber-700">
                No connection. Your contacts see "signal lost" after 3 minutes
                without updates.
              </p>
            )}
            {view?.status === "overdue" && (
              <p className="mb-2 text-sm text-red-700">
                You are past your check-in time. Tap +15 min if you are still
                running, or I'm safe if you are done.
              </p>
            )}
            {view?.status === "expired" && (
              <p className="mb-2 text-sm text-red-700">
                The share link has expired. End this run.
              </p>
            )}
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

            <div className="mb-3 rounded-2xl border border-brand-100 bg-white p-3">
              <p className="mb-2 text-sm font-semibold text-brand-950">Share with your contacts</p>
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Share link"
                className="field mb-2 py-2 text-xs"
              />
              <div className="mb-2 flex gap-2">
                {canShare && (
                  <button type="button" onClick={doShare} className="btn-ghost flex-1 py-2 text-sm">
                    <Share2 size={16} aria-hidden="true" /> Share
                  </button>
                )}
                <button type="button" onClick={copy} className="btn-ghost flex-1 py-2 text-sm">
                  {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              {contacts.length > 0 ? (
                contacts.map((c, i) => (
                  <a
                    key={i}
                    href={smsHref(c.phone, message)}
                    className="mb-1 flex items-center justify-center gap-2 rounded-xl border border-brand-200 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50"
                  >
                    <MessageSquare size={16} aria-hidden="true" /> Text {c.name}
                  </a>
                ))
              ) : (
                <p className="text-xs text-gray-500">
                  No saved contacts. Add them in Settings, or share the link yourself.
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                {sms && sms.mode === "live" && sms.contacts > 0
                  ? `Text alerts are on for ${sms.contacts} contact(s). They are sent if you are overdue or press SOS.`
                  : sms && sms.mode === "test" && sms.contacts > 0
                  ? "Text alerts are in test mode: no real messages are sent. Contacts see warnings only while the page is open."
                  : "Text alerts are off. Contacts see warnings only while they keep the page open."}
              </p>
            </div>

            <div className="mb-3 flex gap-2">
              <button type="button" onClick={extend} disabled={busy} className="btn-ghost flex-1">
                <Plus size={18} aria-hidden="true" /> 15 min
              </button>
              <button type="button" onClick={safe} disabled={busy} className="btn-primary flex-1">
                <ShieldCheck size={18} aria-hidden="true" /> I'm safe
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSosOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 text-lg font-extrabold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700"
            >
              <ShieldAlert size={22} aria-hidden="true" /> SOS
            </button>
          </div>
        )}

        {phase === "ended" && (
          <div className="text-center">
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full grad-brand text-white shadow-lg shadow-brand-600/40">
              <Check size={28} aria-hidden="true" />
            </span>
            <h1 className="text-xl font-extrabold text-brand-950">Run finished</h1>
            <p className="mt-1 text-sm text-gray-600">
              {(distanceM / 1000).toFixed(2)} km in {clock(elapsed)}
            </p>
            <p className="mb-5 mt-2 text-sm text-gray-600">
              Your share link is closed and your location was deleted from our server.
            </p>
            <button type="button" onClick={() => navigate("/history")} className="btn-primary mb-2 w-full">
              See my history
            </button>
            <button type="button" onClick={() => navigate("/home")} className="btn-ghost w-full">
              Back to the map
            </button>
          </div>
        )}
      </div>
    </div>
  );
}