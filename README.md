# Falcon's Paths · Web GIS

Interactive dashboard for the **10th Falcon's Paths MTB Marathon** (*Putevi Sokola*) — Bajina Bašta, western Serbia, on the Drina, at the foot of Mount Tara.

**Built by [Bozmaps](https://bozmaps.com)** — geospatial consultancy, UK & the Balkans.

## What this is

A single static HTML file (`index.html`) — no build step, no server framework, no deploy pipeline beyond "upload file". Open it locally with a double click, or deploy the repo as a static site to Vercel / Netlify / Cloudflare Pages / GitHub Pages.

The two official race GPX tracks are baked into the HTML as compact JSON, so the dashboard works offline and on `file://`.

## Features

- **2D map + 3D terrain** — MapLibre GL JS with three basemaps:
  - Satellite (Esri World Imagery)
  - Streets (CARTO Voyager)
  - Topographic (OpenTopoMap)
- **Free 3D terrain** from AWS Terrarium DEM tiles (1.4× exaggeration, no API key).
- **Hero section** — event identity, nav, display typography.
- **Route cards** — Velika Staza (Marathon) and Mala Staza (Challenge) with per-route colour, distance, climb, peak.
- **Live stats strip** — distance, elevation gain (with descent hint), max altitude (with min hint), checkpoint count, average gradient on climbing sections only.
- **Elevation profile** — Chart.js, per-route gradient fill, hover crosshair, live km/elevation readout, hover marker sync to map.
- **Auto-generated checkpoints** every 10 km + Start & Finish, each with elevation a.s.l.
- **Drag-and-drop GPX** anywhere on the window; `+ GPX` file picker also supported.
- **Editorial design** — Fraunces display + Instrument Sans + JetBrains Mono, forest palette, grain texture.

## Stack

| Layer | Tech |
|---|---|
| Document | Single static `index.html` (~216 KB, routes included) |
| Map | [MapLibre GL JS](https://maplibre.org) 4.7.1 via unpkg CDN |
| Chart | [Chart.js](https://www.chartjs.org) 4.4.6 via jsdelivr CDN |
| Tiles (2D) | Esri World Imagery · CARTO Voyager · OpenTopoMap |
| Terrain (3D) | [AWS Open Data Terrarium tiles](https://registry.opendata.aws/terrain-tiles/) |
| Fonts | Google Fonts: Fraunces, Instrument Sans, JetBrains Mono |

## Local development

```bash
# Double-click index.html, or:
python -m http.server 8080
# then open http://localhost:8080
```

Serving over HTTP is only needed for the "Load · …" preset buttons (which `fetch()` the GPX files from disk). Drag-drop and the embedded routes work from `file://`.

## Rebuilding routes

If the GPX files change, re-bake the embedded JSON:

```bash
node _extract.mjs   # parses the two GPX files → _routes.json
node _build.mjs     # inlines _routes.json into index.html (replaces __ROUTES_JSON__ marker)
```

The `__ROUTES_JSON__` marker is only present in the *template* — once built, the marker is replaced. To re-bake you must start from a fresh template. Keep a copy if you plan to rebuild repeatedly.

## Deployment

Push to `main` → Vercel auto-detects a static site → live. `vercel.json` sets sensible cache headers for GPX files and forces a no-cache policy on `index.html` so updates are immediate.

## Data attribution

- **Tracks** — Putevi Sokola / RideWithGPS (official 2026 event GPX).
- **Satellite** — © Esri, Maxar, Earthstar Geographics.
- **Streets** — © OpenStreetMap contributors, © CARTO.
- **Topo** — © OpenTopoMap (CC-BY-SA), © OSM.
- **Terrain** — Mapzen / AWS Terrarium tiles (open).

## Official race

**[putevisokola.rs](http://putevisokola.rs/en/falcons-paths-mtb-marathon/)** · Bajina Bašta, Serbia.

## Licence

Code: [MIT](./LICENSE). GPX data belongs to the race organisers. OSM data: ODbL.
