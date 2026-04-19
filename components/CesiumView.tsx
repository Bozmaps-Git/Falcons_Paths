"use client";

import { useEffect, useRef } from "react";
import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
  active: boolean;
}

export default function CesiumView({ route, meta, active }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (mountedRef.current) return;
    let cancelled = false;

    (async () => {
      // Load pre-built Cesium.js from /public/cesium as a global script the first time
      if (!(window as any).Cesium) {
        (window as any).CESIUM_BASE_URL = "/cesium";
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/cesium/Cesium.js";
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      const Cesium = (window as any).Cesium;
      if (cancelled || !containerRef.current) return;

      // Ion token (optional)
      const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (token) {
        Cesium.Ion.defaultAccessToken = token;
      }

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        // Use Ion world terrain if we have a token, else ellipsoid
        terrain: token ? Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }) : undefined,
      });

      // Remove default imagery, add a better base
      viewer.imageryLayers.removeAll();
      if (token) {
        try {
          const worldImagery = await Cesium.IonImageryProvider.fromAssetId(3);
          viewer.imageryLayers.addImageryProvider(worldImagery);
        } catch {
          viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              credit: "Esri World Imagery",
            })
          );
        }
      } else {
        viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            credit: "Esri World Imagery",
          })
        );
      }

      // Scene style
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.00008;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#0a1410");

      viewerRef.current = viewer;
      mountedRef.current = true;

      drawRoute(Cesium, viewer, route, meta);
      flyToRoute(Cesium, viewer, route);
    })();

    return () => {
      cancelled = true;
    };
  }, [active, route, meta]);

  // Route swap (after mount)
  useEffect(() => {
    if (!viewerRef.current || !mountedRef.current) return;
    (async () => {
      const Cesium = (window as any).Cesium;
      viewerRef.current.entities.removeAll();
      drawRoute(Cesium, viewerRef.current, route, meta);
      flyToRoute(Cesium, viewerRef.current, route);
    })();
  }, [route, meta]);

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        mountedRef.current = false;
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 bg-forest-950" />;
}

function drawRoute(Cesium: any, viewer: any, route: ParsedRoute, meta: RouteMeta) {
  const positions: any[] = [];
  for (const p of route.points) {
    const [lon, lat, ele] = p;
    positions.push(Cesium.Cartesian3.fromDegrees(lon, lat, (ele ?? 0) + 4));
  }
  viewer.entities.add({
    name: meta.label,
    polyline: {
      positions,
      width: 5,
      material: new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.fromCssColorString(meta.colour),
        outlineColor: Cesium.Color.fromCssColorString("#0a1410"),
        outlineWidth: 2,
      }),
      clampToGround: false,
      depthFailMaterial: new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.fromCssColorString(meta.colour).withAlpha(0.6),
      }),
    },
  });

  // Checkpoints
  for (const cp of route.checkpoints) {
    const isStartFinish = cp.name === "Start" || cp.name === "Finish";
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(cp.lon, cp.lat, (cp.ele ?? 0) + 10),
      point: {
        pixelSize: isStartFinish ? 14 : 10,
        color: isStartFinish
          ? Cesium.Color.fromCssColorString("#f4ece0")
          : Cesium.Color.fromCssColorString(meta.colour),
        outlineColor: Cesium.Color.fromCssColorString("#0a1410"),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
      label: {
        text: cp.name,
        font: "12px Instrument Sans, sans-serif",
        fillColor: Cesium.Color.fromCssColorString("#f4ece0"),
        outlineColor: Cesium.Color.fromCssColorString("#0a1410"),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        showBackground: false,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
    });
  }
}

function flyToRoute(Cesium: any, viewer: any, route: ParsedRoute) {
  const { minLon, minLat, maxLon, maxLat } = route.bounds;
  const rect = Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat);
  viewer.camera.flyTo({
    destination: rect,
    orientation: {
      heading: Cesium.Math.toRadians(20),
      pitch: Cesium.Math.toRadians(-45),
      roll: 0,
    },
    duration: 2.2,
  });
}
