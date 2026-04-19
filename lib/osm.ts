// lib/osm.ts — Query Overpass API for POIs relevant to MTB riders & spectators along a route.

export interface Poi {
  id: string;
  lat: number;
  lon: number;
  name: string;
  type: string;
  tags: Record<string, string>;
  distanceFromRouteM?: number;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

/** POI categories relevant to an MTB marathon */
export const POI_CATEGORIES = {
  water: {
    label: "Water & Refreshment",
    query: `
      node["amenity"="drinking_water"](bbox);
      node["amenity"="cafe"](bbox);
      node["amenity"="restaurant"](bbox);
      node["amenity"="pub"](bbox);
      node["amenity"="fast_food"](bbox);
    `,
    icon: "droplets",
    color: "#4ea8de",
  },
  accommodation: {
    label: "Lodging",
    query: `
      node["tourism"="hotel"](bbox);
      node["tourism"="guest_house"](bbox);
      node["tourism"="hostel"](bbox);
      node["tourism"="chalet"](bbox);
      node["tourism"="camp_site"](bbox);
    `,
    icon: "bed",
    color: "#c8732a",
  },
  viewpoint: {
    label: "Viewpoints & Nature",
    query: `
      node["tourism"="viewpoint"](bbox);
      node["tourism"="picnic_site"](bbox);
      node["natural"="peak"](bbox);
      node["natural"="waterfall"](bbox);
      node["natural"="spring"](bbox);
      node["natural"="cave_entrance"](bbox);
    `,
    icon: "mountain",
    color: "#88b04b",
  },
  medical: {
    label: "Medical & Emergency",
    query: `
      node["amenity"="hospital"](bbox);
      node["amenity"="pharmacy"](bbox);
      node["amenity"="doctors"](bbox);
      node["amenity"="clinic"](bbox);
    `,
    icon: "heart-pulse",
    color: "#e63946",
  },
  services: {
    label: "Services",
    query: `
      node["amenity"="fuel"](bbox);
      node["amenity"="atm"](bbox);
      node["amenity"="bank"](bbox);
      node["shop"="bicycle"](bbox);
      node["shop"="supermarket"](bbox);
    `,
    icon: "wrench",
    color: "#e8a55c",
  },
  culture: {
    label: "Heritage & Culture",
    query: `
      node["historic"~"."](bbox);
      node["tourism"="museum"](bbox);
      node["tourism"="attraction"](bbox);
      node["amenity"="place_of_worship"](bbox);
    `,
    icon: "landmark",
    color: "#9d74c7",
  },
} as const;

export type PoiCategory = keyof typeof POI_CATEGORIES;

function buildQuery(bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }, categories: PoiCategory[]): string {
  const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
  const inner = categories
    .map((c) => POI_CATEGORIES[c].query.replace(/\(bbox\)/g, `(${bboxStr})`))
    .join("\n");
  return `
    [out:json][timeout:25];
    (
      ${inner}
    );
    out body;
  `;
}

export async function fetchPois(
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  categories: PoiCategory[],
  signal?: AbortSignal
): Promise<Poi[]> {
  // Expand bbox by ~2km buffer so we catch POIs just off the route
  const buf = 0.02; // ~2.2km in lat, slightly more in lon at this latitude
  const paddedBbox = {
    minLat: bbox.minLat - buf,
    maxLat: bbox.maxLat + buf,
    minLon: bbox.minLon - buf,
    maxLon: bbox.maxLon + buf,
  };
  const query = buildQuery(paddedBbox, categories);

  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${endpoint} returned ${res.status}`);
        continue;
      }
      const data = await res.json();
      return (data.elements || [])
        .filter((el: any) => el.type === "node" && el.tags)
        .map((el: any) => mapElementToPoi(el));
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  throw lastErr ?? new Error("All Overpass endpoints failed");
}

function mapElementToPoi(el: any): Poi {
  const tags = el.tags || {};
  const name = tags.name || tags["name:en"] || tags["name:sr"] || tags.amenity || tags.tourism || tags.natural || tags.historic || tags.shop || "Unnamed";
  let type = "Other";
  if (tags.amenity) type = tags.amenity;
  else if (tags.tourism) type = tags.tourism;
  else if (tags.natural) type = tags.natural;
  else if (tags.historic) type = "historic";
  else if (tags.shop) type = `shop: ${tags.shop}`;
  return {
    id: `${el.type}/${el.id}`,
    lat: el.lat,
    lon: el.lon,
    name,
    type,
    tags,
  };
}

/** Distance from a POI to the nearest point on the route (metres, rough). */
export function distanceToRoute(poi: Poi, routePoints: [number, number, number | null][]): number {
  let min = Infinity;
  // Sample every 5th point for perf; 400 samples on a 2000pt route is plenty
  const step = Math.max(1, Math.floor(routePoints.length / 400));
  for (let i = 0; i < routePoints.length; i += step) {
    const [lon, lat] = routePoints[i];
    const d = roughDistanceM(poi.lat, poi.lon, lat, lon);
    if (d < min) min = d;
  }
  return min;
}

function roughDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Equirectangular approximation — fast, accurate enough for sub-km distances
  const R = 6371000;
  const x = ((lon2 - lon1) * Math.PI) / 180 * Math.cos(((lat1 + lat2) / 2 * Math.PI) / 180);
  const y = ((lat2 - lat1) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * R;
}
