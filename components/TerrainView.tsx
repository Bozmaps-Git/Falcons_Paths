"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

export type ViewMode = "2d" | "3d";
export type Basemap = "satellite" | "osm" | "topo";

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
  view: ViewMode;
  basemap: Basemap;
}

const BASEMAPS: Record<Basemap, any> = {
  satellite: {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 19,
    attribution: "Imagery © Esri",
  },
  osm: {
    type: "raster",
    tiles: [
      "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
      "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
    ],
    tileSize: 256,
    maxzoom: 19,
    attribution: "© OpenStreetMap contributors",
  },
  topo: {
    type: "raster",
    tiles: [
      "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
      "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
    ],
    tileSize: 256,
    maxzoom: 17,
    attribution: "© OpenTopoMap · © OSM",
  },
};

const TERRAIN_SRC = {
  type: "raster-dem" as const,
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256,
  encoding: "terrarium" as const,
  maxzoom: 15,
  attribution: "Terrain: AWS Terrain Tiles",
};

function buildStyle(basemap: Basemap): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      basemap: BASEMAPS[basemap],
      terrain: TERRAIN_SRC,
    },
    layers: [{ id: "basemap", type: "raster", source: "basemap" }],
  } as any;
}

export default function TerrainView({ route, meta, view, basemap }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // Latest-prop refs for async handlers
  const liveRoute = useRef(route); liveRoute.current = route;
  const liveMeta = useRef(meta); liveMeta.current = meta;
  const liveView = useRef(view); liveView.current = view;

  // ── INIT (once) ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const m = new maplibregl.Map({
      container: el,
      style: buildStyle(basemap),
      center: centroid(liveRoute.current),
      zoom: 11,
      pitch: liveView.current === "3d" ? 62 : 0,
      bearing: liveView.current === "3d" ? -18 : 0,
      maxPitch: 85,
      attributionControl: { compact: true },
      antialias: true,
    });

    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el);
    requestAnimationFrame(() => m.resize());
    roRef.current = ro;

    const onStyleReady = () => {
      applyTerrain(m, liveView.current);
      renderRoute(m, liveRoute.current, liveMeta.current);
    };

    m.on("load", () => {
      m.resize();
      onStyleReady();
      fitToRoute(m, liveRoute.current, liveView.current);
    });
    m.on("style.load", onStyleReady);

    mapRef.current = m;

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── BASEMAP CHANGE ──────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    m.setStyle(buildStyle(basemap));
    // style.load handler re-applies terrain + route
  }, [basemap]);

  // ── VIEW CHANGE (2D/3D) ─────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    applyTerrain(m, view);
    m.easeTo({
      pitch: view === "3d" ? 62 : 0,
      bearing: view === "3d" ? -18 : 0,
      duration: 700,
    });
  }, [view]);

  // ── ROUTE / META SWAP ───────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    const apply = () => {
      renderRoute(m, route, meta);
      fitToRoute(m, route, liveView.current);
    };
    m.isStyleLoaded() ? apply() : m.once("idle", apply);
  }, [route, meta]);

  return <div ref={divRef} className="absolute inset-0 bg-forest-950" />;
}

// ─── Terrain toggle ───────────────────────────────────────────────────────

function applyTerrain(m: maplibregl.Map, view: ViewMode) {
  if (view === "3d") {
    try {
      m.setTerrain({ source: "terrain", exaggeration: 1.4 });
    } catch {}
  } else {
    try {
      m.setTerrain(null);
    } catch {}
  }
}

// ─── Route render ─────────────────────────────────────────────────────────

function renderRoute(m: maplibregl.Map, route: ParsedRoute, meta: RouteMeta) {
  if (!m.isStyleLoaded()) {
    m.once("idle", () => renderRoute(m, route, meta));
    return;
  }

  const lineFC = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: route.points.map((p) => [p[0], p[1]] as [number, number]),
        },
      },
    ],
  };

  const endpointsFC = {
    type: "FeatureCollection" as const,
    features: route.checkpoints.map((c) => ({
      type: "Feature" as const,
      properties: {
        kind: c.name === "Start" ? "start" : c.name === "Finish" ? "finish" : "cp",
      },
      geometry: {
        type: "Point" as const,
        coordinates: [c.lon, c.lat] as [number, number],
      },
    })),
  };

  upsertSource(m, "route", lineFC);
  upsertSource(m, "endpoints", endpointsFC);

  addLayer(m, {
    id: "route-casing",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#0a1410", "line-width": 8, "line-opacity": 0.9 },
  });
  addLayer(m, {
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": meta.colour, "line-width": 4 },
  });
  addLayer(m, {
    id: "endpoint-halo",
    type: "circle",
    source: "endpoints",
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "kind"], "cp"],
        10,
        14,
      ],
      "circle-color": [
        "case",
        ["==", ["get", "kind"], "finish"],
        "#88b04b",
        ["==", ["get", "kind"], "start"],
        "#e8a55c",
        meta.colour,
      ],
      "circle-opacity": 0.25,
    },
  });
  addLayer(m, {
    id: "endpoint-dot",
    type: "circle",
    source: "endpoints",
    paint: {
      "circle-radius": [
        "case",
        ["==", ["get", "kind"], "cp"],
        5,
        7,
      ],
      "circle-color": [
        "case",
        ["==", ["get", "kind"], "finish"],
        "#88b04b",
        ["==", ["get", "kind"], "start"],
        "#e8a55c",
        meta.colour,
      ],
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#0a1410",
    },
  });

  // Refresh colour when meta changes (layers already exist on subsequent calls)
  if (m.getLayer("route-line")) {
    m.setPaintProperty("route-line", "line-color", meta.colour);
  }
}

function upsertSource(m: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const s = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (s) s.setData(data);
  else m.addSource(id, { type: "geojson", data });
}

function addLayer(m: maplibregl.Map, spec: maplibregl.LayerSpecification) {
  if (!m.getLayer(spec.id)) m.addLayer(spec);
}

function fitToRoute(m: maplibregl.Map, route: ParsedRoute, view: ViewMode) {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  m.fitBounds(
    [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
    {
      padding: 80,
      pitch: view === "3d" ? 62 : 0,
      bearing: view === "3d" ? -18 : 0,
      duration: 1200,
      maxZoom: 14,
    },
  );
}

function centroid(route: ParsedRoute): [number, number] {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}
