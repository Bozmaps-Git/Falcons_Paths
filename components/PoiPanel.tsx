"use client";

import { useMemo } from "react";
import type { Poi, PoiCategory } from "@/lib/osm";
import { POI_CATEGORIES } from "@/lib/osm";
import { Droplets, Bed, Mountain, HeartPulse, Wrench, Landmark, Loader2 } from "lucide-react";

const ICONS: Record<string, typeof Droplets> = {
  droplets: Droplets,
  bed: Bed,
  mountain: Mountain,
  "heart-pulse": HeartPulse,
  wrench: Wrench,
  landmark: Landmark,
};

interface Props {
  pois: Poi[];
  loading: boolean;
  error: string | null;
  visibleCategories: Set<PoiCategory>;
  onToggle: (cat: PoiCategory) => void;
  onRefresh: () => void;
}

export default function PoiPanel({ pois, loading, error, visibleCategories, onToggle, onRefresh }: Props) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of pois) {
      const cat = guessCategory(p);
      if (cat) c[cat] = (c[cat] || 0) + 1;
    }
    return c;
  }, [pois]);

  return (
    <div className="flex h-full flex-col border-l border-paper/10 bg-forest-900/60 backdrop-blur">
      <div className="border-b border-paper/10 px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-wider3 text-amber-light">Layer 03</div>
        <h3 className="mt-1 font-display text-2xl text-paper">Points of Interest</h3>
        <p className="mt-1 text-[12px] leading-snug text-paper-dim">
          Live data pulled from OpenStreetMap along the route corridor.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {(Object.keys(POI_CATEGORIES) as PoiCategory[]).map((cat) => {
          const config = POI_CATEGORIES[cat];
          const Icon = ICONS[config.icon] || Droplets;
          const on = visibleCategories.has(cat);
          const count = counts[cat] || 0;
          return (
            <button
              key={cat}
              onClick={() => onToggle(cat)}
              className={`group mb-1.5 flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition ${
                on
                  ? "border-paper/15 bg-forest-800/80"
                  : "border-transparent bg-transparent opacity-50 hover:opacity-80"
              }`}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm"
                style={{ background: config.color + "22", color: config.color }}
              >
                <Icon size={15} strokeWidth={1.6} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[15px] text-paper truncate">{config.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-paper-dim tnum">
                  {loading ? "…" : `${count} found`}
                </div>
              </div>
              <div
                className={`h-2 w-2 rounded-full border transition ${
                  on ? "border-transparent" : "border-paper/30"
                }`}
                style={{ background: on ? config.color : "transparent" }}
              />
            </button>
          );
        })}

        {error && (
          <div className="mt-3 rounded-sm border border-red-400/30 bg-red-400/5 px-3 py-2 font-mono text-[11px] text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-paper/10 px-5 py-4">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 border border-paper/20 bg-transparent px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider2 text-paper transition hover:bg-paper/5 disabled:opacity-50"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : null}
          {loading ? "Querying OSM" : "Refresh from OSM"}
        </button>
        <div className="mt-3 text-center font-mono text-[9px] uppercase tracking-wider2 text-paper-dim">
          Overpass API · open data
        </div>
      </div>
    </div>
  );
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
