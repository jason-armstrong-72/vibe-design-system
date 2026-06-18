import { oklch, formatHex, clampChroma } from "culori";

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
