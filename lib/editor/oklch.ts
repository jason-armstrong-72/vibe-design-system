import { oklch, formatHex, clampChroma, wcagContrast } from "culori";

export interface Lch {
  l: number; // 0..1
  c: number; // 0..~0.4
  h: number; // 0..360
}

const round = (n: number, p: number) => {
  const f = 10 ** p;
  return Math.round(n * f) / f;
};

/** Parse an `oklch(L C H)` string (or any CSS color) to {l,c,h}, or null if unparseable. */
export function parseOklch(str: string): Lch | null {
  const p = oklch(str);
  if (!p || p.l === undefined) return null;
  return { l: p.l, c: p.c ?? 0, h: p.h ?? 0 };
}

/** Format {l,c,h} back to the canonical `oklch(L C H)` string the token store uses. */
export function formatOklch({ l, c, h }: Lch): string {
  return `oklch(${round(l, 3)} ${round(c, 3)} ${round(h, 1)})`;
}

/** Hex (or any CSS color) → {l,c,h}, or null if unparseable. */
export function hexToOklch(hex: string): Lch | null {
  return parseOklch(hex);
}

/** {l,c,h} → a gamut-clamped #rrggbb hex (chroma reduced until it fits sRGB). */
export function oklchToHex({ l, c, h }: Lch): string {
  return formatHex(clampChroma({ mode: "oklch", l, c, h }, "oklch")) ?? "#000000";
}

/** Nearest lightness (keeping C/H) whose GAMUT-MAPPED colour clears `min` contrast vs `partnerValue`,
 *  or null if unreachable at this chroma. Contrast is U-shaped in L (valley where luminances match), so
 *  ternary-search the valley, binary-search each monotonic arm, and pick the L closest to the current
 *  one. Measures the clamped value (oklchToHex) so the result passes as rendered. */
export function nearestPassingL(value: string, partnerValue: string, min: number): string | null {
  const cur = parseOklch(value);
  if (!cur) return null;
  const r = (l: number) => wcagContrast(oklchToHex({ l, c: cur.c, h: cur.h }), partnerValue);
  // valley = L minimizing contrast (unimodal in L at fixed C/H)
  let lo = 0, hi = 1;
  for (let i = 0; i < 50; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (r(m1) < r(m2)) hi = m2; else lo = m1;
  }
  const valley = (lo + hi) / 2;
  // arm UP [valley,1] increasing → smallest L ≥ valley meeting min
  let up: number | null = null;
  if (r(1) >= min) { let a = valley, b = 1; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (r(m) >= min) b = m; else a = m; } up = b; }
  // arm DOWN [0,valley] decreasing → largest L ≤ valley meeting min
  let down: number | null = null;
  if (r(0) >= min) { let a = 0, b = valley; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (r(m) >= min) a = m; else b = m; } down = a; }
  const cands = [up, down].filter((x): x is number => x !== null);
  if (cands.length === 0) return null;
  const best = cands.reduce((p, c) => (Math.abs(c - cur.l) < Math.abs(p - cur.l) ? c : p));
  // formatOklch rounds L to 3dp, which can dip the boundary ratio just under min; nudge in the
  // passing direction (away from the valley) by the rounding quantum until the FORMATTED value clears min.
  const dir = best >= valley ? 1 : -1;
  for (let L = best, i = 0; i < 16 && L >= 0 && L <= 1; L = round(L + dir * 0.001, 3), i++) {
    const s = formatOklch({ l: L, c: cur.c, h: cur.h });
    if (wcagContrast(oklchToHex(parseOklch(s)!), partnerValue) >= min) return s;
  }
  return null;
}
