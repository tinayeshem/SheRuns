import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const MIN_ZOOM = 14;
const SRC = "segments";
const LAYER = "segments-line";
const EMPTY = { type: "FeatureCollection", features: [] } as const;

const FACTOR_LABELS: Record<string, string> = {
  lighting: "Lighting",
  isolation: "Isolation",
  foot_traffic: "Foot traffic",
  traffic: "Traffic",
  surface: "Surface",
  reports: "Reports",
};

const barColor = (n: number) =>
  n >= 70 ? "#2e9e4f" : n >= 40 ? "#e6a817" : "#d64545";

export type LayerStatus = "idle" | "loading" | "zoom" | "error";

export function useSafetyLayer(
  map: maplibregl.Map | null,
  hour: number,
  sunset: number
) {
  const [status, setStatus] = useState<LayerStatus>("zoom");
  const params = useRef({ hour, sunset });
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    params.current = { hour, sunset };
    refreshRef.current();
  }, [hour, sunset]);

  useEffect(() => {
    if (!map) return;
    let controller: AbortController | null = null;
    let timer: number | undefined;

    map.addSource(SRC, { type: "geojson", data: EMPTY as any });
    map.addLayer({
      id: LAYER,
      type: "line",
      source: SRC,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "match", ["get", "color"],
          "green", "#2e9e4f",
          "yellow", "#e6a817",
          "red", "#d64545",
          "#888888",
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2, 18, 6],
        "line-opacity": [
          "case", ["==", ["get", "confidence"], "low"], 0.55, 0.95,
        ],
      },
    });

    const refresh = async () => {
      const source = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      if (map.getZoom() < MIN_ZOOM) {
        controller?.abort();
        source.setData(EMPTY as any);
        setStatus("zoom");
        return;
      }

      controller?.abort();
      controller = new AbortController();
      const b = map.getBounds();
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
        .map((n) => n.toFixed(5))
        .join(",");
      const { hour, sunset } = params.current;

      setStatus("loading");
      try {
        const res = await fetch(
          `${API}/segments?bbox=${bbox}&hour=${hour}&sunset=${sunset.toFixed(2)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error(String(res.status));
        source.setData(await res.json());
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        console.error(e);
        setStatus("error");
      }
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 300);
    };
    refreshRef.current = schedule;

    const onClick = async (e: maplibregl.MapLayerMouseEvent) => {
  const f = e.features?.[0];
  if (!f) return;
  const p = f.properties as Record<string, any>;

  const box = document.createElement("div");
  box.style.cssText = "font-size:13px;min-width:210px";
  const title = document.createElement("strong");
  title.textContent = p.name || "Unnamed street";
  const head = document.createElement("div");
  head.textContent = `Score ${p.score} (${p.color})`;
  const body = document.createElement("div");
  body.style.marginTop = "6px";
  body.textContent = "Loading details...";
  box.append(title, head, body);

  new maplibregl.Popup({ maxWidth: "280px" })
    .setLngLat(e.lngLat)
    .setDOMContent(box)
    .addTo(map);

  try {
    const { hour, sunset } = params.current;
    const res = await fetch(
      `${API}/segments/${p.id}?hour=${hour}&sunset=${sunset.toFixed(2)}`
    );
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    body.textContent = "";

    const period = document.createElement("div");
    period.style.cssText = "color:#666;margin-bottom:4px";
    period.textContent =
      d.period === "night" ? "Night weights apply" : "Day weights apply";
    body.append(period);

    let weakestKey = "";
    let weakestVal = 101;
    for (const key of Object.keys(FACTOR_LABELS)) {
      const val: number = d.factors[key];
      if (  val < weakestVal) {
        weakestVal = val;
        weakestKey = key;
      }

      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:6px;margin:2px 0";
      const label = document.createElement("span");
      label.style.cssText = "width:80px";
      label.textContent = FACTOR_LABELS[key];
      const track = document.createElement("div");
      track.style.cssText =
        "flex:1;height:6px;background:#e5e5e5;border-radius:3px";
      const fill = document.createElement("div");
      fill.style.cssText = `width:${val}%;height:6px;border-radius:3px;background:${barColor(val)}`;
      track.append(fill);
      const num = document.createElement("span");
      num.style.cssText = "width:24px;text-align:right";
      num.textContent = String(val);
      row.append(label, track, num);
      body.append(row);
    }

    const weakest = document.createElement("div");
    weakest.style.cssText = "margin-top:6px;font-weight:500";
    weakest.textContent = `Weakest: ${FACTOR_LABELS[weakestKey]} (${weakestVal})`;
    body.append(weakest);

    if (d.override) {
      const ov = document.createElement("div");
      ov.style.cssText = "margin-top:2px;color:#d64545";
      ov.textContent =
        d.override === "harassment"
          ? "Lowered by a recent harassment report"
          : "Lowered by an ice or flooding report";
      body.append(ov);
    }

    if (d.confidence === "low") {
      const low = document.createElement("div");
      low.style.cssText = "margin-top:2px;color:#666";
      low.textContent = "Low confidence: lighting data is missing";
      body.append(low);
    }
  } catch {
    body.textContent = "Could not load details.";
  }
};
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const reset = () => (map.getCanvas().style.cursor = "");

    map.on("moveend", schedule);
    map.on("click", LAYER, onClick);
    map.on("mouseenter", LAYER, pointer);
    map.on("mouseleave", LAYER, reset);
    schedule();

    return () => {
      window.clearTimeout(timer);
      controller?.abort();
      try {
        map.off("moveend", schedule);
        map.off("click", LAYER, onClick);
        map.off("mouseenter", LAYER, pointer);
        map.off("mouseleave", LAYER, reset);
        if (map.getLayer(LAYER)) map.removeLayer(LAYER);
        if (map.getSource(SRC)) map.removeSource(SRC);
      } catch {
        // map was already removed
      }
    };
  }, [map]);

  return status;
}