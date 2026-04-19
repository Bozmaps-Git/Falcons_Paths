"use client";

import { useEffect, useRef } from "react";
import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
  active: boolean;
}

// Script load is a one-time global operation — track it outside the component
let cesiumLoadPromise: Promise<void> | null = null;

function loadCesium(): Promise<void> {
  if ((window as any).Cesium) return Promise.resolve();
  if (cesiumLoadPromise) return cesiumLoadPromise;

  cesiumLoadPromise = new Promise<void>((resolve, reject) => {
    (window as any).CESIUM_BASE_URL = "/cesium";
    const s = document.createElement("script");
    s.src = "/cesium/Cesium.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load /cesium/Cesium.js"));
    document.head.appendChild(s);
  });

  return cesiumLoadPromise;
}

export default function CesiumView({ route, meta, active }: Props) {
  const divRef    = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const roRef     = useRef<ResizeObserver | null>(null);
  const initRef   = useRef(false); // prevent double-init in StrictMode

  // ── INIT / ACTIVATE ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!active || initRef.current) return;
    initRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        await loadCesium();
      } catch (err) {
        console.error("[CesiumView] Failed to load Cesium:", err);
        return;
      }

      if (cancelled || !divRef.current) return;

      const Cesium = (window as any).Cesium;

      const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (token) Cesium.Ion.defaultAccessToken = token;

      const viewer = new Cesium.Viewer(divRef.current, {
        animation:             false,
        timeline:              false,
        geocoder:              false,
        homeButton:            false,
        sceneModePicker:       false,
        baseLayerPicker:       false,
        navigationHelpButton:  false,
        fullscreenButton:      false,
        infoBox:               false,
        selectionIndicator:    false,
        terrain: token
          ? Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true })
          : undefined,
      });

      // Imagery
      viewer.imageryLayers.removeAll();
      if (token) {
        try {
          viewer.imageryLayers.addImageryProvider(
            await Cesium.IonImageryProvider.fromAssetId(3)
          );
        } catch {
          addEsriImagery(Cesium, viewer);
        }
      } else {
        addEsriImagery(Cesium, viewer);
      }

      // Scene aesthetics
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled  = true;
      viewer.scene.fog.density  = 0.00008;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0a1410");

      viewerRef.current = viewer;

      // ResizeObserver → always fills its container
      const ro = new ResizeObserver(() => {
        if (!viewer.isDestroyed()) viewer.resize();
      });
      ro.observe(divRef.current);
      roRef.current = ro;

      // Force two paint-cycle resizes in case CSS layout hadn't settled yet
      requestAnimationFrame(() => {
        if (!viewer.isDestroyed()) viewer.resize();
        requestAnimationFrame(() => { if (!viewer.isDestroyed()) viewer.resize(); });
      });

      drawRoute(Cesium, viewer, route, meta);
      flyTo(Cesium, viewer, route);
    })();

    return () => { cancelled = true; };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ROUTE / META SWAP (after init) ────────────────────────────────────────
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || v.isDestroyed()) return;
    const Cesium = (window as any).Cesium;
    if (!Cesium) return;
    v.entities.removeAll();
    drawRoute(Cesium, v, route, meta);
    flyTo(Cesium, v, route);
  }, [route, meta]);

  // ── TEARDOWN ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      initRef.current = false;
    };
  }, []);

  return <div ref={divRef} className="absolute inset-0 bg-forest-950" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addEsriImagery(Cesium: any, viewer: any) {
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      credit: "Esri World Imagery",
    })
  );
}

function drawRoute(Cesium: any, viewer: any, route: ParsedRoute, meta: RouteMeta) {
  // Route polyline
  const positions = route.points.map(([lon, lat, ele]) =>
    Cesium.Cartesian3.fromDegrees(lon, lat, (ele ?? 0) + 4)
  );

  viewer.entities.add({
    name: meta.label,
    polyline: {
      positions,
      width: 5,
      material: new Cesium.PolylineOutlineMaterialProperty({
        color:        Cesium.Color.fromCssColorString(meta.colour),
        outlineColor: Cesium.Color.fromCssColorString("#0a1410"),
        outlineWidth: 2,
      }),
      clampToGround: false,
      depthFailMaterial: new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.fromCssColorString(meta.colour).withAlpha(0.55),
      }),
    },
  });

  // Checkpoints
  for (const cp of route.checkpoints) {
    const isKey = cp.name === "Start" || cp.name === "Finish";
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, (cp.ele ?? 0) + 12),
      point: {
        pixelSize:       isKey ? 14 : 9,
        color:           isKey ? Cesium.Color.fromCssColorString("#f4ece0") : Cesium.Color.fromCssColorString(meta.colour),
        outlineColor:    Cesium.Color.fromCssColorString("#0a1410"),
        outlineWidth:    2,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
      label: {
        text:            cp.name,
        font:            "12px sans-serif",
        fillColor:       Cesium.Color.fromCssColorString("#f4ece0"),
        outlineColor:    Cesium.Color.fromCssColorString("#0a1410"),
        outlineWidth:    3,
        style:           Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset:     new Cesium.Cartesian2(0, -24),
        showBackground:  false,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
    });
  }
}

function flyTo(Cesium: any, viewer: any, route: ParsedRoute) {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
    orientation: {
      heading: Cesium.Math.toRadians(15),
      pitch:   Cesium.Math.toRadians(-40),
      roll:    0,
    },
    duration: 2.0,
  });
}
