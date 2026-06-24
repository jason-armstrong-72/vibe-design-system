import { resolve } from "node:path";
import { run } from "../lib/check/run";
import { buildBaseline, baselineSavedMessage } from "../lib/check/baseline";
import { atomicWriteFileSync } from "../lib/fs/atomic-write";

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const { findings } = run(); // no baseline → all current findings
const baselineable = findings.filter((f) => f.key !== undefined);
const baseline = buildBaseline(baselineable, today);
atomicWriteFileSync(resolve(".ds-baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
// N = total baseline-able findings (sum of counts), matching "N items"/"N things" in the message.
console.log(baselineSavedMessage(baseline.entries.reduce((s, e) => s + e.count, 0)));
