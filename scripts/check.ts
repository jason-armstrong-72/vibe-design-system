import { run } from "../lib/check/run";

const { findings, disableCount } = run();
if (findings.length === 0) {
  console.log(`✓ design-system check passed${disableCount ? ` (${disableCount} ds-disable in use)` : ""}`);
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
process.exit(1);
