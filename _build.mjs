// Build step: inline _routes.json into gpx-viewer.html so it works via file://
import { readFileSync, writeFileSync } from "node:fs";

const routes = readFileSync("_routes.json", "utf8").trim();
const html = readFileSync("gpx-viewer.html", "utf8");

if (!html.includes("__ROUTES_JSON__")) {
  console.error("Marker __ROUTES_JSON__ not found — either already built, or template changed.");
  process.exit(1);
}

// Defensive: JSON can contain </script> in strings only if we have weird names; we don't.
// Still, escape the closing-tag sequence to be safe inside an embedded <script> block.
const safe = routes.replace(/<\/script>/gi, "<\\/script>");

const out = html.replace("__ROUTES_JSON__", safe);
writeFileSync("gpx-viewer.html", out);
console.error(`Inlined ${safe.length} bytes of route data into gpx-viewer.html`);
