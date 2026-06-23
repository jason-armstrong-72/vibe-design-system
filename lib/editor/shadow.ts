// Pure box-shadow model + parse/format/clamp + pad coord helpers. No React, no DOM, no culori. Testable core.
import { splitTopLevel } from "@/lib/editor/css-list";

// color: the literal "black" sentinel (renders oklch(0 0 0 / a)) | a color-token name "--brand-500".
export interface Layer { inset: boolean; x: number; y: number; blur: number; spread: number;
                         color: string; alpha: number }
export type Shadow = Layer[]; // ≥ 1 layer

const round = (n: number) => Math.round(n * 100) / 100; // 2dp, trailing zeros dropped — NOT toFixed
export const clampPct = (n: number) => Math.max(0, Math.min(100, n));
export const clampBlur = (n: number) => Math.max(0, n);

// ---- format ----
const len = (n: number) => (n === 0 ? "0" : `${round(n)}px`);
function color(l: Layer): string {
  if (l.color === "black") return l.alpha >= 100 ? "oklch(0 0 0)" : `oklch(0 0 0 / ${round(l.alpha / 100)})`;
  const ref = `var(${l.color})`;
  return l.alpha >= 100 ? ref : `color-mix(in oklch, ${ref} ${round(clampPct(l.alpha))}%, transparent)`;
}
function formatLayer(l: Layer): string {
  return `${l.inset ? "inset " : ""}${len(l.x)} ${len(l.y)} ${len(clampBlur(l.blur))} ${len(l.spread)} ${color(l)}`;
}
export function formatShadow(layers: Shadow): string {
  return layers.map(formatLayer).join(", ");
}

/** The CSS color expression for a layer (var()/color-mix()/oklch black) — for a summary/preview swatch. */
export function layerColorCss(l: Layer): string { return color(l); }

// ---- parse ----
/** Split a layer into space-separated tokens, keeping fn(...) calls whole. */
function tokenize(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s.trim()) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ""; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const LEN = /^-?\d*\.?\d+(px)?$/;
function parseColorToken(t: string): { color: string; alpha: number } | null {
  if (/^oklch\(\s*0\s+0\s+0\s*\)$/.test(t)) return { color: "black", alpha: 100 };
  const ok = /^oklch\(\s*0\s+0\s+0\s*\/\s*(\d*\.?\d+)\s*\)$/.exec(t);
  if (ok) return { color: "black", alpha: round(Number(ok[1]) * 100) };
  const vm = /^var\((--[\w-]+)\)$/.exec(t);
  if (vm) return { color: vm[1], alpha: 100 };
  const cm = /^color-mix\(inoklch,var\((--[\w-]+)\)(\d*\.?\d+)%,transparent\)$/.exec(t.replace(/\s+/g, ""));
  if (cm) return { color: cm[1], alpha: clampPct(Number(cm[2])) };
  return null; // raw color / unsupported
}

function parseLayer(raw: string): Layer | null {
  const toks = tokenize(raw);
  if (toks.length < 3) return null; // need ≥ 2 lengths + a color
  let inset = false;
  if (toks[0] === "inset") { inset = true; toks.shift(); }
  const lens: number[] = [];
  while (toks.length && LEN.test(toks[0])) lens.push(Number(toks.shift()!.replace("px", "")));
  if (lens.length < 2 || lens.length > 4 || toks.length !== 1) return null; // exactly one trailing color token
  const c = parseColorToken(toks[0]);
  if (!c) return null;
  const [x, y, blur = 0, spread = 0] = lens;
  return { inset, x, y, blur: clampBlur(blur), spread, color: c.color, alpha: c.alpha };
}

export function parseShadow(value: string): Shadow | null {
  const parts = splitTopLevel(value.trim());
  if (parts.length === 0) return null;
  const layers: Layer[] = [];
  for (const p of parts) { const l = parseLayer(p); if (!l) return null; layers.push(l); }
  return layers;
}

// ---- pad coord helpers (pure; take rect + range; centre = origin, y down-positive) ----
export function offsetFromPointer(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  range: number,
): { x: number; y: number } {
  const fx = rect.width <= 0 ? 0.5 : (clientX - rect.left) / rect.width;
  const fy = rect.height <= 0 ? 0.5 : (clientY - rect.top) / rect.height;
  return { x: round((fx * 2 - 1) * range), y: round((fy * 2 - 1) * range) };
}
/** Model x/y → clamped [0,100]% dot position (pins to edge when |value| > range). */
export function dotPercent(x: number, y: number, range: number): { left: number; top: number } {
  const pct = (v: number) => clampPct(((v / range) + 1) * 50);
  return { left: pct(x), top: pct(y) };
}
