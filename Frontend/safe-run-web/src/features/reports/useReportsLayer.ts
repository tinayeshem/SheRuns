import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Report } from "./types";
import { timeAgo } from "./format";

const EMPTY = { type: "FeatureCollection", features: [] } as const;

export function useReportsLayer(map: maplibregl.Map | null, reports: Report[]) {
  useEffect(() => {
    if (!map) return;

    map.addSource("reports-src", { type: "geojson", data: EMPTY as any });
    map.addLayer({
      id: "reports-circle",
      type: "circle",
      source: "reports-src",
      paint: {
        "circle-radius": 8,
        "circle-color": "#ea580c",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });

    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, any>;
      const box = document.createElement("div");
      box.style.fontSize = "13px";
      const title = document.createElement("strong");
      title.textContent = p.label;
      const line = document.createElement("div");
      line.textContent = `${timeAgo(p.lastConfirmedAt)}, ${p.confirmations} confirmation(s)`;
      box.append(title, line);
      if (p.note) {
        const note = document.createElement("div");
        note.textContent = p.note;
        box.append(note);
      }
      new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    };
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const reset = () => (map.getCanvas().style.cursor = "");

    map.on("click", "reports-circle", onClick);
    map.on("mouseenter", "reports-circle", pointer);
    map.on("mouseleave", "reports-circle", reset);

    return () => {
      try {
        map.off("click", "reports-circle", onClick);
        map.off("mouseenter", "reports-circle", pointer);
        map.off("mouseleave", "reports-circle", reset);
        if (map.getLayer("reports-circle")) map.removeLayer("reports-circle");
        if (map.getSource("reports-src")) map.removeSource("reports-src");
      } catch {
        // map was already removed
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const src = map.getSource("reports-src") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: reports.map((r) => ({
        type: "Feature",
        properties: {
          label: r.label,
          note: r.note,
          confirmations: r.confirmations,
          lastConfirmedAt: r.lastConfirmedAt,
        },
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
      })),
    } as any);
  }, [map, reports]);
}