import { wcagContrast } from "culori";
import type { Token, Theme } from "./types";
import { isColorValue, minRatio, partnerOf } from "./schema";

export interface PairResult {
  bg: string;
  fg: string;
  theme: Theme;
  ratio: number;
  min: number;
  pass: boolean;
}

/** Resolve a token's effective value for a theme: dark falls back to light if not overridden. */
function effective(tokens: Token[], name: string, theme: Theme): string | undefined {
  if (theme === "dark") {
    const d = tokens.find((t) => t.name === name && t.theme === "dark");
    if (d) return d.value;
  }
  return tokens.find((t) => t.name === name && t.theme === "light")?.value;
}

/** A value we can statically measure: a literal, opaque color. var()/color-mix()/calc() are
 *  unresolvable here; alpha makes wcagContrast meaningless (culori ignores it → bogus 21:1). */
export function measurable(v: string | undefined): boolean {
  return !!v && isColorValue(v) && !v.startsWith("color-mix") && !/\/\s*[\d.]/.test(v);
}

export function contrastResults(tokens: Token[]): PairResult[] {
  const out: PairResult[] = [];
  const names = [...new Set(tokens.map((t) => t.name))];
  const present = new Set(names);
  // Build pairs via the shared structural partnerOf (bases only; the reverse direction is the base's
  // job, so iterating bases avoids double-pairing). partnerOf("--background") returns "--foreground".
  const pairs: Array<[string, string]> = [];
  for (const name of names) {
    if (name.endsWith("-foreground")) continue;
    const fg = partnerOf(name, present);
    if (fg) pairs.push([name, fg]);
  }
  for (const theme of ["light", "dark"] as Theme[]) {
    for (const [bg, fg] of pairs) {
      const bgv = effective(tokens, bg, theme);
      const fgv = effective(tokens, fg, theme);
      if (!measurable(bgv) || !measurable(fgv)) continue; // skip unresolvable/alpha (no throw, no false pass)
      const ratio = wcagContrast(fgv!, bgv!);
      const min = minRatio(fg);
      out.push({ bg, fg, theme, ratio, min, pass: ratio >= min });
    }
  }
  return out;
}
