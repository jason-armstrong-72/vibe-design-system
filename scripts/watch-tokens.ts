import { watch } from "chokidar";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "../lib/tokens/parse";
import { buildManifest } from "../lib/tokens/generate";
import { syncThemeMappings } from "../lib/tokens/sync";

const GLOBALS = resolve("app/globals.css");

function regen() {
  try {
    const sync = syncThemeMappings(readFileSync(GLOBALS, "utf8"));
    if (sync.changed) writeFileSync(GLOBALS, sync.css, "utf8");
    const { json, markdown } = buildManifest(parseTokens(sync.css));
    writeFileSync(resolve("design-system.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
    writeFileSync(resolve("design-system.md"), markdown, "utf8");
    console.log(`tokens: regenerated (${json.tokens.length} tokens)${sync.changed ? ` + wired ${sync.added.length} mapping(s)` : ""}`);
  } catch (err) {
    // a transient half-written file (atomic rename should prevent this) — next event recovers
    console.warn("tokens: regen skipped —", (err as Error).message);
  }
}

console.log("tokens: watching app/globals.css");
watch(GLOBALS, { ignoreInitial: true }).on("change", regen);
