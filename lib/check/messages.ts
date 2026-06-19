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
  offTokenScale: (cls: string, family: string, defined: string[]) =>
    `off-token scale step "${cls}" produces no styles — the ${family} scale is ${defined.join("/")}. Use a defined step, or extend the scale in @theme (see design-system.md)`,
  bareDisable: () => `ds-disable needs a reason: /* ds-disable: <why> */`,
} as const;
