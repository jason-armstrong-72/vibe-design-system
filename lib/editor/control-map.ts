import type { TokenGroup } from "@/lib/tokens/types";

export const CONTROL_KINDS = [
  "color", "length", "number", "opacity", "select", "duration", "easing", "gradient", "shadow",
] as const;
export type ControlKind = (typeof CONTROL_KINDS)[number];

// UI control per group. Richer/looser than ControlType — easing → curve editor,
// shadow → layered shadow builder, gradient → gradient builder.
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
  shadow: "shadow",
  gradient: "gradient",
};

export function controlKindForGroup(group: TokenGroup): ControlKind {
  return MAP[group];
}
