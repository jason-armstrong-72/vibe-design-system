import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "./types";
import { walkSource } from "./files";
import { applySuppressions, bareDisableFindings } from "./ds-disable";
import { checkHardcodedColor } from "./hardcoded-color";
import { checkArbitrary } from "./arbitrary-tailwind";
import { checkBothTheme } from "./both-theme";
import { checkManifestFresh } from "./manifest-fresh";
import { checkOffTokenScale, parseThemeSteps } from "./off-token-scale";

const SOURCE_ROOTS = ["app", "components"]; // product/UI surface. NOT lib/ (template machinery that
// legitimately handles color strings — e.g. lib/tokens/generate.ts's doc example, lib/editor/oklch.ts's
// "#000000" fallback — would false-flag; the realistic drift is in app/components JSX).
const EXTS = [".ts", ".tsx", ".css"];
const EXCLUDE_DIRS = ["ui"]; // components/ui (vendored shadcn) — by dir name under components
const EXCLUDE_FILES = ["app/globals.css", "components/editor/editor-chrome.css"];
// themes/*.css aren't under SOURCE_ROOTS, so not walked. both-theme/manifest read globals directly.

export function run(): { findings: Finding[]; disableCount: number } {
  const all: Finding[] = [];
  let disableCount = 0;
  const globals = readFileSync(resolve("app/globals.css"), "utf8");
  const definedSteps = parseThemeSteps(globals);
  for (const f of walkSource(SOURCE_ROOTS, EXTS, { excludeDirs: EXCLUDE_DIRS, excludeFiles: EXCLUDE_FILES })) {
    const raw = [
      ...checkHardcodedColor(f.path, f.content),
      ...checkArbitrary(f.path, f.content),
      ...checkOffTokenScale(definedSteps, f.path, f.content),
    ];
    const [kept, n] = applySuppressions(raw, f.content);
    disableCount += n;
    all.push(...kept, ...bareDisableFindings(f.path, f.content));
  }
  all.push(...checkBothTheme(globals));
  all.push(...checkManifestFresh(
    globals,
    readFileSync(resolve("design-system.json"), "utf8"),
    readFileSync(resolve("design-system.md"), "utf8"),
  ));
  return { findings: all, disableCount };
}
