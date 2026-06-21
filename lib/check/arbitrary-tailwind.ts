import type { Finding } from "./types";
import { MSG } from "./messages";
import { ALLOWED_SPACING_STEPS } from "./spacing-steps";

const STRING_LIT = /["'`]([^"'`]*)["'`]/g; // candidate class strings
const SPACING = "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y";
const PALETTES = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const reArbitrary = /^-?[a-z][a-z-]*-\[([^\]]*)\]$/;
const reArbColorPrefix = /^-?(bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|caret|accent|shadow)-\[/;
const reArbLengthPrefix = new RegExp(`^-?(?:text|leading|${SPACING})-\\[`);
const reSpacingNum = new RegExp(`^-?(?:${SPACING})-(\\d+(?:\\.\\d+)?)$`);
const rePalette = new RegExp(`^-?(?:bg|border|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|ring-offset)-(?:${PALETTES})-\\d{2,3}$`);

const lineOf = (content: string, idx: number) => content.slice(0, idx).split("\n").length;

/** Strip leading variant segments (md:, hover:, dark:, stacked) to the base utility. Bracket-aware:
 *  only colons BEFORE the first "[" are variant separators (arbitrary values can contain ":", e.g.
 *  bg-[url(http://x)]). Canonical variant-stripper — off-token-scale.ts uses a simpler split(":").pop(). */
function baseUtil(cls: string): string {
  const br = cls.indexOf("[");
  const scan = br === -1 ? cls : cls.slice(0, br);
  const lastColon = scan.lastIndexOf(":");
  return lastColon === -1 ? cls : cls.slice(lastColon + 1);
}

export function checkArbitrary(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  for (const m of content.matchAll(STRING_LIT)) {
    const line = lineOf(content, m.index!);
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      const base = baseUtil(cls); // match on the base utility, report the original cls
      const arb = base.match(reArbitrary);
      if (arb) {
        const inner = arb[1];
        if (/var\(|color-mix\(|calc\(|min\(|max\(|clamp\(/.test(inner)) continue; // token/computed → allowed
        if (reArbColorPrefix.test(base) && /^(#|rgba?\(|hsla?\(|oklch\(|oklab\()/.test(inner))
          out.push({ file: path, line, rule: "arbitrary-color", message: MSG.arbitraryColor(cls) });
        else if (reArbLengthPrefix.test(base) && /^\d*\.?\d+(px|rem|em|%)$/.test(inner))
          out.push({ file: path, line, rule: "arbitrary-length", message: MSG.arbitraryLength(cls) });
        continue; // other arbitraries (layout/size) allowed
      }
      const sp = base.match(reSpacingNum);
      if (sp && !ALLOWED_SPACING_STEPS.has(Number(sp[1]))) {
        out.push({ file: path, line, rule: "off-scale-spacing", message: MSG.offScaleSpacing(cls) });
        continue;
      }
      if (rePalette.test(base))
        out.push({ file: path, line, rule: "default-palette", message: MSG.defaultPalette(cls) });
    }
  }
  return out;
}
