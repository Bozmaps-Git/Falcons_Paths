// lib/gpx.ts — Pure TS GPX parser + stats. Works in browser and Node.

export interface TrackPoint {
  lon: number;
  lat: number;
  ele: number | null;
}

export interface Checkpoint {
  km: number;
  lon: number;
  lat: number;
  ele: number | null;
  name: string;
}

export interface RouteStats {
  totalDistanceM: number;
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
  pointCount: number;
}

export interface ParsedRoute {
  name: string;
  filename: string;
  stats: RouteStats;
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
  points: [number, number, number | null][]; // [lon, lat, ele]
  cumDistanceM: number[];
  checkpoints: Checkpoint[];
}

const EARTH_R = 6371000;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlam = toRad(lon2 - lon1);
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

export function parseGpxString(xml: string, filename = "track.gpx"): ParsedRoute {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error("Invalid GPX XML");

  // Extract name (both <name> and <n> variants)
  let name = filename;
  const metaName = doc.querySelector("metadata > name, metadata > n");
  if (metaName?.textContent) name = metaName.textContent.trim();

  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  const points: TrackPoint[] = trkpts.map((p) => {
    const lat = parseFloat(p.getAttribute("lat") || "0");
    const lon = parseFloat(p.getAttribute("lon") || "0");
    const eleEl = p.getElementsByTagName("ele")[0];
    const ele = eleEl ? parseFloat(eleEl.textContent || "0") : null;
    return { lon, lat, ele };
  });

  if (points.length === 0) throw new Error("No trackpoints in GPX");

  return analyseTrack(points, name, filename);
}

export function analyseTrack(points: TrackPoint[], name: string, filename: string): ParsedRoute {
  // Smooth elevation with a rolling window to reduce GPS noise
  const window = 5;
  const eles = points.map((p) => p.ele ?? 0);
  const smoothed: number[] = [];
  for (let i = 0; i < eles.length; i++) {
    const lo = Math.max(0, i - window);
    const hi = Math.min(eles.length, i + window + 1);
    let sum = 0;
    for (let j = lo; j < hi; j++) sum += eles[j];
    smoothed.push(sum / (hi - lo));
  }

  let total = 0;
  let gain = 0;
  let loss = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  const cum: number[] = [0];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    total += haversine(a.lat, a.lon, b.lat, b.lon);
    cum.push(total);
    const de = smoothed[i] - smoothed[i - 1];
    if (de > 0) gain += de;
    else loss += -de;
  }
  for (const p of points) {
    if (p.ele != null) {
      minEle = Math.min(minEle, p.ele);
      maxEle = Math.max(maxEle, p.ele);
    }
  }

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);

  // Simplify for rendering
  const target = 2000;
  const stride = Math.max(1, Math.floor(points.length / target));
  const simplifiedPts: [number, number, number | null][] = [];
  const simplifiedCum: number[] = [];
  for (let i = 0; i < points.length; i += stride) {
    simplifiedPts.push([points[i].lon, points[i].lat, points[i].ele]);
    simplifiedCum.push(cum[i]);
  }
  // Ensure last point
  const last = points[points.length - 1];
  if (simplifiedPts[simplifiedPts.length - 1][0] !== last.lon || simplifiedPts[simplifiedPts.length - 1][1] !== last.lat) {
    simplifiedPts.push([last.lon, last.lat, last.ele]);
    simplifiedCum.push(total);
  }

  const totalKm = total / 1000;
  const checkpoints = autoCheckpoints(simplifiedPts, simplifiedCum, 10);

  return {
    name,
    filename,
    stats: {
      totalDistanceM: Math.round(total * 10) / 10,
      totalDistanceKm: Math.round(totalKm * 100) / 100,
      elevationGainM: Math.round(gain * 10) / 10,
      elevationLossM: Math.round(loss * 10) / 10,
      minElevationM: minEle === Infinity ? 0 : Math.round(minEle * 10) / 10,
      maxElevationM: maxEle === -Infinity ? 0 : Math.round(maxEle * 10) / 10,
      pointCount: points.length,
    },
    bounds: {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    },
    points: simplifiedPts,
    cumDistanceM: simplifiedCum,
    checkpoints,
  };
}

function autoCheckpoints(
  points: [number, number, number | null][],
  cum: number[],
  everyKm: number
): Checkpoint[] {
  const totalKm = cum[cum.length - 1] / 1000;
  const cps: Checkpoint[] = [];
  const start = points[0];
  cps.push({ km: 0, lon: start[0], lat: start[1], ele: start[2], name: "Start" });
  let nextKm = everyKm;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] / 1000 >= nextKm && nextKm < totalKm) {
      const p = points[i];
      cps.push({ km: nextKm, lon: p[0], lat: p[1], ele: p[2], name: `CP ${nextKm}km` });
      nextKm += everyKm;
    }
  }
  const finish = points[points.length - 1];
  cps.push({ km: Math.round(totalKm * 10) / 10, lon: finish[0], lat: finish[1], ele: finish[2], name: "Finish" });
  return cps;
}

/** GeoJSON LineString for map rendering */
export function toGeoJson(route: ParsedRoute) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { name: route.name },
        geometry: {
          type: "LineString" as const,
          coordinates: route.points.map((p) => [p[0], p[1]]),
        },
      },
    ],
  };
}

/** Find the nearest point index on the track to a given distance-along-route (metres) */
export function findIndexByDistance(cum: number[], targetM: number): number {
  // binary search
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < targetM) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
