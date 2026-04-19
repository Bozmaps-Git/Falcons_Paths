"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

// ─── Tile endpoints ──────────────────────────────────────────────────────────

const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TERRAIN_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const GLYPHS = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
}

type Status = "booting" | "style" | "terrain" | "ready" | "error";

interface DebugEvent {
  t: number;
  msg: string;
  level: "info" | "warn" | "error";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TerrainView({ route, meta }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  // Live refs so async callbacks always see latest props
  const liveRoute = useRef(route); liveRoute.current = route;
  const liveMeta = useRef(meta); liveMeta.current = meta;

  const [status, setStatus] = useState<Status>("booting");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>([]);

  const log = (msg: string, level: DebugEvent["level"] = "info") => {
    const line = `[TerrainView] ${msg}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    setEvents((ev) => [...ev.slice(-40), { t: Date.now(), msg, level }]);
  };

  // ── INIT (once) ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    log(`init · container ${el.clientWidth}×${el.clientHeight}`);

    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: el,
        style: buildStyle(),
        center: centroid(liveRoute.current),
        zoom: 11,
        pitch: 62,
        bearing: -18,
        maxPitch: 85,
        attributionControl: { compact: true },
        antialias: true,
      });
    } catch (e: any) {
      log(`map constructor threw: ${e?.message}`, "error");
      setErrMsg(e?.message || "Map failed to initialize");
      setStatus("error");
      return;
    }

    m.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showCompass: true,
        showZoom: true,
      }),
      "top-right",
    );
    m.addControl(
      new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
      "bottom-left",
    );

    // Size tracking — critical for correct canvas dimensions
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el);
    requestAnimationFrame(() => m.resize());
    roRef.current = ro;

    // Generic error channel
    m.on("error", (e) => {
      const raw = (e as any)?.error;
      const msg = raw?.message || raw?.status || "unknown MapLibre error";
      log(`error: ${msg}`, "warn");
    });

    m.on("styledata", () => {
      if (status === "booting") {
        setStatus("style");
        log("style data received");
      }
    });

    m.on("load", () => {
      log("load event fired");
      m.resize();

      // Activate terrain AFTER load so we can degrade gracefully if it fails
      try {
        m.setTerrain({ source: "terrain-dem", exaggeration: 1.4 });
        setStatus("terrain");
        log("terrain enabled");
      } catch (e: any) {
        log(`terrain enable failed: ${e?.message}`, "warn");
      }

      try {
        addRouteLayers(m, liveRoute.current, liveMeta.current);
        flyToRoute(m, liveRoute.current);
        setStatus("ready");
        log("route overlay ready");
      } catch (e: any) {
        log(`route overlay failed: ${e?.message}`, "error");
        setErrMsg(e?.message || "Failed to draw route");
        setStatus("error");
      }
    });

    mapRef.current = m;

    return () => {
      log("unmount");
      roRef.current?.disconnect();
      roRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ROUTE / META SWAP ─────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || status !== "ready") return;
    const apply = () => {
      updateRouteLayers(m, route, meta);
      flyToRoute(m, route);
      log(`route swapped → ${meta.label}`);
    };
    m.isStyleLoaded() ? apply() : m.once("idle", apply);
  }, [route, meta, status]);

  return (
    <>
      <div ref={divRef} className="absolute inset-0 bg-forest-950" />

      {status !== "ready" && status !== "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-forest-950/70 backdrop-blur-sm">
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-wider2 text-amber-light mb-2">
              {statusLabel(status)}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim animate-pulse">
              Preparing 3D terrain
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute top-4 left-4 max-w-sm border border-red-500/40 bg-forest-900/95 p-3 shadow-lg">
          <div className="font-mono text-[9px] uppercase tracking-wider2 text-red-400 mb-1">
            3D Terrain Error
          </div>
          <div className="text-[11px] text-paper-dim mb-2">{errMsg}</div>
          <button
            onClick={() => setDebugOpen(true)}
            className="font-mono text-[9px] uppercase tracking-wider2 text-amber-light underline"
          >
            Show debug log
          </button>
        </div>
      )}

      <button
        onClick={() => setDebugOpen((v) => !v)}
        className="absolute top-4 left-4 border border-paper/15 bg-forest-900/70 backdrop-blur px-2 py-1 font-mono text-[9px] uppercase tracking-wider2 text-paper-dim hover:text-paper"
      >
        {debugOpen ? "Hide log" : "Debug"}
      </button>

      {debugOpen && (
        <div className="absolute top-12 left-4 max-w-md w-[360px] max-h-[320px] overflow-y-auto border border-paper/15 bg-forest-950/95 backdrop-blur p-3 font-mono text-[10px] leading-relaxed">
          <div className="mb-2 flex items-center justify-between">
            <div className="uppercase tracking-wider2 text-amber-light">
              Debug · {statusLabel(status)}
            </div>
            <button
              onClick={() => setEvents([])}
              className="text-paper-dim hover:text-paper uppercase tracking-wider"
            >
              clear
            </button>
          </div>
          {events.length === 0 ? (
            <div className="text-paper-dim/60">no events</div>
          ) : (
            events.map((e, i) => (
              <div
                key={i}
                className={
                  e.level === "error"
                    ? "text-red-400"
                    : e.level === "warn"
                    ? "text-amber-light"
                    : "text-paper-dim"
                }
              >
                <span className="text-paper-dim/50">
                  {new Date(e.t).toISOString().slice(11, 19)}
                </span>{" "}
                {e.msg}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}

// ─── Style builder ────────────────────────────────────────────────────────────

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      satellite: {
        type: "raster",
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        attribution:
          'Imagery © <a href="https://www.esri.com">Esri</a> · Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
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
  } as any;
}

// ─── Route overlay ────────────────────────────────────────────────────────────

function addRouteLayers(
  m: maplibregl.Map,
  route: ParsedRoute,
  meta: RouteMeta,
) {
  if (!m.getSource("route")) {
    m.addSource("route", { type: "geojson", data: routeLineGeoJson(route) });
  }
  if (!m.getSource("checkpoints")) {
    m.addSource("checkpoints", {
      type: "geojson",
      data: checkpointsGeoJson(route),
    });
  }

  // Casing (dark underline below the route)
  if (!m.getLayer("route-casing")) {
    m.addLayer({
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#0a1410",
        "line-width": 9,
        "line-opacity": 0.85,
      },
    });
  }

  // Route line
  if (!m.getLayer("route-line")) {
    m.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": meta.colour,
        "line-width": 4.5,
        "line-opacity": 1,
      },
    });
  }

  // Checkpoint halos
  if (!m.getLayer("checkpoint-halo")) {
    m.addLayer({
      id: "checkpoint-halo",
      type: "circle",
      source: "checkpoints",
      paint: {
        "circle-radius": ["case", ["get", "isKey"], 16, 11],
        "circle-color": meta.colour,
        "circle-opacity": 0.18,
      },
    });
  }

  // Checkpoint dots
  if (!m.getLayer("checkpoint-dots")) {
    m.addLayer({
      id: "checkpoint-dots",
      type: "circle",
      source: "checkpoints",
      paint: {
        "circle-radius": ["case", ["get", "isKey"], 9, 6],
        "circle-color": [
          "case",
          ["get", "isKey"],
          "#f4ece0",
          meta.colour,
        ],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#0a1410",
      },
    });
  }

  // Checkpoint labels (require glyphs — set in style)
  if (!m.getLayer("checkpoint-labels")) {
    m.addLayer({
      id: "checkpoint-labels",
      type: "symbol",
      source: "checkpoints",
      layout: {
        "text-field": ["get", "name"],
        "text-size": 12,
        "text-offset": [0, 1.6],
        "text-anchor": "top",
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f4ece0",
        "text-halo-color": "#0a1410",
        "text-halo-width": 2,
        "text-halo-blur": 0.5,
      },
    });
  }
}

function updateRouteLayers(
  m: maplibregl.Map,
  route: ParsedRoute,
  meta: RouteMeta,
) {
  (m.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData(
    routeLineGeoJson(route),
  );
  (m.getSource("checkpoints") as maplibregl.GeoJSONSource | undefined)?.setData(
    checkpointsGeoJson(route),
  );
  if (m.getLayer("route-line"))
    m.setPaintProperty("route-line", "line-color", meta.colour);
  if (m.getLayer("checkpoint-halo"))
    m.setPaintProperty("checkpoint-halo", "circle-color", meta.colour);
  if (m.getLayer("checkpoint-dots"))
    m.setPaintProperty(
      "checkpoint-dots",
      "circle-color",
      ["case", ["get", "isKey"], "#f4ece0", meta.colour] as any,
    );
}

function flyToRoute(m: maplibregl.Map, route: ParsedRoute) {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  m.fitBounds(
    [
      [minLon, minLat],
      [maxLon, maxLat],
    ],
    {
      padding: 90,
      pitch: 62,
      bearing: -18,
      duration: 1800,
      maxZoom: 13.5,
    },
  );
}

// ─── GeoJSON builders ─────────────────────────────────────────────────────────

function routeLineGeoJson(route: ParsedRoute): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: route.points.map((p) => [p[0], p[1]] as [number, number]),
        },
      },
    ],
  };
}

function checkpointsGeoJson(route: ParsedRoute): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: route.checkpoints.map((c) => ({
      type: "Feature",
      properties: {
        name: c.name,
        isKey: c.name === "Start" || c.name === "Finish",
      },
      geometry: {
        type: "Point",
        coordinates: [c.lon, c.lat] as [number, number],
      },
    })),
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function centroid(route: ParsedRoute): [number, number] {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

function statusLabel(s: Status): string {
  switch (s) {
    case "booting":
      return "Booting";
    case "style":
      return "Loading imagery";
    case "terrain":
      return "Enabling terrain";
    case "ready":
      return "Ready";
    case "error":
      return "Error";
  }
}
