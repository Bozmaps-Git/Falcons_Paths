#!/usr/bin/env node
import { existsSync, mkdirSync, cpSync, rmSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CESIUM_SRC = join(ROOT, "node_modules", "cesium", "Build", "Cesium");
const DEST = join(ROOT, "public", "cesium");

if (!existsSync(CESIUM_SRC)) {
  console.warn("[copy-cesium] Cesium not installed yet, skipping.");
  process.exit(0);
}

if (existsSync(DEST)) rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

for (const dir of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  const from = join(CESIUM_SRC, dir);
  const to = join(DEST, dir);
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`[copy-cesium] ${dir} ✓`);
  }
}

// Copy the main pre-built Cesium.js bundle (loaded as a global script to avoid webpack bundling issues)
const cesiumJs = join(CESIUM_SRC, "Cesium.js");
if (existsSync(cesiumJs)) {
  copyFileSync(cesiumJs, join(DEST, "Cesium.js"));
  console.log("[copy-cesium] Cesium.js ✓");
}

console.log("[copy-cesium] Done.");
