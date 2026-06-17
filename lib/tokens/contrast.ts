import { wcagContrast } from "culori";
import type { Token, Theme } from "./types";
import { foregroundFor } from "./schema";

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

/** Secondary/large-text pairs allowed at the AA-large 3:1 threshold. */
const LARGE_OK = new Set(["--muted-foreground"]);

export function contrastResults(tokens: Token[]): PairResult[] {
  const out: PairResult[] = [];
  const bgNames = [...new Set(tokens.map((t) => t.name))].filter((n) => foregroundFor(n));
  for (const theme of ["light", "dark"] as Theme[]) {
    for (const bg of bgNames) {
      const fg = foregroundFor(bg)!;
      const bgv = effective(tokens, bg, theme);
      const fgv = effective(tokens, fg, theme);
      if (!bgv || !fgv) continue;
      const ratio = wcagContrast(fgv, bgv);
      const min = LARGE_OK.has(fg) ? 3.0 : 4.5;
      out.push({ bg, fg, theme, ratio, min, pass: ratio >= min });
    }
  }
  return out;
}
