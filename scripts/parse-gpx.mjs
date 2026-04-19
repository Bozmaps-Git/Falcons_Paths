#!/usr/bin/env node
// scripts/parse-gpx.mjs — Rebuild public/data/routes.json from GPX files in public/data/.
// Run: npm run parse

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "public", "data");

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dphi = toRad(lat2 - lat1);
  const dlam = toRad(lon2 - lon1);
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function parse(xml, filename) {
  // Extract name from <name> inside <metadata>
  let name = filename;
  const nameMatch = xml.match(/<metadata[\s\S]*?<name>([^<]+)<\/name>/) || xml.match(/<metadata[\s\S]*?<n>([^<]+)<\/n>/);
  if (nameMatch) name = nameMatch[1].trim();

  const trkptRe = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const points = [];
  let m;
  while ((m = trkptRe.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const inner = m[3];
    const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null;
    points.push([lon, lat, ele]);
  }

  if (points.length === 0) throw new Error(`No trackpoints in ${filename}`);

  // Smoothed elevation
  const window = 5;
  const eles = points.map((p) => p[2] ?? 0);
  const smoothed = [];
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
  const cum = [0];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    total += haversine(a[1], a[0], b[1], b[0]);
    cum.push(total);
    const de = smoothed[i] - smoothed[i - 1];
    if (de > 0) gain += de;
    else loss += -de;
  }
  for (const p of points) {
    if (p[2] != null) {
      minEle = Math.min(minEle, p[2]);
      maxEle = Math.max(maxEle, p[2]);
    }
  }

  const lats = points.map((p) => p[1]);
  const lons = points.map((p) => p[0]);

  // Simplify
  const target = 2000;
  const stride = Math.max(1, Math.floor(points.length / target));
  const simplified = [];
  const simplifiedCum = [];
  for (let i = 0; i < points.length; i += stride) {
    simplified.push(points[i]);
    simplifiedCum.push(cum[i]);
  }
  const last = points[points.length - 1];
  if (simplified[simplified.length - 1] !== last) {
    simplified.push(last);
    simplifiedCum.push(total);
  }

  // Checkpoints every 10km
  const totalKm = total / 1000;
  const checkpoints = [];
  checkpoints.push({ km: 0, lon: points[0][0], lat: points[0][1], ele: points[0][2], name: "Start" });
  let nextKm = 10;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] / 1000 >= nextKm && nextKm < totalKm) {
      checkpoints.push({ km: nextKm, lon: points[i][0], lat: points[i][1], ele: points[i][2], name: `CP ${nextKm}km` });
      nextKm += 10;
    }
  }
  checkpoints.push({
    km: Math.round(totalKm * 10) / 10,
    lon: last[0],
    lat: last[1],
    ele: last[2],
    name: "Finish",
  });

  return {
    name,
    filename: basename(filename),
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
    points: simplified,
    cumDistanceM: simplifiedCum.map((d) => Math.round(d * 10) / 10),
    checkpoints,
  };
}

const GPX_MAP = {
  velika: /VELIKA_STAZA/i,
  mala: /MALA_STAZA/i,
};

const files = readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith(".gpx"));
const routes = {};
for (const file of files) {
  const xml = readFileSync(join(DATA_DIR, file), "utf-8");
  const parsed = parse(xml, file);
  let key = null;
  for (const [k, re] of Object.entries(GPX_MAP)) {
    if (re.test(file)) {
      key = k;
      break;
    }
  }
  if (!key) key = file.replace(/\.gpx$/i, "").toLowerCase();
  routes[key] = parsed;
  console.log(`✓ ${key}: ${parsed.name} — ${parsed.stats.totalDistanceKm} km, ${Math.round(parsed.stats.elevationGainM)} m gain`);
}

const out = join(DATA_DIR, "routes.json");
writeFileSync(out, JSON.stringify(routes));
console.log(`\nWrote ${out}`);
