"use client";

import type { RouteKey } from "@/lib/routes";
import { ROUTE_META } from "@/lib/routes";
import { Download, Box } from "lucide-react";

interface Props {
  routeKey: RouteKey;
  onRouteChange: (k: RouteKey) => void;
}

export default function ControlBar({ routeKey, onRouteChange }: Props) {
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

      {/* View mode indicator (3D only for now) */}
      <div className="flex items-center gap-1.5 border border-paper/15 px-3 py-1.5">
        <Box size={12} strokeWidth={1.8} className="text-amber-light" />
        <span className="font-mono text-[10px] uppercase tracking-wider2 text-paper">3D Terrain</span>
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
