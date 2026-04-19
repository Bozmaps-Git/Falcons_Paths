"use client";

export default function Footer() {
  return (
    <footer className="border-t border-paper/10 bg-forest-950 px-6 py-10">
      <div className="mx-auto max-w-[1600px] flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="font-display text-2xl text-paper">Falcon's Paths</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-wider2 text-paper-dim">
            MTB Marathon · Bajina Bašta · Serbia
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 font-mono text-[11px] uppercase tracking-wider text-paper-dim">
          <div>
            <div className="mb-2 text-paper">Race</div>
            <a href="http://putevisokola.rs/en/falcons-paths-mtb-marathon/" target="_blank" rel="noreferrer" className="block hover:text-paper">Official site ↗</a>
            <a href="https://runtrace.net/?event=putevisokola2025" target="_blank" rel="noreferrer" className="block hover:text-paper">Results (2025) ↗</a>
          </div>
          <div>
            <div className="mb-2 text-paper">Data</div>
            <div>GPX · RideWithGPS</div>
            <div>POIs · OpenStreetMap</div>
            <div>Terrain · Cesium Ion</div>
          </div>
          <div>
            <div className="mb-2 text-paper">Built by</div>
            <a href="https://bozmaps.vercel.app/" target="_blank" rel="noreferrer" className="block hover:text-paper">Bozmaps ↗</a>
            <div>Geospatial · UK & Balkans</div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-[1600px] border-t border-paper/10 pt-6 font-mono text-[10px] uppercase tracking-wider text-paper-dark flex justify-between flex-wrap gap-3">
        <div>© 2026 · open data</div>
        <div>44.30°N · 19.48°E · wgs84</div>
      </div>
    </footer>
  );
}
