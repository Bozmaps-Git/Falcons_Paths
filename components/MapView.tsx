"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ParsedRoute } from "@/lib/gpx";
import { toGeoJson } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";
import type { Poi, PoiCategory } from "@/lib/osm";
import { POI_CATEGORIES } from "@/lib/osm";

export type BasemapKey = "terrain" | "satellite" | "streets" | "topo";

export const BASEMAPS: Record<BasemapKey, { label: string; style: maplibregl.StyleSpecification }> = {
  terrain: {
    label: "Terrain",
    style: {
      version: 8,
      sources: {
        "osm-terrain": {
          type: "raster",
          tiles: [
            "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
            "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> · © <a href="https://openstreetmap.org">OSM</a>',
          maxzoom: 17,
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "osm-terrain" }],
    },
  },
  satellite: {
    label: "Satellite",
    style: {
      version: 8,
      sources: {
        esri: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
          maxzoom: 19,
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "esri" }],
    },
  },
  streets: {
    label: "Streets",
    style: {
      version: 8,
      sources: {
        "osm-std": {
          type: "raster",
          tiles: [
            "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
            "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          maxzoom: 19,
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "osm-std" }],
    },
  },
  topo: {
    label: "Topographic",
    style: {
      version: 8,
      sources: {
        cyclosm: {
          type: "raster",
          tiles: [
            "https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
            "https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
            "https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
          ],
          tileSize: 256,
          attribution: '© <a href="https://www.cyclosm.org">CyclOSM</a> · © OSM',
          maxzoom: 18,
        },
      },
      layers: [{ id: "basemap", type: "raster", source: "cyclosm" }],
    },
  },
};

interface MapViewProps {
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
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [ready, setReady] = useState(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[basemap].style,
      center: [(route.bounds.minLon + route.bounds.maxLon) / 2, (route.bounds.minLat + route.bounds.maxLat) / 2],
      zoom: 11,
      pitch: 0,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");

    map.on("load", () => {
      setReady(true);
      fitToRoute(map, route);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap switch: swap style, then re-add layers after style loads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(BASEMAPS[basemap].style);
    map.once("style.load", () => {
      addRouteLayers(map, route, meta);
      addCheckpointLayer(map, route, meta);
      addPoiLayer(map, pois, visibleCategories);
      addHoverMarker(map);
    });
  }, [basemap, ready, route, meta]);

  // Route change: re-fit & re-draw
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // If style already loaded, just update source data
    if (map.isStyleLoaded()) {
      updateRouteData(map, route, meta);
      fitToRoute(map, route);
    }
  }, [route, meta, ready]);

  // POI updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    addPoiLayer(map, pois, visibleCategories);
  }, [pois, visibleCategories, ready]);

  // Elevation chart hover → map pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.isStyleLoaded()) return;
    const src = map.getSource("hover-point") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (hoveredDistanceM == null) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    // Find point by distance
    const idx = nearestIndex(route.cumDistanceM, hoveredDistanceM);
    const p = route.points[idx];
    src.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { ele: p[2] ?? 0, km: (hoveredDistanceM / 1000).toFixed(2) },
          geometry: { type: "Point", coordinates: [p[0], p[1]] },
        },
      ],
    });
  }, [hoveredDistanceM, route, ready]);

  // Initial layer attach after first style load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.isStyleLoaded()) {
      addRouteLayers(map, route, meta);
      addCheckpointLayer(map, route, meta);
      addPoiLayer(map, pois, visibleCategories);
      addHoverMarker(map);
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // POI click popups
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties as any;
      const coords = (f.geometry as any).coordinates.slice();
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ offset: 12, closeButton: false })
        .setLngLat(coords)
        .setHTML(
          `<div style="min-width:180px">
            <div style="font-family:Fraunces,serif;font-size:16px;color:#f4ece0;margin-bottom:4px">${escapeHtml(props.name || "Point of interest")}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${props.colour || "#c8732a"}">${escapeHtml(props.type || "poi")}</div>
          </div>`
        )
        .addTo(map);
    };

    const onCheckpointClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = f.properties as any;
      const coords = (f.geometry as any).coordinates.slice();
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: false })
        .setLngLat(coords)
        .setHTML(
          `<div style="min-width:160px">
            <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#e8a55c;margin-bottom:4px">CHECKPOINT</div>
            <div style="font-family:Fraunces,serif;font-size:18px;color:#f4ece0">${escapeHtml(props.name)}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#d8cfc0;margin-top:6px">${props.ele ? `${Math.round(props.ele)} m elevation` : ""}</div>
          </div>`
        )
        .addTo(map);
    };

    map.on("click", "poi-points", onClick);
    map.on("click", "checkpoint-points", onCheckpointClick);
    map.on("mouseenter", "poi-points", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "poi-points", () => (map.getCanvas().style.cursor = ""));
    map.on("mouseenter", "checkpoint-points", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "checkpoint-points", () => (map.getCanvas().style.cursor = ""));

    return () => {
      map.off("click", "poi-points", onClick);
      map.off("click", "checkpoint-points", onCheckpointClick);
    };
  }, [ready]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function fitToRoute(map: MapLibreMap, route: ParsedRoute) {
  map.fitBounds(
    [
      [route.bounds.minLon, route.bounds.minLat],
      [route.bounds.maxLon, route.bounds.maxLat],
    ],
    { padding: 60, duration: 900 }
  );
}

function addRouteLayers(map: MapLibreMap, route: ParsedRoute, meta: RouteMeta) {
  const srcId = "route";
  const geo = toGeoJson(route);
  if (map.getSource(srcId)) {
    (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(geo);
  } else {
    map.addSource(srcId, { type: "geojson", data: geo });
  }
  // Glow / casing
  if (!map.getLayer("route-casing")) {
    map.addLayer({
      id: "route-casing",
      type: "line",
      source: srcId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": "#0a1410",
        "line-width": 7,
        "line-opacity": 0.7,
      },
    });
  }
  if (!map.getLayer("route-line")) {
    map.addLayer({
      id: "route-line",
      type: "line",
      source: srcId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": meta.colour,
        "line-width": 3.5,
      },
    });
  } else {
    map.setPaintProperty("route-line", "line-color", meta.colour);
  }
}

function updateRouteData(map: MapLibreMap, route: ParsedRoute, meta: RouteMeta) {
  const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
  if (src) src.setData(toGeoJson(route));
  if (map.getLayer("route-line")) map.setPaintProperty("route-line", "line-color", meta.colour);
  // Checkpoints
  const cpSrc = map.getSource("checkpoints") as maplibregl.GeoJSONSource | undefined;
  if (cpSrc) cpSrc.setData(checkpointGeoJson(route));
}

function checkpointGeoJson(route: ParsedRoute) {
  return {
    type: "FeatureCollection" as const,
    features: route.checkpoints.map((c) => ({
      type: "Feature" as const,
      properties: { name: c.name, km: c.km, ele: c.ele, isStartFinish: c.name === "Start" || c.name === "Finish" },
      geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
    })),
  };
}

function addCheckpointLayer(map: MapLibreMap, route: ParsedRoute, meta: RouteMeta) {
  const srcId = "checkpoints";
  const geo = checkpointGeoJson(route);
  if (map.getSource(srcId)) {
    (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(geo);
  } else {
    map.addSource(srcId, { type: "geojson", data: geo });
  }
  if (!map.getLayer("checkpoint-halo")) {
    map.addLayer({
      id: "checkpoint-halo",
      type: "circle",
      source: srcId,
      paint: {
        "circle-radius": 14,
        "circle-color": meta.colour,
        "circle-opacity": 0.18,
        "circle-stroke-width": 0,
      },
    });
  }
  if (!map.getLayer("checkpoint-points")) {
    map.addLayer({
      id: "checkpoint-points",
      type: "circle",
      source: srcId,
      paint: {
        "circle-radius": ["case", ["get", "isStartFinish"], 9, 6],
        "circle-color": ["case", ["get", "isStartFinish"], "#f4ece0", meta.colour],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#0a1410",
      },
    });
  } else {
    map.setPaintProperty("checkpoint-halo", "circle-color", meta.colour);
    map.setPaintProperty("checkpoint-points", "circle-color", [
      "case",
      ["get", "isStartFinish"],
      "#f4ece0",
      meta.colour,
    ] as any);
  }
  if (!map.getLayer("checkpoint-labels")) {
    map.addLayer({
      id: "checkpoint-labels",
      type: "symbol",
      source: srcId,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-offset": [0, 1.4],
        "text-anchor": "top",
        "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#f4ece0",
        "text-halo-color": "#0a1410",
        "text-halo-width": 2,
      },
    });
  }
}

function addPoiLayer(map: MapLibreMap, pois: Poi[], visibleCategories: Set<PoiCategory>) {
  const srcId = "pois";
  // Tag POIs with category colour
  const poisWithMeta = pois.map((p) => {
    const cat = guessCategory(p);
    return { ...p, _category: cat, _colour: cat ? POI_CATEGORIES[cat].color : "#888" };
  });
  const filtered = poisWithMeta.filter((p) => !p._category || visibleCategories.has(p._category));

  const geo = {
    type: "FeatureCollection" as const,
    features: filtered.map((p) => ({
      type: "Feature" as const,
      properties: {
        name: p.name,
        type: p.type,
        colour: p._colour,
        category: p._category,
      },
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
    })),
  };

  if (map.getSource(srcId)) {
    (map.getSource(srcId) as maplibregl.GeoJSONSource).setData(geo);
  } else {
    map.addSource(srcId, { type: "geojson", data: geo });
  }
  if (!map.getLayer("poi-points")) {
    map.addLayer(
      {
        id: "poi-points",
        type: "circle",
        source: srcId,
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "colour"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0a1410",
          "circle-opacity": 0.95,
        },
      },
      map.getLayer("checkpoint-halo") ? "checkpoint-halo" : undefined
    );
  }
}

function guessCategory(p: Poi): PoiCategory | null {
  const { tags, type } = p;
  if (tags.amenity === "drinking_water" || ["cafe", "restaurant", "pub", "fast_food"].includes(tags.amenity || "")) return "water";
  if (["hotel", "guest_house", "hostel", "chalet", "camp_site"].includes(tags.tourism || "")) return "accommodation";
  if (tags.tourism === "viewpoint" || tags.tourism === "picnic_site" || tags.natural) return "viewpoint";
  if (["hospital", "pharmacy", "doctors", "clinic"].includes(tags.amenity || "")) return "medical";
  if (tags.amenity === "fuel" || tags.amenity === "atm" || tags.amenity === "bank" || tags.shop === "bicycle" || tags.shop === "supermarket") return "services";
  if (tags.historic || tags.tourism === "museum" || tags.tourism === "attraction" || tags.amenity === "place_of_worship") return "culture";
  if (type.startsWith("shop")) return "services";
  return null;
}

function addHoverMarker(map: MapLibreMap) {
  if (!map.getSource("hover-point")) {
    map.addSource("hover-point", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  }
  if (!map.getLayer("hover-point-outer")) {
    map.addLayer({
      id: "hover-point-outer",
      type: "circle",
      source: "hover-point",
      paint: {
        "circle-radius": 14,
        "circle-color": "#f4ece0",
        "circle-opacity": 0.25,
      },
    });
  }
  if (!map.getLayer("hover-point-inner")) {
    map.addLayer({
      id: "hover-point-inner",
      type: "circle",
      source: "hover-point",
      paint: {
        "circle-radius": 6,
        "circle-color": "#f4ece0",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#0a1410",
      },
    });
  }
}

function nearestIndex(cum: number[], target: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
