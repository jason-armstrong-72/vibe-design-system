// Pure gradient model + parse/format/clamp. No React, no DOM, no culori. The testable core.
import { splitTopLevel } from "@/lib/editor/css-list";

export type GradientType = "linear" | "radial";
export interface Stop { color: string; alpha: number; position: number } // color: "--name" | "transparent"
export type Gradient =
  | { type: "linear"; angle: number; stops: Stop[] }
  | { type: "radial"; shape: "circle" | "ellipse"; cx: number; cy: number; stops: Stop[] };

const round = (n: number) => Math.round(n * 100) / 100; // 2dp, trailing zeros dropped — NOT toFixed
export const clampAngle = (n: number) => Math.max(0, Math.min(360, n));
export const clampPct = (n: number) => Math.max(0, Math.min(100, n));

// ---- format ----
/** The CSS color expression for a stop (no position) — var(), color-mix(), or bare transparent. */
export function stopColor(s: Stop): string {
  if (s.color === "transparent" || s.alpha <= 0) return "transparent";
  const ref = `var(${s.color})`;
  return s.alpha >= 100 ? ref : `color-mix(in oklch, ${ref} ${round(clampPct(s.alpha))}%, transparent)`;
}
function formatStop(s: Stop): string {
  return `${stopColor(s)} ${round(clampPct(s.position))}%`;
}

/** A flat left-to-right `linear-gradient` of the stops, for the ramp bar preview (type-agnostic). */
export function rampGradient(stops: Stop[]): string {
  return `linear-gradient(90deg, ${stops.map(formatStop).join(", ")})`;
}

/** Map a pointer's clientX within a ramp rect to a clamped position percentage. */
export function positionFromPointer(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return 0;
  return clampPct(((clientX - rect.left) / rect.width) * 100);
}

/** Map a pointer within a square pad rect to a clamped {cx, cy} percentage pair (radial/conic center). */
export function centerFromPointer(
  clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number },
): { cx: number; cy: number } {
  const cx = rect.width <= 0 ? 0 : ((clientX - rect.left) / rect.width) * 100;
  const cy = rect.height <= 0 ? 0 : ((clientY - rect.top) / rect.height) * 100;
  return { cx: clampPct(cx), cy: clampPct(cy) };
}
export function formatGradient(g: Gradient): string {
  const stops = g.stops.map(formatStop).join(", ");
  if (g.type === "linear") return `linear-gradient(${round(clampAngle(g.angle))}deg, ${stops})`;
  return `radial-gradient(${g.shape} at ${round(clampPct(g.cx))}% ${round(clampPct(g.cy))}%, ${stops})`;
}

// ---- parse ----

function parseOneStop(raw: string): Stop | null {
  // trailing "<pos>%" (optional)
  let position = 0;
  let body = raw;
  const pm = /\s+(\d*\.?\d+)%$/.exec(raw);
  if (pm) { position = clampPct(Number(pm[1])); body = raw.slice(0, pm.index).trim(); }
  if (body === "transparent") return { color: "transparent", alpha: 0, position };
  const vm = /^var\((--[\w-]+)\)$/.exec(body);
  if (vm) return { color: vm[1], alpha: 100, position };
  const cm = /^color-mix\(in oklch,\s*var\((--[\w-]+)\)\s+(\d*\.?\d+)%,\s*transparent\)$/.exec(body);
  if (cm) return { color: cm[1], alpha: clampPct(Number(cm[2])), position };
  return null; // raw color / unsupported → caller bails to null
}

function parseStops(parts: string[]): Stop[] | null {
  if (parts.length < 2) return null;
  const stops: Stop[] = [];
  for (const p of parts) { const s = parseOneStop(p); if (!s) return null; stops.push(s); }
  // parseOneStop defaults a missing position to 0 (canonical seeds always carry positions).
  return stops;
}

export function parseGradient(value: string): Gradient | null {
  const v = value.trim();
  const lin = /^linear-gradient\((.*)\)$/.exec(v);
  if (lin) {
    const parts = splitTopLevel(lin[1]);
    let angle = 180, stopParts = parts;
    const am = /^(-?\d*\.?\d+)deg$/.exec(parts[0] ?? "");
    if (am) { angle = clampAngle(Number(am[1])); stopParts = parts.slice(1); }
    const stops = parseStops(stopParts);
    return stops ? { type: "linear", angle, stops } : null;
  }
  const rad = /^radial-gradient\((.*)\)$/.exec(v);
  if (rad) {
    const parts = splitTopLevel(rad[1]);
    const hm = /^(circle|ellipse) at (\d*\.?\d+)% (\d*\.?\d+)%$/.exec(parts[0] ?? "");
    if (!hm) return null;
    const stops = parseStops(parts.slice(1));
    return stops
      ? { type: "radial", shape: hm[1] as "circle" | "ellipse", cx: clampPct(Number(hm[2])), cy: clampPct(Number(hm[3])), stops }
      : null;
  }
  return null;
}
