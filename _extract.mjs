import { readFileSync, writeFileSync } from "node:fs";

const files = [
  { key: "velika", name: "Velika Staza · Marathon",  path: "MTB_MARATON_PUTEVI_SOKOLA_-_VELIKA_STAZA_2026.gpx" },
  { key: "mala",   name: "Mala Staza · Challenge",  path: "MTB_MARATON_PUTEVI_SOKOLA_2026_-_MALA_STAZA.gpx" },
];

const out = {};
for (const f of files) {
  const xml = readFileSync(f.path, "utf8");
  const pts = [];
  const re = /<trkpt\s+lat="([-\d.]+)"\s+lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const lat = +m[1], lon = +m[2];
    const eleMatch = m[3].match(/<ele>([-\d.]+)<\/ele>/);
    const ele = eleMatch ? +eleMatch[1] : null;
    const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
    pts.push(ele != null
      ? [round(lon, 6), round(lat, 6), round(ele, 1)]
      : [round(lon, 6), round(lat, 6)]);
  }
  out[f.key] = { name: f.name, coords: pts };
  console.error(`${f.key}: ${pts.length} points`);
}

writeFileSync("_routes.json", JSON.stringify(out));
console.error("wrote _routes.json (" + JSON.stringify(out).length + " bytes)");
