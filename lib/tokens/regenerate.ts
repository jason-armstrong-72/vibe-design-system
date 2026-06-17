import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "./parse";
import { buildManifest } from "./generate";
import { syncThemeColorMappings } from "./sync";

/** Sync @theme color mappings for any new colors, then regenerate the manifest. */
export function syncAndGenerate(globalsPath = resolve("app/globals.css")): void {
  const sync = syncThemeColorMappings(readFileSync(globalsPath, "utf8"));
  if (sync.changed) {
    writeFileSync(globalsPath, sync.css, "utf8");
    console.log(`tokens: wired ${sync.added.length} new @theme mapping(s): ${sync.added.join(", ")}`);
  }
  const { json, markdown } = buildManifest(parseTokens(sync.css));
  writeFileSync(resolve("design-system.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
  writeFileSync(resolve("design-system.md"), markdown, "utf8");
  console.log(`tokens: wrote design-system.{json,md} (${json.tokens.length} tokens)`);
}
