"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ParsedRoute } from "@/lib/gpx";
import { toGeoJson } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";
import type { Poi, PoiCategory } from "@/lib/osm";
import { POI_CATEGORIES } from "@/lib/osm";

// ─── Basemap catalogue ────────────────────────────────────────────────────────

export type BasemapKey = "terrain" | "satellite" | "streets" | "topo";

function rasterStyle(
  id: string,
  tiles: string[],
  attribution: string,
  maxzoom = 19
): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: { [id]: { type: "raster", tiles, tileSize: 256, attribution, maxzoom } },
    layers: [{ id: "basemap", type: "raster", source: id }],
  };
}

export const BASEMAPS: Record<BasemapKey, { label: string; style: maplibregl.StyleSpecification }> = {
  terrain: {
    label: "Terrain",
    style: rasterStyle(
      "osm-topo",
      [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
      ],
      '© <a href="https://opentopomap.org">OpenTopoMap</a> · © <a href="https://openstreetmap.org">OSM</a>',
      17
    ),
  },
  satellite: {
    label: "Satellite",
    style: rasterStyle(
      "esri",
      ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      "Tiles © Esri"
    ),
  },
  streets: {
    label: "Streets",
    style: rasterStyle(
      "osm-std",
      [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
    ),
  },
  topo: {
    label: "Topographic",
    style: rasterStyle(
      "cyclosm",
      [
        "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        "https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
        "https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
      ],
      '© <a href="https://www.cyclosm.org">CyclOSM</a> · © OSM',
      18
    ),
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
  basemap: BasemapKey;
  pois: Poi[];
  visibleCategories: Set<PoiCategory>;
  hoveredDistanceM: number | null;
}

export default function MapView({
  route,
  meta,
  basemap,
  pois,
  visibleCategories,
  hoveredDistanceM,
}: Props) {
  const divRef  = useRef<HTMLDivElement>(null);
  const mapRef  = useRef<maplibregl.Map | null>(null);
  const popRef  = useRef<maplibregl.Popup | null>(null);
  const roRef   = useRef<ResizeObserver | null>(null);
  const [up, setUp] = useState(false);

  // Always-current prop values for async callbacks
  const liveRoute = useRef(route);   liveRoute.current = route;
  const liveMeta  = useRef(meta);    liveMeta.current  = meta;
  const livePois  = useRef(pois);    livePois.current  = pois;
  const liveVis   = useRef(visibleCategories); liveVis.current = visibleCategories;

  // ── 1. INIT ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const m = new maplibregl.Map({
      container: el,
      style: BASEMAPS[basemap].style,
      center: [
        (route.bounds.minLon + route.bounds.maxLon) / 2,
        (route.bounds.minLat + route.bounds.maxLat) / 2,
      ],
      zoom: 10,
      attributionControl: { compact: true },
      pitchWithRotate: false,
    });

    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    m.addControl(new maplibregl.FullscreenControl(), "top-right");

    // ResizeObserver keeps canvas sized to container at all times
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el);
    requestAnimationFrame(() => m.resize());
    roRef.current = ro;

    m.on("load", () => {
      m.resize();
      setupLayers(m, liveRoute.current, liveMeta.current, livePois.current, liveVis.current);
      fitRoute(m, liveRoute.current.bounds);
      setUp(true);
    });

    // POI click
    m.on("click", "poi-points", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, any>;
      const coords = (f.geometry as any).coordinates as [number, number];
      popRef.current?.remove();
      popRef.current = new maplibregl.Popup({ offset: 12, closeButton: false })
        .setLngLat(coords)
        .setHTML(
          `<div style="min-width:180px">
            <div style="font-family:Fraunces,serif;font-size:16px;color:#f4ece0;margin-bottom:4px">${esc(p.name || "Point of interest")}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${p.colour || "#c8732a"}">${esc(p.type || "poi")}</div>
          </div>`
        )
        .addTo(m);
    });

    // Checkpoint click
    m.on("click", "checkpoint-points", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, any>;
      const coords = (f.geometry as any).coordinates as [number, number];
      popRef.current?.remove();
      popRef.current = new maplibregl.Popup({ offset: 14, closeButton: false })
        .setLngLat(coords)
        .setHTML(
          `<div style="min-width:160px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#e8a55c;margin-bottom:4px">CHECKPOINT</div>
            <div style="font-family:Fraunces,serif;font-size:18px;color:#f4ece0">${esc(p.name)}</div>
            ${p.ele ? `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#d8cfc0;margin-top:6px">${Math.round(Number(p.ele))} m a.s.l.</div>` : ""}
          </div>`
        )
        .addTo(m);
    });

    m.on("mouseenter", "poi-points",        () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", "poi-points",        () => { m.getCanvas().style.cursor = ""; });
    m.on("mouseenter", "checkpoint-points", () => { m.getCanvas().style.cursor = "pointer"; });
    m.on("mouseleave", "checkpoint-points", () => { m.getCanvas().style.cursor = ""; });

    mapRef.current = m;

    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      popRef.current?.remove();
      m.remove();
      mapRef.current = null;
      setUp(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. BASEMAP SWITCH ─────────────────────────────────────────────────────
  const prevBasemap = useRef<BasemapKey>(basemap);
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !up) return;
    if (prevBasemap.current === basemap) return;
    prevBasemap.current = basemap;
    m.setStyle(BASEMAPS[basemap].style);
    m.once("style.load", () => {
      setupLayers(m, liveRoute.current, liveMeta.current, livePois.current, liveVis.current);
    });
  }, [basemap, up]);

  // ── 3. ROUTE / META UPDATE ────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !up) return;
    const apply = () => { syncRoute(m, route, meta); fitRoute(m, route.bounds); };
    m.isStyleLoaded() ? apply() : m.once("style.load", apply);
  }, [route, meta, up]);

  // ── 4. POI UPDATE ─────────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !up) return;
    const apply = () => syncPois(m, pois, visibleCategories);
    m.isStyleLoaded() ? apply() : m.once("style.load", apply);
  }, [pois, visibleCategories, up]);

  // ── 5. ELEVATION HOVER ────────────────────────────────────────────────────
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !up || !m.isStyleLoaded()) return;
    const src = m.getSource("hover-point") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    if (hoveredDistanceM == null) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const idx = bisect(route.cumDistanceM, hoveredDistanceM);
    const [lon, lat, ele] = route.points[idx];
    src.setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { ele: ele ?? 0 },
        geometry: { type: "Point", coordinates: [lon, lat] },
      }],
    });
  }, [hoveredDistanceM, route, up]);

  return <div ref={divRef} className="absolute inset-0" />;
}

// ─── Layer helpers ────────────────────────────────────────────────────────────

function setupLayers(
  m: maplibregl.Map,
  route: ParsedRoute,
  meta: RouteMeta,
  pois: Poi[],
  vis: Set<PoiCategory>
) {
  upsertSource(m, "route",       toGeoJson(route));
  upsertSource(m, "checkpoints", cpGeoJson(route));
  upsertSource(m, "pois",        poiGeoJson(pois, vis));
  upsertSource(m, "hover-point", { type: "FeatureCollection", features: [] });

  addLayer(m, { id: "route-casing", type: "line", source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#0a1410", "line-width": 7, "line-opacity": 0.75 },
  });
  addLayer(m, { id: "route-line", type: "line", source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": meta.colour, "line-width": 3.5 },
  });
  addLayer(m, { id: "poi-points", type: "circle", source: "pois",
    paint: {
      "circle-radius": 5,
      "circle-color": ["get", "colour"],
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#0a1410",
      "circle-opacity": 0.9,
    },
  }, "checkpoint-halo");
  addLayer(m, { id: "checkpoint-halo", type: "circle", source: "checkpoints",
    paint: { "circle-radius": 14, "circle-color": meta.colour, "circle-opacity": 0.18 },
  });
  addLayer(m, { id: "checkpoint-points", type: "circle", source: "checkpoints",
    paint: {
      "circle-radius": ["case", ["get", "isStartFinish"], 9, 6],
      "circle-color": ["case", ["get", "isStartFinish"], "#f4ece0", meta.colour],
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#0a1410",
    },
  });
  addLayer(m, { id: "checkpoint-labels", type: "symbol", source: "checkpoints",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 11,
      "text-offset": [0, 1.4],
      "text-anchor": "top",
      "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
      "text-allow-overlap": false,
    },
    paint: { "text-color": "#f4ece0", "text-halo-color": "#0a1410", "text-halo-width": 2 },
  });
  addLayer(m, { id: "hover-outer", type: "circle", source: "hover-point",
    paint: { "circle-radius": 14, "circle-color": "#f4ece0", "circle-opacity": 0.25 },
  });
  addLayer(m, { id: "hover-inner", type: "circle", source: "hover-point",
    paint: { "circle-radius": 6, "circle-color": "#f4ece0", "circle-stroke-width": 2, "circle-stroke-color": "#0a1410" },
  });
}

function syncRoute(m: maplibregl.Map, route: ParsedRoute, meta: RouteMeta) {
  (m.getSource("route") as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJson(route));
  (m.getSource("checkpoints") as maplibregl.GeoJSONSource | undefined)?.setData(cpGeoJson(route));
  if (m.getLayer("route-line"))
    m.setPaintProperty("route-line", "line-color", meta.colour);
  if (m.getLayer("checkpoint-halo"))
    m.setPaintProperty("checkpoint-halo", "circle-color", meta.colour);
  if (m.getLayer("checkpoint-points"))
    m.setPaintProperty("checkpoint-points", "circle-color",
      ["case", ["get", "isStartFinish"], "#f4ece0", meta.colour] as any);
}

function syncPois(m: maplibregl.Map, pois: Poi[], vis: Set<PoiCategory>) {
  (m.getSource("pois") as maplibregl.GeoJSONSource | undefined)?.setData(poiGeoJson(pois, vis));
}

function fitRoute(m: maplibregl.Map, bounds: ParsedRoute["bounds"]) {
  m.fitBounds(
    [[bounds.minLon, bounds.minLat], [bounds.maxLon, bounds.maxLat]],
    { padding: 60, duration: 900, maxZoom: 15 }
  );
}

// ─── GeoJSON builders ─────────────────────────────────────────────────────────

function cpGeoJson(route: ParsedRoute) {
  return {
    type: "FeatureCollection" as const,
    features: route.checkpoints.map((c) => ({
      type: "Feature" as const,
      properties: { name: c.name, km: c.km, ele: c.ele, isStartFinish: c.name === "Start" || c.name === "Finish" },
      geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
    })),
  };
}

function poiGeoJson(pois: Poi[], vis: Set<PoiCategory>) {
  return {
    type: "FeatureCollection" as const,
    features: pois.flatMap((p) => {
      const cat = guessCategory(p);
      if (cat && !vis.has(cat)) return [];
      return [{
        type: "Feature" as const,
        properties: { name: p.name, type: p.type, colour: cat ? POI_CATEGORIES[cat].color : "#888", category: cat ?? "" },
        geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      }];
    }),
  };
}

// ─── MapLibre utilities ───────────────────────────────────────────────────────

function upsertSource(m: maplibregl.Map, id: string, data: object) {
  const src = m.getSource(id) as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(data as any);
  else m.addSource(id, { type: "geojson", data: data as any });
}

function addLayer(m: maplibregl.Map, spec: maplibregl.LayerSpecification, beforeId?: string) {
  if (m.getLayer(spec.id)) return;
  const before = beforeId && m.getLayer(beforeId) ? beforeId : undefined;
  m.addLayer(spec as any, before);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function bisect(arr: number[], val: number): number {
  let lo = 0, hi = arr.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < val) lo = mid + 1; else hi = mid; }
  return lo;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function guessCategory(p: Poi): PoiCategory | null {
  const { tags, type } = p;
  if (tags.amenity === "drinking_water" || ["cafe", "restaurant", "pub", "fast_food"].includes(tags.amenity ?? "")) return "water";
  if (["hotel", "guest_house", "hostel", "chalet", "camp_site"].includes(tags.tourism ?? "")) return "accommodation";
  if (tags.tourism === "viewpoint" || tags.tourism === "picnic_site" || tags.natural) return "viewpoint";
  if (["hospital", "pharmacy", "doctors", "clinic"].includes(tags.amenity ?? "")) return "medical";
  if (tags.amenity === "fuel" || tags.amenity === "atm" || tags.amenity === "bank" || tags.shop === "bicycle" || tags.shop === "supermarket") return "services";
  if (tags.historic || tags.tourism === "museum" || tags.tourism === "attraction" || tags.amenity === "place_of_worship") return "culture";
  if (type.startsWith("shop")) return "services";
  return null;
}
