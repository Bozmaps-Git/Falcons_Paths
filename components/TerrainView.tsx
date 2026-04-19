"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
}

// AWS terrain tiles — free, no API key, terrarium encoding
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Tiles © Esri — Maxar, Earthstar Geographics",
        maxzoom: 19,
      },
      "terrain-dem": {
        type: "raster-dem",
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
      },
    },
    layers: [
      { id: "satellite", type: "raster", source: "satellite" },
      {
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0.0, 90.0],
          "sky-atmosphere-sun-intensity": 15,
        } as any,
      },
    ],
    terrain: { source: "terrain-dem", exaggeration: 1.4 },
  } as any;
}

export default function TerrainView({ route, meta }: Props) {
  const divRef  = useRef<HTMLDivElement>(null);
  const mapRef  = useRef<maplibregl.Map | null>(null);
  const roRef   = useRef<ResizeObserver | null>(null);

  // Live refs so the route/meta effects always use fresh values
  const liveRoute = useRef(route); liveRoute.current = route;
  const liveMeta  = useRef(meta);  liveMeta.current  = meta;

  // ── INIT ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const m = new maplibregl.Map({
      container: el,
      style: buildStyle(),
      center: [
        (route.bounds.minLon + route.bounds.maxLon) / 2,
        (route.bounds.minLat + route.bounds.maxLat) / 2,
      ],
      zoom: 11,
      pitch: 62,
      bearing: -18,
      attributionControl: { compact: true },
    });

    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    // ResizeObserver
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el);
    requestAnimationFrame(() => m.resize());
    roRef.current = ro;

    m.on("load", () => {
      m.resize();
      addRoute(m, liveRoute.current, liveMeta.current);
      flyToRoute(m, liveRoute.current);
    });

    mapRef.current = m;

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ROUTE / META SWAP ─────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const apply = () => {
      updateRoute(m, route, meta);
      flyToRoute(m, route);
    };
    m.isStyleLoaded() ? apply() : m.once("style.load", apply);
  }, [route, meta]);

  return <div ref={divRef} className="absolute inset-0 bg-forest-950" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addRoute(m: maplibregl.Map, route: ParsedRoute, meta: RouteMeta) {
  if (!m.getSource("route")) {
    m.addSource("route", { type: "geojson", data: routeGeoJson(route) });
  }

  // Casing (dark outline)
  if (!m.getLayer("route-casing")) {
    m.addLayer({
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#0a1410", "line-width": 8, "line-opacity": 0.8 },
    });
  }

  // Route line
  if (!m.getLayer("route-line")) {
    m.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": meta.colour, "line-width": 4 },
    });
  } else {
    m.setPaintProperty("route-line", "line-color", meta.colour);
  }

  // Checkpoint source + layer
  if (!m.getSource("checkpoints")) {
    m.addSource("checkpoints", { type: "geojson", data: cpGeoJson(route) });
  }
  if (!m.getLayer("checkpoint-dots")) {
    m.addLayer({
      id: "checkpoint-dots",
      type: "circle",
      source: "checkpoints",
      paint: {
        "circle-radius": ["case", ["get", "isKey"], 10, 7],
        "circle-color": ["case", ["get", "isKey"], "#f4ece0", meta.colour],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0a1410",
      },
    });
  }
  if (!m.getLayer("checkpoint-labels")) {
    m.addLayer({
      id: "checkpoint-labels",
      type: "symbol",
      source: "checkpoints",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 12,
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      },
      paint: { "text-color": "#f4ece0", "text-halo-color": "#0a1410", "text-halo-width": 2 },
    });
  }
}

function updateRoute(m: maplibregl.Map, route: ParsedRoute, meta: RouteMeta) {
  (m.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData(routeGeoJson(route));
  (m.getSource("checkpoints") as maplibregl.GeoJSONSource | undefined)?.setData(cpGeoJson(route));
  if (m.getLayer("route-line")) m.setPaintProperty("route-line", "line-color", meta.colour);
  if (m.getLayer("checkpoint-dots"))
    m.setPaintProperty("checkpoint-dots", "circle-color",
      ["case", ["get", "isKey"], "#f4ece0", meta.colour] as any);
}

function flyToRoute(m: maplibregl.Map, route: ParsedRoute) {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  m.fitBounds(
    [[minLon, minLat], [maxLon, maxLat]],
    { padding: 80, pitch: 62, bearing: -18, duration: 2000, maxZoom: 14 }
  );
}

function routeGeoJson(route: ParsedRoute) {
  return {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.points.map(([lon, lat]) => [lon, lat]),
      },
    }],
  };
}

function cpGeoJson(route: ParsedRoute) {
  return {
    type: "FeatureCollection" as const,
    features: route.checkpoints.map((c) => ({
      type: "Feature" as const,
      properties: { name: c.name, ele: c.ele, isKey: c.name === "Start" || c.name === "Finish" },
      geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
    })),
  };
}
