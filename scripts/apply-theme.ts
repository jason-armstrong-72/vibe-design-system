import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { applyTheme } from "../lib/tokens/apply-theme";
import { syncAndGenerate } from "../lib/tokens/regenerate";

const name = process.argv[2];
if (!name) {
  console.error("usage: npm run theme <name>   (e.g. neutral | swiss | brutalist)");
  process.exit(1);
}

const themePath = resolve(`themes/${name}.css`);
if (!existsSync(themePath)) {
  console.error(`theme not found: themes/${name}.css`);
  process.exit(1);
}

const GLOBALS = resolve("app/globals.css");
const out = applyTheme(readFileSync(GLOBALS, "utf8"), readFileSync(themePath, "utf8"));

// atomic write (Next watcher never sees a half-written file), mirroring lib/tokens/write.ts
const tmp = `${GLOBALS}.tmp`;
writeFileSync(tmp, out, "utf8");
renameSync(tmp, GLOBALS);

syncAndGenerate(GLOBALS);
console.log(`theme: applied "${name}" → app/globals.css`);
