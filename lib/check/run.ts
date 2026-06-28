import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "./types";
import { walkSource } from "./files";
import { checkCatalogFresh } from "./catalog-fresh";
import { applySuppressions, bareDisableFindings } from "./ds-disable";
import { checkHardcodedColor } from "./hardcoded-color";
import { checkArbitrary } from "./arbitrary-tailwind";
import { checkBothTheme } from "./both-theme";
import { checkContrast } from "./contrast";
import { checkManifestFresh } from "./manifest-fresh";
import { checkOffTokenScale } from "./off-token-scale";
import { applyBaseline, type Baseline, type BaselineEntry } from "./baseline";
import { parseThemeSteps } from "@/lib/tokens/theme-steps";

const SOURCE_ROOTS = ["app", "components"]; // product/UI surface. NOT lib/ (template machinery that
// legitimately handles color strings — e.g. lib/tokens/generate.ts's doc example, lib/editor/oklch.ts's
// "#000000" fallback — would false-flag; the realistic drift is in app/components JSX).
const EXTS = [".ts", ".tsx", ".css"];
const EXCLUDE_DIRS = ["ui"]; // components/ui (vendored shadcn) — by dir name under components
const EXCLUDE_FILES = ["app/globals.css", "components/editor/editor-chrome.css"];
// themes/*.css aren't under SOURCE_ROOTS, so not walked. both-theme/manifest read globals directly.

export function run(baseline?: Baseline): {
  findings: Finding[];
  disableCount: number;
  baselineSuppressed: number; // 0 when no baseline
  staleEntries: BaselineEntry[]; // [] when no baseline
} {
  const source: Finding[] = []; // per-file check findings — baseline-able
  const bareDisables: Finding[] = []; // never baseline-able (D5)
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
    source.push(...kept);
    bareDisables.push(...bareDisableFindings(f.path, f.content));
  }

  let kept = source;
  let baselineSuppressed = 0;
  let staleEntries: BaselineEntry[] = [];
  if (baseline) ({ kept, suppressed: baselineSuppressed, staleEntries } = applyBaseline(source, baseline));

  // components/ui is walk-excluded (vendored), so read it directly for the catalog gate.
  const uiDir = resolve("components/ui");
  const uiFiles = readdirSync(uiDir)
    .filter((n) => n.endsWith(".tsx"))
    .map((n) => ({ path: `components/ui/${n}`, content: readFileSync(resolve(uiDir, n), "utf8") }));

  const system = [
    ...checkBothTheme(globals),
    ...checkContrast(globals),
    ...checkManifestFresh(
      globals,
      readFileSync(resolve("design-system.json"), "utf8"),
      readFileSync(resolve("design-system.md"), "utf8"),
    ),
    ...checkCatalogFresh(uiFiles, readFileSync(resolve("design-system.components.md"), "utf8")),
  ];
  return { findings: [...kept, ...bareDisables, ...system], disableCount, baselineSuppressed, staleEntries };
}
