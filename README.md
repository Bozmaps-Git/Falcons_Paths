# Falcon's Paths · Web GIS

Interactive web GIS platform for the **10th Falcon's Paths MTB Marathon** (*Putevi Sokola*) — Bajina Bašta, western Serbia, foot of Mount Tara, on the Drina river.

**Built by [Bozmaps](https://bozmaps.com)** — geospatial consultancy, UK & the Balkans.

---

## Features

- **Two official routes** — *Velika Staza* (43 km, 1,245 m climb) and *Mala Staza* (28 km, 892 m climb) — parsed from official RideWithGPS GPX files.
- **2D MapLibre view** with four basemap options: Terrain (OpenTopoMap), Satellite (Esri), Streets (OSM), Topographic (CyclOSM).
- **3D Cesium view** with global terrain and elevation-draped route (Cesium Ion token recommended for full quality).
- **Live elevation profile** (Chart.js) — hover to scrub along the route; the map marker moves with you.
- **Points of Interest** pulled live from **OpenStreetMap** via the Overpass API: water, lodging, viewpoints, medical, services, heritage. Toggleable.
- **Auto-detected checkpoints** every 10 km plus Start/Finish.
- **Full stats dashboard**: distance, elevation gain/loss, altitude range, gradient, checkpoint count.
- **Downloadable GPX** for each route.
- **Responsive, grain-textured editorial design**: Fraunces serif display, JetBrains Mono for data.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| 2D Map | MapLibre GL JS + OSM / Esri / CyclOSM / OpenTopoMap raster tiles |
| 3D Map | Cesium + Cesium Ion (optional token) |
| Charts | Chart.js + react-chartjs-2 |
| POI Data | OpenStreetMap via Overpass API (three endpoints with failover) |
| Style | Tailwind CSS + custom design tokens |
| Icons | Lucide |
| Deploy | Vercel |

## Local development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Optional — Cesium Ion terrain

1. Get a free token at [cesium.com/ion](https://cesium.com/ion).
2. Create `.env.local`:

```
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token_here
```

Without a token the app falls back to Esri satellite imagery on an ellipsoid (still 3D-capable, just without real terrain elevation).

### Rebuilding routes.json from GPX

If you replace the GPX files in `public/data/`:

```bash
npm run parse
```

## Deploy to Vercel

```bash
vercel --prod
```

Set `NEXT_PUBLIC_CESIUM_ION_TOKEN` in Vercel project env vars for production terrain.

## Data sources

- **GPX tracks**: Official race GPX from [RideWithGPS](https://ridewithgps.com/).
- **POIs**: OpenStreetMap (© OSM contributors, ODbL).
- **Basemaps**:
  - Terrain — OpenTopoMap (CC-BY-SA)
  - Satellite — Esri World Imagery
  - Streets — OSM standard tiles
  - Topographic — CyclOSM
- **3D terrain**: Cesium Ion World Terrain (requires token).

## Official race

**[putevisokola.rs](http://putevisokola.rs/en/falcons-paths-mtb-marathon/)** · Bajina Bašta, Serbia.

## Licence

Code: MIT. GPX data belongs to the race organisers. OSM data: ODbL.
