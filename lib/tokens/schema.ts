import type { TokenGroup, ControlType } from "./types";

// Semantic color roles (shadcn + status). Ramp/chart handled by prefix below.
const COLOR_ROLES = new Set([
  "background", "foreground", "card", "card-foreground",
  "popover", "popover-foreground", "primary", "primary-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "success", "success-foreground", "warning", "warning-foreground",
  "info", "info-foreground", "border", "input", "ring",
]);

export function groupForName(name: string): TokenGroup {
  if (!name.startsWith("--")) throw new Error(`unknown token: ${name}`);
  const bare = name.slice(2);

  if (name === "--radius") return "radius";
  if (/^border-width-/.test(bare)) return "borderWidth";
  if (name === "--spacing-base") return "spacing";
  if (/^brand-/.test(bare) || /^chart-/.test(bare)) return "color";
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
};

export function controlForGroup(group: TokenGroup): ControlType {
  return CONTROL[group];
}

/** The -foreground partner of a bg color token, or null if none / if this IS a foreground. */
export function foregroundFor(name: string): string | null {
  if (name.endsWith("-foreground")) return null;
  const bare = name.slice(2);
  return COLOR_ROLES.has(`${bare}-foreground`) ? `${name}-foreground` : null;
}
