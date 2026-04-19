"use client";

import { useMemo, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import type { ParsedRoute } from "@/lib/gpx";
import type { RouteMeta } from "@/lib/routes";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface Props {
  route: ParsedRoute;
  meta: RouteMeta;
  onHover: (distanceM: number | null) => void;
}

export default function ElevationChart({ route, meta, onHover }: Props) {
  const chartRef = useRef<any>(null);

  const { data, options, stats } = useMemo(() => {
    // Subsample for chart smoothness — target ~600 points
    const target = 600;
    const stride = Math.max(1, Math.floor(route.points.length / target));
    const labels: number[] = [];
    const values: number[] = [];
    const distances: number[] = [];
    for (let i = 0; i < route.points.length; i += stride) {
      const km = route.cumDistanceM[i] / 1000;
      labels.push(+km.toFixed(2));
      values.push(route.points[i][2] ?? 0);
      distances.push(route.cumDistanceM[i]);
    }
    // ensure last point
    const lastIdx = route.points.length - 1;
    if (distances[distances.length - 1] !== route.cumDistanceM[lastIdx]) {
      labels.push(+(route.cumDistanceM[lastIdx] / 1000).toFixed(2));
      values.push(route.points[lastIdx][2] ?? 0);
      distances.push(route.cumDistanceM[lastIdx]);
    }

    return {
      data: {
        labels,
        datasets: [
          {
            label: "Elevation",
            data: values,
            fill: true,
            backgroundColor: (ctx: any) => {
              const chart = ctx.chart;
              const { ctx: c, chartArea } = chart;
              if (!chartArea) return meta.colour + "30";
              const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              grad.addColorStop(0, hexToRgba(meta.colour, 0.55));
              grad.addColorStop(1, hexToRgba(meta.colour, 0.02));
              return grad;
            },
            borderColor: meta.accent,
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: "#f4ece0",
            pointHoverBorderColor: meta.colour,
            pointHoverBorderWidth: 2,
          },
        ],
        _distances: distances, // attach for hover lookup
      } as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        onHover: (event: any, elements: any[], chart: any) => {
          const distances: number[] = chart.data._distances;
          if (elements.length > 0) {
            const idx = elements[0].index;
            onHover(distances[idx]);
          } else {
            onHover(null);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0a1410",
            borderColor: hexToRgba(meta.accent, 0.4),
            borderWidth: 1,
            padding: 10,
            titleFont: { family: "JetBrains Mono", size: 10, weight: "normal" as const },
            titleColor: "#a89d8a",
            bodyFont: { family: "Instrument Sans", size: 13 },
            bodyColor: "#f4ece0",
            displayColors: false,
            callbacks: {
              title: (items: any[]) => `${items[0].label} km`,
              label: (item: any) => `${Math.round(item.parsed.y)} m elevation`,
            },
          },
        },
        scales: {
          x: {
            type: "linear" as const,
            title: { display: false },
            ticks: {
              color: "#a89d8a",
              font: { family: "JetBrains Mono", size: 10 },
              maxTicksLimit: 8,
              callback: (v: any) => `${v} km`,
            },
            grid: { color: "rgba(244, 236, 224, 0.04)", drawTicks: false },
            border: { color: "rgba(244, 236, 224, 0.1)" },
          },
          y: {
            title: { display: false },
            ticks: {
              color: "#a89d8a",
              font: { family: "JetBrains Mono", size: 10 },
              callback: (v: any) => `${v} m`,
            },
            grid: { color: "rgba(244, 236, 224, 0.04)", drawTicks: false },
            border: { color: "rgba(244, 236, 224, 0.1)" },
          },
        },
      },
      stats: {
        max: Math.max(...values),
        min: Math.min(...values),
      },
    };
  }, [route, meta, onHover]);

  return (
    <div
      className="relative h-full w-full"
      onMouseLeave={() => onHover(null)}
    >
      <Line ref={chartRef} data={data} options={options as any} />
    </div>
  );
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
