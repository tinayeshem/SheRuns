import { useEffect } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

const EMPTY = { type: "FeatureCollection", features: [] } as const;

export function useLiveLayer(
  map: MapLibreMap | null,
  pos: { lng: number; lat: number } | null,
  trail: [number, number][]
) {
  useEffect(() => {
    if (!map) return;

    map.addSource("live-trail", { type: "geojson", data: EMPTY as any });
    map.addSource("live-pos", { type: "geojson", data: EMPTY as any });

    map.addLayer({
      id: "live-trail-line",
      type: "line",
      source: "live-trail",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#1d4ed8", "line-width": 4, "line-opacity": 0.8 },
    });
    map.addLayer({
      id: "live-pos-halo",
      type: "circle",
      source: "live-pos",
      paint: { "circle-radius": 16, "circle-color": "#1d4ed8", "circle-opacity": 0.2 },
    });
    map.addLayer({
      id: "live-pos-dot",
      type: "circle",
      source: "live-pos",
      paint: {
        "circle-radius": 8,
        "circle-color": "#1d4ed8",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });

    return () => {
      try {
        for (const id of ["live-pos-dot", "live-pos-halo", "live-trail-line"]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        for (const id of ["live-pos", "live-trail"]) {
          if (map.getSource(id)) map.removeSource(id);
        }
      } catch {
        // map was already removed
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const trailSrc = map.getSource("live-trail") as GeoJSONSource | undefined;
    const posSrc = map.getSource("live-pos") as GeoJSONSource | undefined;
    if (!trailSrc || !posSrc) return;

    trailSrc.setData(
      trail.length >= 2
        ? ({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: trail },
          } as any)
        : (EMPTY as any)
    );
    posSrc.setData(
      pos
        ? ({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [pos.lng, pos.lat] },
          } as any)
        : (EMPTY as any)
    );
  }, [map, pos, trail]);
}