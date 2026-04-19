"use client";

import type { RouteKey } from "@/lib/routes";
import { ROUTE_META } from "@/lib/routes";
import type { Basemap, ViewMode } from "@/components/TerrainView";
import { Download } from "lucide-react";

interface Props {
  routeKey: RouteKey;
  onRouteChange: (k: RouteKey) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  basemap: Basemap;
  onBasemapChange: (b: Basemap) => void;
}

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "2d", label: "2D Map" },
  { key: "3d", label: "3D Terrain" },
];

const BASEMAP_OPTIONS: { key: Basemap; label: string }[] = [
  { key: "satellite", label: "Satellite" },
  { key: "osm", label: "Streets" },
  { key: "topo", label: "Topo" },
];

export default function ControlBar({
  routeKey,
  onRouteChange,
  view,
  onViewChange,
  basemap,
  onBasemapChange,
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

      {/* 2D / 3D toggle */}
      <div className="flex items-stretch border border-paper/15">
        {VIEW_OPTIONS.map((v) => {
          const active = v.key === view;
          return (
            <button
              key={v.key}
              onClick={() => onViewChange(v.key)}
              className={`px-3 py-2 font-mono text-[10px] uppercase tracking-wider2 transition ${
                active ? "text-paper bg-paper/5" : "text-paper-dim hover:text-paper"
              }`}
              style={active ? { boxShadow: "inset 0 -2px 0 #e8a55c" } : undefined}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Basemap toggle */}
      <div className="flex items-stretch border border-paper/15">
        {BASEMAP_OPTIONS.map((b) => {
          const active = b.key === basemap;
          return (
            <button
              key={b.key}
              onClick={() => onBasemapChange(b.key)}
              className={`px-3 py-2 font-mono text-[10px] uppercase tracking-wider2 transition ${
                active ? "text-paper bg-paper/5" : "text-paper-dim hover:text-paper"
              }`}
              style={active ? { boxShadow: "inset 0 -2px 0 #e8a55c" } : undefined}
            >
              {b.label}
            </button>
          );
        })}
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
