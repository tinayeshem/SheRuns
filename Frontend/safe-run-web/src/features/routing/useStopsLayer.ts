import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Stop } from "./types";

const EMPTY = { type: "FeatureCollection", features: [] } as const;

export const KIND_LABEL: Record<string, string> = {
  pharmacy: "Pharmacy",
  hospital: "Hospital",
  police: "Police station",
  fire_station: "Fire station",
  convenience: "Convenience store",
  supermarket: "Supermarket",
};

export function useStopsLayer(map: maplibregl.Map | null, stops: Stop[]) {
  useEffect(() => {
    if (!map) return;

    map.addSource("plan-stops", { type: "geojson", data: EMPTY as any });
    map.addLayer({
      id: "plan-stops-circle",
      type: "circle",
      source: "plan-stops",
      paint: {
        "circle-radius": 7,
        "circle-color": "#7c3aed",
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
      title.textContent = p.name || KIND_LABEL[p.kind] || "Stop";
      const line = document.createElement("div");
      line.textContent = `${KIND_LABEL[p.kind] ?? p.kind}, ${p.distanceM} m from the route`;
      box.append(title, line);
      new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    };
    const pointer = () => (map.getCanvas().style.cursor = "pointer");
    const reset = () => (map.getCanvas().style.cursor = "");

    map.on("click", "plan-stops-circle", onClick);
    map.on("mouseenter", "plan-stops-circle", pointer);
    map.on("mouseleave", "plan-stops-circle", reset);

    return () => {
      try {
        map.off("click", "plan-stops-circle", onClick);
        map.off("mouseenter", "plan-stops-circle", pointer);
        map.off("mouseleave", "plan-stops-circle", reset);
        if (map.getLayer("plan-stops-circle")) map.removeLayer("plan-stops-circle");
        if (map.getSource("plan-stops")) map.removeSource("plan-stops");
      } catch {
        // map was already removed
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const src = map.getSource("plan-stops") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: stops.map((s) => ({
        type: "Feature",
        properties: { kind: s.kind, name: s.name, distanceM: s.distanceM },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    } as any);
  }, [map, stops]);
}