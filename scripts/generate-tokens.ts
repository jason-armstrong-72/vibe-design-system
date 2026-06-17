import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "../lib/tokens/parse";
import { buildManifest } from "../lib/tokens/generate";
import { syncThemeColorMappings } from "../lib/tokens/sync";

const GLOBALS = resolve("app/globals.css");

// 1. auto-wire @theme color mappings for any newly-added color tokens (one-step extension)
const sync = syncThemeColorMappings(readFileSync(GLOBALS, "utf8"));
if (sync.changed) {
  writeFileSync(GLOBALS, sync.css, "utf8");
  console.log(`tokens: wired ${sync.added.length} new @theme mapping(s): ${sync.added.join(", ")}`);
}

// 2. regenerate the manifest from the (now-synced) source of truth
const { json, markdown } = buildManifest(parseTokens(sync.css));
writeFileSync(resolve("design-system.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
writeFileSync(resolve("design-system.md"), markdown, "utf8");

console.log(`tokens: wrote design-system.{json,md} (${json.tokens.length} tokens)`);
