import type { TokenGroup } from "@/lib/tokens/types";

export const CONTROL_KINDS = [
  "color", "length", "number", "opacity", "select", "duration", "easing", "text", "gradient",
] as const;
export type ControlKind = (typeof CONTROL_KINDS)[number];

// UI control per group. Richer/looser than ControlType — easing/shadow use v1 fallbacks
// (rich curve editor + layered shadow builder are fast-follow, spec §7).
const MAP: Record<TokenGroup, ControlKind> = {
  color: "color",
  fontFamily: "select",
  fontWeight: "select",
  fontSize: "length",
  lineHeight: "length",
  radius: "length",
  borderWidth: "length",
  spacing: "length",
  container: "length",
  zIndex: "number",
  opacity: "opacity",
  duration: "duration",
  easing: "easing",
  shadow: "text",
  gradient: "gradient",
};

export function controlKindForGroup(group: TokenGroup): ControlKind {
  return MAP[group];
}
