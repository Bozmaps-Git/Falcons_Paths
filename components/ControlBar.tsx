"use client";

import type { RouteKey, RouteMeta } from "@/lib/routes";
import { ROUTE_META } from "@/lib/routes";
import type { BasemapKey } from "./MapView";
import { BASEMAPS } from "./MapView";
import { Download, Box, Map as MapIcon } from "lucide-react";

interface Props {
  routeKey: RouteKey;
  onRouteChange: (k: RouteKey) => void;
  basemap: BasemapKey;
  onBasemapChange: (b: BasemapKey) => void;
  view: "2d" | "3d";
  onViewChange: (v: "2d" | "3d") => void;
}

export default function ControlBar({
  routeKey,
  onRouteChange,
  basemap,
  onBasemapChange,
  view,
  onViewChange,
}: Props) {
  const meta = ROUTE_META[routeKey];

  const gpxFiles: Record<RouteKey, string> = {
    velika: "/data/MTB_MARATON_PUTEVI_SOKOLA_-_VELIKA_STAZA_2026.gpx",
    mala: "/data/MTB_MARATON_PUTEVI_SOKOLA_2026_-_MALA_STAZA.gpx",
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-paper/10 bg-forest-900/70 backdrop-blur px-4 py-3">
      {/* Route selector */}
      <div className="flex items-stretch border border-paper/15">
        {(Object.keys(ROUTE_META) as RouteKey[]).map((k) => {
          const m = ROUTE_META[k];
          const active = k === routeKey;
          return (
            <button
              key={k}
              onClick={() => onRouteChange(k)}
              className={`relative px-4 py-2 text-left transition ${active ? "bg-paper/5" : "hover:bg-paper/3"}`}
              style={active ? { boxShadow: `inset 0 -2px 0 ${m.colour}` } : undefined}
            >
              <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">{m.difficulty}</div>
              <div className="font-display text-sm text-paper">{m.label}</div>
            </button>
          );
        })}
      </div>

      <div className="h-6 w-px bg-paper/15 hidden md:block" />

      {/* Basemap */}
      <div className="flex items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim mr-2 hidden sm:inline">Basemap</span>
        <div className={`flex border border-paper/15 ${view === "3d" ? "opacity-40 pointer-events-none" : ""}`} title={view === "3d" ? "Basemap locked in 3D view" : undefined}>
          {(Object.keys(BASEMAPS) as BasemapKey[]).map((k) => (
            <button
              key={k}
              onClick={() => onBasemapChange(k)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
                basemap === k ? "bg-paper/8 text-paper" : "text-paper-dim hover:bg-paper/3"
              }`}
            >
              {BASEMAPS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-paper/15 hidden md:block" />

      {/* 2D / 3D toggle */}
      <div className="flex border border-paper/15">
        <button
          onClick={() => onViewChange("2d")}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider2 transition ${
            view === "2d" ? "bg-paper/8 text-paper" : "text-paper-dim hover:bg-paper/3"
          }`}
        >
          <MapIcon size={12} strokeWidth={1.8} />
          2D
        </button>
        <button
          onClick={() => onViewChange("3d")}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider2 transition ${
            view === "3d" ? "bg-paper/8 text-paper" : "text-paper-dim hover:bg-paper/3"
          }`}
        >
          <Box size={12} strokeWidth={1.8} />
          3D
        </button>
      </div>

      <div className="ml-auto">
        <a
          href={gpxFiles[routeKey]}
          download
          className="flex items-center gap-1.5 border border-amber/40 bg-amber/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider2 text-amber-light transition hover:bg-amber/20"
        >
          <Download size={12} strokeWidth={1.8} />
          GPX · {meta.label}
        </a>
      </div>
    </div>
  );
}
