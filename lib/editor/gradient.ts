// Pure gradient model + parse/format/clamp. No React, no DOM, no culori. The testable core.

export type GradientType = "linear" | "radial";
export interface Stop { color: string; alpha: number; position: number } // color: "--name" | "transparent"
export type Gradient =
  | { type: "linear"; angle: number; stops: Stop[] }
  | { type: "radial"; shape: "circle" | "ellipse"; cx: number; cy: number; stops: Stop[] };

const round = (n: number) => Math.round(n * 100) / 100; // 2dp, trailing zeros dropped — NOT toFixed
export const clampAngle = (n: number) => Math.max(0, Math.min(360, n));
export const clampPct = (n: number) => Math.max(0, Math.min(100, n));

// ---- format ----
function formatStop(s: Stop): string {
  const pos = `${round(clampPct(s.position))}%`;
  if (s.color === "transparent" || s.alpha <= 0) return `transparent ${pos}`;
  const ref = `var(${s.color})`;
  const col = s.alpha >= 100 ? ref : `color-mix(in oklch, ${ref} ${round(clampPct(s.alpha))}%, transparent)`;
  return `${col} ${pos}`;
}
export function formatGradient(g: Gradient): string {
  const stops = g.stops.map(formatStop).join(", ");
  if (g.type === "linear") return `linear-gradient(${round(clampAngle(g.angle))}deg, ${stops})`;
  return `radial-gradient(${g.shape} at ${round(clampPct(g.cx))}% ${round(clampPct(g.cy))}%, ${stops})`;
}

// ---- parse ----
/** Split on commas at paren-depth 0 (so color-mix(...) inner commas survive). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}

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
  const lin = /^linear-gradient\((.*)\)$/s.exec(v);
  if (lin) {
    const parts = splitTopLevel(lin[1]);
    let angle = 180, stopParts = parts;
    const am = /^(-?\d*\.?\d+)deg$/.exec(parts[0] ?? "");
    if (am) { angle = clampAngle(Number(am[1])); stopParts = parts.slice(1); }
    const stops = parseStops(stopParts);
    return stops ? { type: "linear", angle, stops } : null;
  }
  const rad = /^radial-gradient\((.*)\)$/s.exec(v);
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
