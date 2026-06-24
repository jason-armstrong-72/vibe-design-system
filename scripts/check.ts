import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "../lib/check/run";
import type { Baseline } from "../lib/check/baseline";

const BASELINE_PATH = resolve(".ds-baseline.json");
let baseline: Baseline | undefined;
if (existsSync(BASELINE_PATH)) {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
    if (parsed?.version !== 1 || !Array.isArray(parsed.entries)) throw new Error("bad shape");
    baseline = parsed as Baseline;
  } catch (e) {
    console.error(`✖ .ds-baseline.json is unreadable (${(e as Error).message}) — regenerate with npm run check:baseline`);
    process.exit(1);
  }
}

const { findings, disableCount, baselineSuppressed, staleEntries } = run(baseline);

const staleWarn = () => {
  if (staleEntries.length)
    console.error(
      `⚠ ${staleEntries.length} baseline entr${staleEntries.length === 1 ? "y" : "ies"} no longer match — run npm run check:baseline to prune`,
    );
};

if (findings.length === 0) {
  const bits = [
    baselineSuppressed ? `${baselineSuppressed} baselined` : "",
    disableCount ? `${disableCount} ds-disable in use` : "",
  ].filter(Boolean);
  console.log(`✓ design-system check passed${bits.length ? ` (${bits.join(", ")})` : ""}`);
  staleWarn();
  process.exit(0);
}

const byFile = new Map<string, typeof findings>();
for (const f of findings) (byFile.get(f.file) ?? byFile.set(f.file, []).get(f.file)!).push(f);
console.error(`✖ design-system check: ${findings.length} problem(s)\n`);
for (const [file, fs] of byFile) {
  console.error(file);
  for (const f of fs) console.error(`  ${f.line ? f.line + ":" : ""} [${f.rule}] ${f.message}`);
  console.error("");
}
staleWarn();
process.exit(1);
