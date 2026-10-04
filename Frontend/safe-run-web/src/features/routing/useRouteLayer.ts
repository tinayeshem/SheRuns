import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { RouteResult } from "./types";

const COLORS = { green: "#2e9e4f", yellow: "#e6a817", red: "#d64545" } as const;
const EMPTY = { type: "FeatureCollection", features: [] } as const;

type Pt = { lng: number; lat: number };

export function useRouteLayer(
  map: maplibregl.Map | null,
  route: RouteResult | null,
  start: Pt | null,
  end: Pt | null = null
) {
  useEffect(() => {
    if (!map) return;

    map.addSource("plan-route", { type: "geojson", data: EMPTY as any });
    map.addSource("plan-points", { type: "geojson", data: EMPTY as any });

    map.addLayer({
      id: "plan-casing",
      type: "line",
      source: "plan-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.9 },
    });
    map.addLayer({
      id: "plan-line",
      type: "line",
      source: "plan-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 6 },
    });
    map.addLayer({
      id: "plan-weak",
      type: "circle",
      source: "plan-points",
      filter: ["==", ["get", "kind"], "weak"],
      paint: {
        "circle-radius": 9,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#d64545",
        "circle-stroke-width": 3,
      },
    });
    map.addLayer({
      id: "plan-start",
      type: "circle",
      source: "plan-points",
      filter: ["==", ["get", "kind"], "start"],
      paint: {
        "circle-radius": 9,
        "circle-color": "#8b5cf6",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });
    map.addLayer({
      id: "plan-end",
      type: "circle",
      source: "plan-points",
      filter: ["==", ["get", "kind"], "end"],
      paint: {
        "circle-radius": 10,
        "circle-color": "#2e1065",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });

    return () => {
      try {
        for (const id of ["plan-end", "plan-start", "plan-weak", "plan-line", "plan-casing"]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        for (const id of ["plan-points", "plan-route"]) {
          if (map.getSource(id)) map.removeSource(id);
        }
      } catch {
        // map was already removed
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const routeSrc = map.getSource("plan-route") as maplibregl.GeoJSONSource | undefined;
    const pointSrc = map.getSource("plan-points") as maplibregl.GeoJSONSource | undefined;
    if (!routeSrc || !pointSrc) return;

    routeSrc.setData(
      route
        ? ({
            type: "Feature",
            properties: { color: COLORS[route.color] },
            geometry: route.geometry,
          } as any)
        : (EMPTY as any)
    );

    const features: any[] = [];
    if (start) {
      features.push({
        type: "Feature",
        properties: { kind: "start" },
        geometry: { type: "Point", coordinates: [start.lng, start.lat] },
      });
    }
    if (end) {
      features.push({
        type: "Feature",
        properties: { kind: "end" },
        geometry: { type: "Point", coordinates: [end.lng, end.lat] },
      });
    }
    if (route?.weakest) {
      features.push({
        type: "Feature",
        properties: { kind: "weak" },
        geometry: { type: "Point", coordinates: route.weakest.at },
      });
    }
    pointSrc.setData({ type: "FeatureCollection", features } as any);
  }, [map, route, start?.lng, start?.lat, end?.lng, end?.lat]);

  useEffect(() => {
    if (!map || !route) return;
    const coords = route.geometry.coordinates;
    if (coords.length < 2) return;
    const b = new maplibregl.LngLatBounds(coords[0], coords[0]);
    for (const c of coords) b.extend(c);
    const wide = window.innerWidth >= 768;
    map.fitBounds(b, {
      padding: wide
        ? { top: 60, bottom: 60, left: 440, right: 70 }
        : { top: 70, left: 40, right: 40, bottom: Math.round(window.innerHeight * 0.5) },
      duration: 600,
    });
  }, [map, route]);
}