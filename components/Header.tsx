"use client";

import { Feather } from "lucide-react";

export default function Header() {
  return (
    <header className="relative overflow-hidden border-b border-paper/10">
      {/* Contour decorative background */}
      <div
        className="absolute inset-0 opacity-60"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(200, 115, 42, 0.12), transparent 70%), repeating-radial-gradient(circle at 30% 40%, transparent 0, transparent 42px, rgba(244, 236, 224, 0.025) 42px, rgba(244, 236, 224, 0.025) 43px)",
        }}
      />
      <div className="relative mx-auto max-w-[1600px] px-6 py-10 md:py-14">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center border border-amber/40 bg-amber/10 text-amber-light">
              <Feather size={18} strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider3 text-amber-light">
                Putevi Sokola · Bajina Bašta · Mt. Tara
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">
                10th edition · 2026
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-wider2 text-paper-dim">
            <a href="#routes" className="hover:text-paper transition">Routes</a>
            <a href="#map" className="hover:text-paper transition">Map</a>
            <a href="#profile" className="hover:text-paper transition">Profile</a>
            <a
              href="http://putevisokola.rs/en/falcons-paths-mtb-marathon/"
              target="_blank"
              rel="noreferrer"
              className="border border-paper/20 px-3 py-1.5 hover:bg-paper/5 hover:text-paper transition"
            >
              Official Site ↗
            </a>
          </nav>
        </div>

        <div className="mt-10 md:mt-14 max-w-5xl">
          <h1 className="font-display text-[11vw] md:text-[100px] leading-[0.92] tracking-tight text-paper">
            <span className="italic font-light">Falcon's</span>
            <br />
            <span className="text-amber-light">Paths.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg md:text-xl leading-snug text-paper-dim font-light">
            Two routes trace the limestone ridges above the Drina, climbing from river's edge
            to the eagle-haunted heights of Mount Tara. Ride them. Or follow every metre from
            here.
          </p>
        </div>
      </div>
    </header>
  );
}
