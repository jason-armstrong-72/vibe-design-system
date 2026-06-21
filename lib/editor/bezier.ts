/** Pure cubic-bezier helpers for the easing curve editor. No React, no DOM. */

export type Cubic = [number, number, number, number]; // [x1, y1, x2, y2]

/** Vertical overshoot range the canvas/handles allow (CSS y is unbounded; this is a UI limit). */
export const Y_MIN = -0.75;
export const Y_MAX = 1.75;

/** SVG viewBox geometry. The [0,1] progress band occupies the middle; overshoot rooms top+bottom. */
export interface Geom {
  width: number;
  height: number;
  padX: number;
  padTop: number; // y=1 maps here
  padBottom: number; // y=0 maps to height - padBottom
}
export const GEOM_DEFAULT: Geom = { width: 240, height: 300, padX: 24, padTop: 90, padBottom: 90 };

const KEYWORDS: Record<string, Cubic> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const clampX = (n: number) => clamp(n, 0, 1);
export const clampY = (n: number) => clamp(n, Y_MIN, Y_MAX);

const CB = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;

export function parseBezier(value: string): Cubic | null {
  const v = value.trim();
  if (v in KEYWORDS) return [...KEYWORDS[v]] as Cubic;
  const m = CB.exec(v);
  if (!m) return null;
  const nums = [m[1], m[2], m[3], m[4]].map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums as Cubic;
}

export function formatBezier(c: Cubic): string {
  const [x1, y1, x2, y2] = c;
  return `cubic-bezier(${round2(clampX(x1))}, ${round2(y1)}, ${round2(clampX(x2))}, ${round2(y2)})`;
}

const xToSvg = (x: number, g: Geom) => g.padX + (g.width - 2 * g.padX) * x;
const yToSvg = (y: number, g: Geom) => {
  const y0 = g.height - g.padBottom; // y=0
  const y1 = g.padTop; // y=1
  return y0 + (y1 - y0) * y;
};
const svgToX = (sx: number, g: Geom) => (sx - g.padX) / (g.width - 2 * g.padX);
const svgToY = (sy: number, g: Geom) => {
  const y0 = g.height - g.padBottom;
  const y1 = g.padTop;
  return (sy - y0) / (y1 - y0);
};

export interface SvgPoints {
  anchorStart: { sx: number; sy: number };
  anchorEnd: { sx: number; sy: number };
  p1: { sx: number; sy: number };
  p2: { sx: number; sy: number };
}
export function toSvg(c: Cubic, g: Geom): SvgPoints {
  const [x1, y1, x2, y2] = c;
  return {
    anchorStart: { sx: xToSvg(0, g), sy: yToSvg(0, g) },
    anchorEnd: { sx: xToSvg(1, g), sy: yToSvg(1, g) },
    p1: { sx: xToSvg(x1, g), sy: yToSvg(y1, g) },
    p2: { sx: xToSvg(x2, g), sy: yToSvg(y2, g) },
  };
}
export function fromSvg(sx: number, sy: number, g: Geom): { x: number; y: number } {
  return { x: clampX(svgToX(sx, g)), y: clampY(svgToY(sy, g)) };
}
