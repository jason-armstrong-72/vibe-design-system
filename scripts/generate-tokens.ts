import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "../lib/tokens/parse";
import { buildManifest } from "../lib/tokens/generate";

const GLOBALS = resolve("app/globals.css");
const css = readFileSync(GLOBALS, "utf8");
const { json, markdown } = buildManifest(parseTokens(css));

writeFileSync(resolve("design-system.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
writeFileSync(resolve("design-system.md"), markdown, "utf8");

console.log(`tokens: wrote design-system.{json,md} (${json.tokens.length} tokens)`);
