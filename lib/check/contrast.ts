import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { contrastResults } from "@/lib/tokens/contrast";

/** Every measurable fg/bg color pair in globals.css must clear WCAG-AA (4.5, or 3.0 for muted/large).
 *  Pairs with unresolvable/alpha values are skipped upstream in contrastResults (see spec §6 residuals).
 *  A dark finding whose tokens have no OWN .dark declaration (pure light→dark fallback) is suppressed —
 *  both-theme already reports "add it to .dark"; once added, the real dark values get contrast-checked. */
export function checkContrast(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const ownDark = (n: string) => tokens.some((t) => t.name === n && t.theme === "dark");
  return contrastResults(tokens)
    .filter((r) => !r.pass)
    .filter((r) => !(r.theme === "dark" && !ownDark(r.bg) && !ownDark(r.fg)))
    .map((r) => ({
      file: "app/globals.css",
      line: 0,
      rule: "contrast",
      message: MSG.contrastBelow(r.fg, r.bg, r.theme, r.ratio, r.min),
    }));
}
