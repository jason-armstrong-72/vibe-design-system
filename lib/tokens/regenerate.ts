import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "./parse";
import { buildManifest } from "./generate";
import { syncThemeMappings } from "./sync";
import { parseThemeSteps, RADIUS_STEP_ORDER } from "./theme-steps";

/** Defined @theme radius steps in canonical scale order (for the manifest's radius utility list). */
export function radiusStepsFrom(css: string): string[] {
  return [...parseThemeSteps(css).radius].sort(
    (a, b) => RADIUS_STEP_ORDER.indexOf(a) - RADIUS_STEP_ORDER.indexOf(b),
  );
}

/** Sync @theme mappings for any new colour/scale tokens, then regenerate the manifest. */
export function syncAndGenerate(globalsPath = resolve("app/globals.css")): void {
  const sync = syncThemeMappings(readFileSync(globalsPath, "utf8"));
  if (sync.changed) {
    writeFileSync(globalsPath, sync.css, "utf8");
    console.log(`tokens: wired ${sync.added.length} new @theme mapping(s): ${sync.added.join(", ")}`);
  }
  for (const w of sync.warnings) console.warn(`tokens: ${w}`);
  const { json, markdown } = buildManifest(parseTokens(sync.css), "app/globals.css", radiusStepsFrom(sync.css));
  writeFileSync(resolve("design-system.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
  writeFileSync(resolve("design-system.md"), markdown, "utf8");
  console.log(`tokens: wrote design-system.{json,md} (${json.tokens.length} tokens)`);
}
