"use client";

import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
}

interface Stat {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}

export default function StatsStrip({ route, meta }: Props) {
  const gradient = computeAvgGradient(route);
  const stats: Stat[] = [
    {
      label: "Distance",
      value: route.stats.totalDistanceKm.toFixed(1),
      unit: "km",
      hint: `${route.stats.pointCount.toLocaleString()} trackpoints`,
    },
    {
      label: "Elevation Gain",
      value: Math.round(route.stats.elevationGainM).toLocaleString(),
      unit: "m",
      hint: `↑ ${Math.round(route.stats.elevationLossM).toLocaleString()} m descent`,
    },
    {
      label: "Max Altitude",
      value: Math.round(route.stats.maxElevationM).toLocaleString(),
      unit: "m",
      hint: `Min ${Math.round(route.stats.minElevationM)} m`,
    },
    {
      label: "Checkpoints",
      value: String(route.checkpoints.length),
      hint: `Every ${route.checkpoints.length > 2 ? "10 km" : "—"}`,
    },
    {
      label: "Avg Gradient",
      value: gradient.toFixed(1),
      unit: "%",
      hint: "Climbing sections",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-paper/10 border-y border-paper/10 bg-forest-900/40">
      {stats.map((s, i) => (
        <div key={i} className="px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-wider2 text-paper-dim">{s.label}</div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <div className="font-display text-3xl text-paper tnum" style={{ color: i === 1 ? meta.colour : undefined }}>
              {s.value}
            </div>
            {s.unit && <div className="font-mono text-xs text-paper-dim">{s.unit}</div>}
          </div>
          {s.hint && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-paper-dark tnum">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}

function computeAvgGradient(route: ParsedRoute): number {
  // Average gradient on climbing sections only
  const pts = route.points;
  const cum = route.cumDistanceM;
  let climbDist = 0;
  let climbGain = 0;
  for (let i = 1; i < pts.length; i++) {
    const de = (pts[i][2] ?? 0) - (pts[i - 1][2] ?? 0);
    const dd = cum[i] - cum[i - 1];
    if (de > 0 && dd > 0) {
      climbGain += de;
      climbDist += dd;
    }
  }
  return climbDist > 0 ? (climbGain / climbDist) * 100 : 0;
}
