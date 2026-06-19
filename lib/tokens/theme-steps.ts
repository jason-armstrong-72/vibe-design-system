export type ThemeSteps = { radius: Set<string>; shadow: Set<string>; text: Set<string>; fontWeight: Set<string> };

/** Canonical radius scale order (Tailwind v4 theme-var steps) — for stable manifest ordering. */
export const RADIUS_STEP_ORDER = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

/** Read the steps actually defined in the `@theme inline` block of globals.css.
 *  Source of truth for "what compiles". Anchors on `@theme inline` (a comment may mention "@theme"
 *  earlier); step is [a-z0-9]+ ended by a single `:` so `--text-xs--line-height:` does NOT match. */
export function parseThemeSteps(globalsCss: string): ThemeSteps {
  const start = globalsCss.indexOf("@theme inline");
  const block = start === -1 ? "" : globalsCss.slice(start, globalsCss.indexOf("\n}", start));
  const out: ThemeSteps = { radius: new Set(), shadow: new Set(), text: new Set(), fontWeight: new Set() };
  const key = { radius: "radius", shadow: "shadow", "font-weight": "fontWeight", text: "text" } as const;
  for (const m of block.matchAll(/--(radius|shadow|font-weight|text)-([a-z0-9]+)\s*:/g)) {
    out[key[m[1] as keyof typeof key]].add(m[2]);
  }
  return out;
}
