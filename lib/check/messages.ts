export const MSG = {
  hardcodedColor: (cls: string) =>
    `hardcoded color "${cls}" — use a token utility (bg-<token>/text-<token>) or add a token (see design-system.md), then npm run tokens`,
  arbitraryColor: (cls: string) =>
    `off-token arbitrary color "${cls}" — use a token utility or add a token (see design-system.md)`,
  arbitraryLength: (cls: string) =>
    `hardcoded length "${cls}" — use a token-based utility/value (see design-system.md)`,
  offScaleSpacing: (cls: string) =>
    `off-scale spacing "${cls}" — use a step on the spacing scale (edit lib/check/spacing-steps.ts to extend)`,
  defaultPalette: (cls: string) =>
    `off-token Tailwind palette class "${cls}" — produces no styles; use a token utility (see design-system.md)`,
  bothThemeMissing: (name: string, missingIn: "light" | "dark") =>
    `${name} is missing from ${missingIn === "dark" ? ".dark" : ":root"} — add it to both blocks, then npm run tokens`,
  manifestStale: (file: string) =>
    `${file} is stale — run npm run tokens and commit`,
  catalogUnregistered: (sym: string) =>
    `export ${sym} has no catalog entry — add it to lib/catalog/registry.ts and run npm run catalog`,
  catalogPruned: (sym: string) =>
    `registry lists ${sym} which is not exported — prune lib/catalog/registry.ts and run npm run catalog`,
  catalogStale: () =>
    `design-system.components.md is stale — run npm run catalog and commit`,
  offTokenScale: (cls: string, family: string, defined: string[]) =>
    family === "radius"
      ? `off-token scale step "${cls}" produces no styles — the radius scale is ${defined.join("/")}. To make corners rounder/softer overall, increase --radius in app/globals.css then npm run tokens (it shifts every step); for a one-off, add --radius-<step> to @theme. (see design-system.md)`
      : `off-token scale step "${cls}" produces no styles — the ${family} scale is ${defined.join("/")}. Add the value token to :root then npm run tokens, or use a defined step (see design-system.md)`,
  bareDisable: () => `ds-disable needs a reason: /* ds-disable: <why> */`,
  contrastBelow: (fg: string, bg: string, theme: "light" | "dark", ratio: number, min: number) =>
    `${fg} on ${bg} is ${ratio.toFixed(2)}:1 in ${theme === "dark" ? ".dark" : ":root"} — below the ` +
    `${min}:1 WCAG-AA minimum. In the ${theme === "dark" ? ".dark" : ":root"} block of app/globals.css, ` +
    `move ${fg}'s oklch lightness (L) away from ${bg}'s L (raise L for light text on a dark bg, lower it ` +
    `for dark text on a light bg) until the ratio is ≥ ${min}:1, then npm run tokens.`,
} as const;
