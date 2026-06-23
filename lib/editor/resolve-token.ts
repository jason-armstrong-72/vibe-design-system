/** Pure reverse-resolution: match an element's canonical computed values to design tokens. No DOM. */
import { parse, formatHex } from "culori";
import type { TokenGroup } from "@/lib/tokens/types";
import { splitTopLevel } from "@/lib/editor/css-list";

export type CssProperty =
  | "background-color" | "color" | "border-radius" | "font-size" | "font-family" | "box-shadow";

/** In-scope groups → the ELEMENT CSS properties to read+match. Partial: only the picked groups. */
export const GROUP_PROPERTY: Partial<Record<TokenGroup, CssProperty[]>> = {
  color: ["background-color", "color"],
  radius: ["border-radius"],
  fontSize: ["font-size"],
  fontFamily: ["font-family"],
  shadow: ["box-shadow"],
};

/** The representative property used to canonicalize a token's probed value, per group. */
export const GROUP_CANON_PROP: Partial<Record<TokenGroup, CssProperty>> = {
  color: "color",
  radius: "border-radius",
  fontSize: "font-size",
  fontFamily: "font-family",
  shadow: "box-shadow",
};

/** property → group (inverse of GROUP_PROPERTY), for routing an element read to the right index bucket. */
export const PROPERTY_GROUP: Record<CssProperty, TokenGroup> = {
  "background-color": "color",
  color: "color",
  "border-radius": "radius",
  "font-size": "fontSize",
  "font-family": "fontFamily",
  "box-shadow": "shadow",
};

export interface TokenValue { token: string; canonical: string; }
export type TokenIndex = Partial<Record<TokenGroup, TokenValue[]>>;
export interface ElementValue { property: CssProperty; group: TokenGroup; canonical: string; }
export interface Match { property: CssProperty; group: TokenGroup; value: string; tokens: string[]; }

const isColorProp = (p: CssProperty) => p === "background-color" || p === "color";

/** Paren-aware comma split (box-shadow layers may contain `rgb(0, 0, 0)`). */
const splitLayers = splitTopLevel;

/** A composed shadow layer with all-zero offsets/blur/spread contributes nothing — drop it. */
function stripEmptyShadowLayers(s: string): string {
  return splitLayers(s)
    .filter((layer) => {
      const noColor = layer
        .replace(/(rgba?|oklch|oklab|hsla?|color|lab|lch)\([^)]*\)/gi, "")
        .replace(/#[0-9a-f]+/gi, "")
        .replace(/\b(transparent|currentcolor)\b/gi, "");
      const lengths = noColor.match(/-?\d*\.?\d+px/g) ?? [];
      return !lengths.every((l) => parseFloat(l) === 0);
    })
    .join(", ");
}

/** Canonicalize a raw computed value to a comparable key, or null to skip (no match for this property). */
export function canonicalize(property: CssProperty, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (isColorProp(property)) {
    const c = parse(v);
    if (!c) return null;
    if (c.alpha !== undefined && c.alpha < 1) return null; // color-mix / transparent → skip
    return formatHex(c); // 8-bit canonical; both rgb- and oklch-serialized inputs collapse here
  }
  if (property === "box-shadow") {
    if (v === "none") return null;
    const stripped = stripEmptyShadowLayers(v);
    return stripped.length ? stripped : null;
  }
  if (property === "font-family") {
    return v.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).join(",");
  }
  // font-size / border-radius: the px string as-is
  return v;
}

/** Pure: element values + token index → grouped matches (all collisions listed). */
export function resolveMatches(elementValues: ElementValue[], index: TokenIndex): Match[] {
  const matches: Match[] = [];
  for (const ev of elementValues) {
    const bucket = index[ev.group] ?? [];
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const tv of bucket) {
      if (tv.canonical === ev.canonical && !seen.has(tv.token)) {
        seen.add(tv.token);
        tokens.push(tv.token);
      }
    }
    if (tokens.length) matches.push({ property: ev.property, group: ev.group, value: ev.canonical, tokens });
  }
  return matches;
}
