"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StatsStrip from "@/components/StatsStrip";
import ElevationChart from "@/components/ElevationChart";
import { ROUTE_META, type RouteKey, type RoutesBundle, loadRoutes } from "@/lib/routes";

export default function Page() {
  const [routes, setRoutes] = useState<RoutesBundle | null>(null);
  const [routeKey, setRouteKey] = useState<RouteKey>("velika");
  const [, setHoveredDistance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRoutes()
      .then((r) => !cancelled && setRoutes(r))
      .catch((e) => console.error("Failed to load routes", e));
    return () => {
      cancelled = true;
    };
  }, []);

  const currentRoute = routes?.[routeKey];
  const meta = ROUTE_META[routeKey];

  if (!currentRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-mono text-[11px] uppercase tracking-wider3 text-paper-dim animate-pulse">
          Loading routes · Putevi Sokola 2026
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <Header />

      {/* ROUTES */}
      <section id="routes" className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.keys(ROUTE_META) as RouteKey[]).map((k) => {
            const m = ROUTE_META[k];
            const r = routes![k];
            const active = k === routeKey;
            return (
              <button
                key={k}
                onClick={() => setRouteKey(k)}
                className={`group relative overflow-hidden border text-left transition ${
                  active ? "border-paper/30 bg-forest-800" : "border-paper/10 bg-forest-900/40 hover:bg-forest-800/60"
                }`}
                style={active ? { boxShadow: `inset 4px 0 0 ${m.colour}` } : undefined}
              >
                <div className="absolute top-0 right-0 font-display text-[140px] leading-none text-paper/5 -mt-6 -mr-4 pointer-events-none">
                  {r.stats.totalDistanceKm.toFixed(0)}
                </div>
                <div className="relative p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-2 w-2" style={{ background: m.colour }} />
                    <div className="font-mono text-[10px] uppercase tracking-wider3" style={{ color: m.accent }}>
                      {m.difficulty}
                    </div>
                  </div>
                  <h2 className="font-display text-4xl text-paper">
                    {m.label}
                  </h2>
                  <div className="mt-1 font-display italic text-paper-dim">{m.subtitle}</div>
                  <div className="mt-6 grid grid-cols-3 gap-4 tnum">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">Distance</div>
                      <div className="mt-1 font-display text-2xl text-paper">{r.stats.totalDistanceKm.toFixed(1)}<span className="text-sm text-paper-dim"> km</span></div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">Climb</div>
                      <div className="mt-1 font-display text-2xl text-paper">{Math.round(r.stats.elevationGainM).toLocaleString()}<span className="text-sm text-paper-dim"> m</span></div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">Peak</div>
                      <div className="mt-1 font-display text-2xl text-paper">{Math.round(r.stats.maxElevationM).toLocaleString()}<span className="text-sm text-paper-dim"> m</span></div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-[1600px] px-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider3 text-amber-light">Live Analysis</div>
          <div className="font-mono text-[10px] uppercase tracking-wider2 text-paper-dim">
            {meta.label} · {meta.subtitle}
          </div>
        </div>
        <StatsStrip route={currentRoute} meta={meta} />
      </section>

      {/* ELEVATION */}
      <section id="profile" className="mx-auto mt-10 max-w-[1600px] px-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider3 text-amber-light">Layer 01 · Elevation</div>
          <div className="font-mono text-[10px] uppercase tracking-wider2 text-paper-dim">Hover to scrub along the route</div>
        </div>
        <div className="border border-paper/10 bg-forest-900/40 p-6">
          <div className="mb-4 flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display text-3xl text-paper">Elevation Profile</h3>
              <div className="font-mono text-[10px] uppercase tracking-wider2 text-paper-dim mt-1">
                {meta.label} · {currentRoute.stats.totalDistanceKm.toFixed(1)} km · ↑ {Math.round(currentRoute.stats.elevationGainM).toLocaleString()} m
              </div>
            </div>
            <div className="flex gap-6 tnum">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">Range</div>
                <div className="font-display text-xl text-paper mt-1">{Math.round(currentRoute.stats.minElevationM)} – {Math.round(currentRoute.stats.maxElevationM)} m</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">Relief</div>
                <div className="font-display text-xl text-paper mt-1">{Math.round(currentRoute.stats.maxElevationM - currentRoute.stats.minElevationM)} m</div>
              </div>
            </div>
          </div>
          <div className="h-[280px] md:h-[320px]">
            <ElevationChart route={currentRoute} meta={meta} onHover={setHoveredDistance} />
          </div>
        </div>
      </section>

      {/* CHECKPOINTS */}
      <section className="mx-auto mt-10 max-w-[1600px] px-6 mb-16">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-wider3 text-amber-light">Layer 02 · Checkpoints</div>
        </div>
        <div className="border border-paper/10 bg-forest-900/40 p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentRoute.checkpoints.map((cp, i) => (
              <div key={i} className="border border-paper/10 bg-forest-900/70 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1.5 w-1.5" style={{ background: cp.name === "Start" || cp.name === "Finish" ? "#f4ece0" : meta.colour }} />
                  <div className="font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">{cp.km === 0 ? "km 0" : `km ${cp.km}`}</div>
                </div>
                <div className="font-display text-lg text-paper">{cp.name}</div>
                {cp.ele != null && (
                  <div className="mt-1 font-mono text-[10px] text-paper-dim tnum">{Math.round(cp.ele)} m a.s.l.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
