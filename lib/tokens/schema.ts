import type { TokenGroup, ControlType } from "./types";

// Semantic color roles (shadcn + status). Ramp/chart handled by prefix below.
export const COLOR_ROLES = new Set([
  "background", "foreground", "card", "card-foreground",
  "popover", "popover-foreground", "primary", "primary-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "success", "success-foreground", "warning", "warning-foreground",
  "info", "info-foreground", "border", "input", "ring",
]);

/** True if a value is a CSS color (the shapes the system stores). */
export function isColorValue(value: string): boolean {
  const v = value.trim();
  return /^(oklch|rgb|rgba|hsl|hsla|color-mix)\(.+\)$/.test(v) || /^#[0-9a-fA-F]{3,8}$/.test(v);
}

/**
 * Classify a token by name (and optionally its value). Known prefixes/roles win first.
 * An UNKNOWN name is accepted as a `color` when its value is a color — this is what makes
 * the extension procedure work: a vibe coder can add `--highlight: oklch(...)` and it
 * classifies as a color with no allowlist edit. An unknown name with a non-color value
 * (or no value) still throws, so genuine drift/typos surface loudly.
 */
export function groupForName(name: string, value?: string): TokenGroup {
  if (!name.startsWith("--")) throw new Error(`unknown token: ${name}`);
  const bare = name.slice(2);

  if (name === "--radius") return "radius";
  if (/^border-width-/.test(bare)) return "borderWidth";
  if (name === "--spacing-base") return "spacing";
  if (/^brand-/.test(bare) || /^chart-/.test(bare)) return "color";
  if (/^gradient-/.test(bare)) return "gradient";
  if (/^font-(sans|mono|serif)$/.test(bare)) return "fontFamily";
  if (/^fs-/.test(bare)) return "fontSize";
  if (/^lh-/.test(bare)) return "lineHeight";
  if (/^fw-/.test(bare)) return "fontWeight";
  if (/^elevation-/.test(bare)) return "shadow";
  if (/^duration-/.test(bare)) return "duration";
  if (/^ease-/.test(bare)) return "easing";
  if (/^z-/.test(bare)) return "zIndex";
  if (/^opacity-/.test(bare)) return "opacity";
  if (/^container-/.test(bare)) return "container";
  if (COLOR_ROLES.has(bare)) return "color";

  // F2: misplaced @theme-namespace names (e.g. an LLM puts `--radius-2xl`/`--text-8xl` in :root) →
  // classify by family rather than crashing the toolchain. These never match real :root tokens
  // (which use --fs-/--lh-/--fw-/--elevation-/--radius); only misplaced ones reach here.
  if (/^radius-/.test(bare)) return "radius";
  if (/^shadow-/.test(bare)) return "shadow";
  if (/^text-/.test(bare)) return "fontSize";
  if (/^font-weight-/.test(bare)) return "fontWeight";

  // unknown name → infer color from value (the extension path); var() references are also
  // valid aliases (e.g. --promo-foreground: var(--foreground)), else it's real drift
  if (value !== undefined && (isColorValue(value) || /^var\(/.test(value))) return "color";

  throw new Error(`unknown token: ${name} (not in naming convention)`);
}

const CONTROL: Record<TokenGroup, ControlType> = {
  color: "color",
  fontFamily: "select",
  fontSize: "length-slider",
  lineHeight: "length-slider",
  fontWeight: "select",
  radius: "length-slider",
  borderWidth: "length-slider",
  shadow: "text",
  duration: "duration-slider",
  easing: "easing",
  spacing: "length-slider",
  zIndex: "number",
  opacity: "opacity-slider",
  container: "length-slider",
  gradient: "text",
};

export function controlForGroup(group: TokenGroup): ControlType {
  return CONTROL[group];
}

/** Foreground roles allowed at the AA-large 3:1 threshold (secondary/large text). */
export const LARGE_OK = new Set(["--muted-foreground"]);

/** WCAG-AA minimum contrast for a pair, keyed on the FOREGROUND token name. */
export function minRatio(fgName: string): number {
  return LARGE_OK.has(fgName) ? 3.0 : 4.5;
}

/** Structural, both-direction contrast partner (presence-checked), or null. Mirrors the gate's pairing:
 *  a base pairs with its `-foreground`; a `-foreground` pairs back with its base; the
 *  `--background`/`--foreground` body pair is explicit (so `--foreground` never strips to `--`). */
export function partnerOf(name: string, present: Set<string>): string | null {
  if (name === "--background") return present.has("--foreground") ? "--foreground" : null;
  if (name === "--foreground") return present.has("--background") ? "--background" : null;
  if (name.endsWith("-foreground")) {
    const base = name.slice(0, -"-foreground".length);
    return present.has(base) ? base : null;
  }
  const fg = `${name}-foreground`;
  return present.has(fg) ? fg : null;
}
