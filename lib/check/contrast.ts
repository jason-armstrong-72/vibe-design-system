import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { contrastResults } from "@/lib/tokens/contrast";

/** Every measurable fg/bg color pair in globals.css must clear WCAG-AA (4.5, or 3.0 for muted/large).
 *  Pairs with unresolvable/alpha values are skipped upstream in contrastResults (see spec §6 residuals). */
export function checkContrast(globalsCss: string): Finding[] {
  return contrastResults(parseTokens(globalsCss))
    .filter((r) => !r.pass)
    .map((r) => ({
      file: "app/globals.css",
      line: 0,
      rule: "contrast",
      message: MSG.contrastBelow(r.fg, r.bg, r.theme, r.ratio, r.min),
    }));
}
