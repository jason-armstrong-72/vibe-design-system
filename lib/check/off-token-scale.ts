import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseThemeSteps, type ThemeSteps } from "@/lib/tokens/theme-steps";

export { parseThemeSteps, type ThemeSteps };

const STRING_LIT = /["'`]([^"'`]*)["'`]/g;
const lineOf = (content: string, idx: number) => content.slice(0, idx).split("\n").length;

// Tailwind v4 theme-var-based scale steps per family (the steps the namespace-clear can turn off).
// Verified against tailwindcss v4 theme.css. Safe-omission rule: when unsure, leave a step OUT
// (a missed no-op is acceptable; a wrongly-included static step would false-positive).
const VOCAB: Record<keyof ThemeSteps, Set<string>> = {
  radius: new Set(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]),
  shadow: new Set(["2xs", "xs", "sm", "md", "lg", "xl", "2xl"]),
  text: new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]),
  fontWeight: new Set(["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold", "black"]),
};
const RADIUS_SIDE = "t|r|b|l|tl|tr|bl|br|s|e|ss|se|ee|es";
const reRadius = new RegExp(`^rounded(?:-(?:${RADIUS_SIDE}))?-([a-z0-9]+)$`);
const reShadow = /^shadow-([a-z0-9]+)$/;
const reText = /^text-([a-z0-9]+)$/;
const reFont = /^font-([a-z0-9]+)$/;
const FAMILY_LABEL: Record<keyof ThemeSteps, string> = {
  radius: "radius", shadow: "shadow", text: "text-size", fontWeight: "font-weight",
};

/** Match a (variant-stripped) utility to (family, step), or null if it's not a guarded scale class. */
function classify(util: string): { family: keyof ThemeSteps; step: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = util.match(reRadius))) return { family: "radius", step: m[1] };
  if ((m = util.match(reShadow))) return { family: "shadow", step: m[1] };
  if ((m = util.match(reText))) return { family: "text", step: m[1] };
  if ((m = util.match(reFont))) return { family: "fontWeight", step: m[1] };
  return null;
}

/** Flag named scale-step utilities whose step is in the Tailwind vocab but NOT defined in @theme
 *  (→ silently produce no CSS). Vocab-gated so non-scale utilities (text-center, font-mono) are
 *  never matched; variant-aware (md:hover:rounded-2xl); arbitraries left to arbitrary-tailwind. */
export function checkOffTokenScale(defined: ThemeSteps, path: string, content: string): Finding[] {
  const out: Finding[] = [];
  for (const m of content.matchAll(STRING_LIT)) {
    const line = lineOf(content, m.index!);
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      if (cls.includes("[")) continue; // arbitraries → arbitrary-tailwind's job
      const util = cls.split(":").pop()!; // strip variant chain (md:hover:rounded-2xl → rounded-2xl)
      const hit = classify(util);
      if (!hit) continue;
      if (VOCAB[hit.family].has(hit.step) && !defined[hit.family].has(hit.step)) {
        out.push({
          file: path, line, rule: "off-token-scale",
          message: MSG.offTokenScale(cls, FAMILY_LABEL[hit.family], [...defined[hit.family]]),
        });
      }
    }
  }
  return out;
}
