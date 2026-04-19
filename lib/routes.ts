// lib/routes.ts — Typed access to bundled race routes.
import type { ParsedRoute } from "./gpx";

export type RouteKey = "velika" | "mala";

export interface RouteMeta {
  key: RouteKey;
  label: string;
  subtitle: string;
  colour: string;
  difficulty: "Marathon" | "Challenge";
  accent: string;
}

export const ROUTE_META: Record<RouteKey, RouteMeta> = {
  velika: {
    key: "velika",
    label: "Velika Staza",
    subtitle: "The Grand Course",
    colour: "#c8732a",
    accent: "#e8a55c",
    difficulty: "Marathon",
  },
  mala: {
    key: "mala",
    label: "Mala Staza",
    subtitle: "The Short Course",
    colour: "#88b04b",
    accent: "#a8cc6b",
    difficulty: "Challenge",
  },
};

export type RoutesBundle = Record<RouteKey, ParsedRoute>;

export async function loadRoutes(): Promise<RoutesBundle> {
  const res = await fetch("/data/routes.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("Failed to load routes");
  return res.json();
}

export function formatKm(m: number): string {
  return (m / 1000).toFixed(1);
}

export function formatMetres(m: number): string {
  return Math.round(m).toLocaleString();
}
