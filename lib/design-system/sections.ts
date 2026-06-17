import type { Manifest, ManifestToken } from "@/lib/tokens/generate";
import type { TokenGroup } from "@/lib/tokens/types";

export interface Section {
  group: TokenGroup;
  title: string;
  tokens: ManifestToken[];
}

const ORDER: TokenGroup[] = [
  "color", "fontFamily", "fontSize", "lineHeight", "fontWeight",
  "spacing", "radius", "borderWidth", "shadow", "duration", "easing",
  "zIndex", "opacity", "container",
];

const TITLES: Record<TokenGroup, string> = {
  color: "Color", fontFamily: "Font family", fontSize: "Type scale",
  lineHeight: "Line height", fontWeight: "Font weight", spacing: "Spacing",
  radius: "Radius", borderWidth: "Border width", shadow: "Shadow",
  duration: "Duration", easing: "Easing", zIndex: "Z-index",
  opacity: "Opacity", container: "Container",
};

/** Group manifest tokens into ordered, titled sections. Empty groups omitted. */
export function groupedSections(manifest: Manifest): Section[] {
  return ORDER.map((group) => ({
    group,
    title: TITLES[group],
    tokens: manifest.tokens.filter((t) => t.group === group),
  })).filter((s) => s.tokens.length > 0);
}
