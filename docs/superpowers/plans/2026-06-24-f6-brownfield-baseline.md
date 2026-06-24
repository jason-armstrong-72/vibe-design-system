# F6 Brownfield Baseline Mode — Implementation Plan

> **For agentic workers:** REQUIRED: execute with superpowers:executing-plans **in-session** (this project's rule — TDD, commit per task, NOT via subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `.ds-baseline.json` snapshot so adopters bringing the template onto an existing codebase aren't flooded red — the gate suppresses pre-existing per-file debt and fails only on new violations.

**Architecture:** A pure `lib/check/baseline.ts` (keyOf / buildBaseline / applyBaseline) keyed on the **offending token** (a new stable `Finding.key`, never the prose message). `run()` partitions findings by provenance — only per-file source-check findings are baseline-able; the three globals.css system checks and bare `ds-disable` findings always hard-fail. `scripts/check.ts` loads the file if present and applies it; a new `scripts/check-baseline.ts` writes it via a shared `lib/fs/atomic-write.ts`. Warn-only on stale entries. Plus a hardened AGENTS.md anti-self-baselining directive and a README adoption section.

**Tech Stack:** TypeScript, tsx scripts, vitest. No new deps.

**Spec:** [docs/superpowers/specs/2026-06-24-f6-brownfield-baseline-design.md](../specs/2026-06-24-f6-brownfield-baseline-design.md)

**Prereqs:** on branch `f6-brownfield-baseline` (already created; spec committed). Baseline green: `npm test` = 476 pass.

---

## File structure (decomposition)

| File | Responsibility | Task |
|---|---|---|
| `lib/check/types.ts` | add `key?: string` (stable baseline identity) to `Finding` | 1 |
| `lib/check/hardcoded-color.ts` | populate `key` on its 3 emit sites | 1 |
| `lib/check/arbitrary-tailwind.ts` | populate `key` on its 4 emit sites | 1 |
| `lib/check/off-token-scale.ts` | populate `key` on its 1 emit site | 1 |
| `lib/fs/atomic-write.ts` | **new** — shared `atomicWriteFileSync` (rule-of-three) | 2 |
| `scripts/apply-theme.ts` | use the shared helper (becomes 3rd caller) | 2 |
| `lib/check/baseline.ts` | **new** — `Baseline`/`BaselineEntry` types, `keyOf`, `buildBaseline`, `applyBaseline`, message constant | 3 |
| `lib/check/run.ts` | partition by provenance + optional `baseline` param + return fields | 4 |
| `scripts/check-baseline.ts` | **new** — write the snapshot + print the locked message | 5 |
| `package.json` | `check:baseline` script | 5 |
| `scripts/check.ts` | load `.ds-baseline.json` if present, apply, print suppressed/stale | 6 |
| `AGENTS.md` | brownfield directive inside the `design-system` block | 7 |
| `README.md` | "Adopting on an existing codebase?" section | 7 |
| `tests/check/baseline.test.ts` | unit + integration + locked-message drift guard | 3,4,8 |

---

## Task 1: `Finding.key` — the stable baseline identity

**Files:**
- Modify: `lib/check/types.ts`
- Modify: `lib/check/hardcoded-color.ts:23,25,28`
- Modify: `lib/check/arbitrary-tailwind.ts:39,41,46,50`
- Modify: `lib/check/off-token-scale.ts:51-54`
- Test: `tests/check/key-field.test.ts`

The offending token is the line-insensitive identity baseline keys on. Every **baseline-able** finding sets `key`; system checks and bare-disable leave it undefined.

- [ ] **Step 1: Write the failing test**

```ts
// tests/check/key-field.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";
import { checkOffTokenScale, parseThemeSteps } from "@/lib/check/off-token-scale";

describe("Finding.key = offending token (baseline identity)", () => {
  it("hardcoded-color key is the literal value", () => {
    const f = checkHardcodedColor("a.tsx", `const x = "#3b82f6";`);
    expect(f[0].key).toBe("#3b82f6");
  });
  it("arbitrary/palette key is the class", () => {
    // p-13 is OFF-scale (p-7 is an allowed step → no finding). Mirrors tests/check/arbitrary-tailwind.test.ts.
    const f = checkArbitrary("a.tsx", `<div className="bg-[#fff] text-gray-500 p-13" />`);
    const keys = f.map((x) => x.key).sort();
    expect(keys).toEqual(["bg-[#fff]", "p-13", "text-gray-500"].sort());
  });
  it("off-token-scale key is the class only (NOT the message with the scale list)", () => {
    const steps = parseThemeSteps(`@theme inline { --radius-sm: 1px; }`);
    const f = checkOffTokenScale(steps, "a.tsx", `<div className="rounded-3xl" />`);
    expect(f[0].key).toBe("rounded-3xl");
    expect(f[0].message).toContain("rounded-3xl"); // message still rich for humans
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/check/key-field.test.ts`
Expected: FAIL (`key` is `undefined`).

- [ ] **Step 3: Implement**

`lib/check/types.ts` — add the field:

```ts
export interface Finding {
  file: string;
  line: number; // 1-based; 0 = whole-file (not line-suppressible)
  rule: string;
  message: string; // human display (includes the fix); may embed variable content
  key?: string; // stable baseline identity: the offending token only. Absent → not baseline-able.
}
```

`lib/check/hardcoded-color.ts` — add `key` to each push:
```ts
out.push({ file: path, line: i + 1, rule: "hardcoded-color", key: hex[0], message: MSG.hardcodedColor(hex[0]) });
// ...fn[0]...
out.push({ file: path, line: i + 1, rule: "hardcoded-color", key: fn[0], message: MSG.hardcodedColor(fn[0]) });
// ...kw[2]...
out.push({ file: path, line: i + 1, rule: "hardcoded-color", key: kw[2], message: MSG.hardcodedColor(kw[2]) });
```

`lib/check/arbitrary-tailwind.ts` — add `key: cls` to all four pushes (arbitrary-color, arbitrary-length, off-scale-spacing, default-palette).

`lib/check/off-token-scale.ts` — add `key: cls` to the push:
```ts
out.push({ file: path, line, rule: "off-token-scale", key: cls,
  message: MSG.offTokenScale(cls, FAMILY_LABEL[hit.family], [...defined[hit.family]]) });
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run tests/check/key-field.test.ts` → PASS.

- [ ] **Step 5: Regression — full suite still green**

Run: `npm test` → 476 + new pass (existing checks unaffected; `key` is additive).

- [ ] **Step 6: Commit**

```bash
git add lib/check/types.ts lib/check/hardcoded-color.ts lib/check/arbitrary-tailwind.ts lib/check/off-token-scale.ts tests/check/key-field.test.ts
git commit -m "feat(check): add stable Finding.key (offending token) for baseline identity"
```

---

## Task 2: shared atomic-write helper

**Files:**
- Create: `lib/fs/atomic-write.ts`
- Modify: `scripts/apply-theme.ts:1,21-24`
- Test: `tests/fs/atomic-write.test.ts`

Removes the rule-of-three duplication (`write.ts` async + `apply-theme.ts` sync → baseline would be the 3rd). `lib/tokens/write.ts` is async/postcss-specific — left alone.

- [ ] **Step 1: Write the failing test**

```ts
// tests/fs/atomic-write.test.ts
// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { atomicWriteFileSync } from "@/lib/fs/atomic-write";

const P = "tmp-atomic-test.txt";
afterEach(() => { for (const f of [P, `${P}.tmp`]) if (existsSync(f)) rmSync(f); });

describe("atomicWriteFileSync", () => {
  it("writes content and leaves no temp file", () => {
    atomicWriteFileSync(P, "hello");
    expect(readFileSync(P, "utf8")).toBe("hello");
    expect(existsSync(`${P}.tmp`)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/fs/atomic-write.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/fs/atomic-write.ts
import { writeFileSync, renameSync } from "node:fs";

/** Write via temp-then-rename so a reader/watcher never sees a half-written file.
 *  Sync (build-time scripts). lib/tokens/write.ts keeps its own async postcss variant. */
export function atomicWriteFileSync(path: string, data: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, path);
}
```

`scripts/apply-theme.ts` — replace lines 21-24:
```ts
import { atomicWriteFileSync } from "../lib/fs/atomic-write";
// ...
// atomic write (Next watcher never sees a half-written file)
atomicWriteFileSync(GLOBALS, out);
```
(Drop the now-unused `writeFileSync, renameSync` from its `node:fs` import; keep `readFileSync, existsSync`.)

- [ ] **Step 4: Run — verify**

Run: `npx vitest run tests/fs/atomic-write.test.ts` → PASS.
Run: `npm run theme neutral` → "theme: applied "neutral""; `git diff --stat app/globals.css` shows it still round-trips (revert any churn: `git checkout app/globals.css design-system.json design-system.md` ONLY if dirty — but prefer `git stash`/manual; this is the main session's tree).

> Note: avoid `git checkout` of unrelated paths in a shared tree (orphan hazard). If `npm run theme neutral` dirties globals/manifest, restore with `git restore <those paths>` after confirming they're identical to HEAD.

- [ ] **Step 5: Commit**

```bash
git add lib/fs/atomic-write.ts scripts/apply-theme.ts tests/fs/atomic-write.test.ts
git commit -m "refactor(fs): extract shared atomicWriteFileSync; use in apply-theme"
```

---

## Task 3: `lib/check/baseline.ts` (pure core)

**Files:**
- Create: `lib/check/baseline.ts`
- Test: `tests/check/baseline.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/check/baseline.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { keyOf, buildBaseline, applyBaseline, baselineSavedMessage } from "@/lib/check/baseline";
import type { Finding } from "@/lib/check/types";

const F = (file: string, rule: string, key: string, line = 1): Finding =>
  ({ file, line, rule, key, message: `${rule} ${key}` });

describe("keyOf", () => {
  it("is line-insensitive, identity over (file,rule,key)", () => {
    expect(keyOf(F("a.tsx", "hardcoded-color", "#fff", 1)))
      .toBe(keyOf(F("a.tsx", "hardcoded-color", "#fff", 99)));
  });
  it("distinguishes different values", () => {
    expect(keyOf(F("a.tsx", "hardcoded-color", "#fff")))
      .not.toBe(keyOf(F("a.tsx", "hardcoded-color", "#000")));
  });
});

describe("buildBaseline", () => {
  it("collapses duplicates to counts and sorts deterministically", () => {
    const b = buildBaseline([F("b.tsx","default-palette","text-gray-500"),
      F("a.tsx","hardcoded-color","#fff"), F("a.tsx","hardcoded-color","#fff")], "2026-06-24");
    expect(b.version).toBe(1);
    expect(b.entries).toEqual([
      { file: "a.tsx", rule: "hardcoded-color", key: "#fff", count: 2 },
      { file: "b.tsx", rule: "default-palette", key: "text-gray-500", count: 1 },
    ]);
  });
  it("excludes findings without a key", () => {
    const noKey: Finding = { file: "g.css", line: 0, rule: "both-theme", message: "x" };
    expect(buildBaseline([noKey], "2026-06-24").entries).toEqual([]);
  });
});

describe("applyBaseline", () => {
  const findings = [F("a.tsx","hardcoded-color","#fff"), F("a.tsx","hardcoded-color","#fff")];
  const baseline = buildBaseline(findings, "2026-06-24");

  it("round-trip: same findings → all suppressed, no stale", () => {
    const r = applyBaseline(findings, baseline);
    expect(r.kept).toEqual([]);
    expect(r.suppressed).toBe(2);
    expect(r.staleEntries).toEqual([]);
  });
  it("(count+1)-th identical finding is kept (new)", () => {
    const r = applyBaseline([...findings, F("a.tsx","hardcoded-color","#fff")], baseline);
    expect(r.kept).toHaveLength(1);
    expect(r.suppressed).toBe(2);
  });
  it("a genuinely new value is kept", () => {
    const r = applyBaseline([...findings, F("a.tsx","hardcoded-color","#abc")], baseline);
    expect(r.kept.map((f) => f.key)).toEqual(["#abc"]);
  });
  it("fixed debt → stale entry reported, never fails", () => {
    const r = applyBaseline([F("a.tsx","hardcoded-color","#fff")], baseline); // 1 of 2 remains
    expect(r.kept).toEqual([]);
    expect(r.staleEntries).toEqual([{ file: "a.tsx", rule: "hardcoded-color", key: "#fff", count: 2 }]);
  });
  it("findings without a key pass through untouched", () => {
    const noKey: Finding = { file: "x.tsx", line: 0, rule: "ds-disable", message: "x" };
    expect(applyBaseline([noKey], baseline).kept).toEqual([noKey]);
  });
});

describe("baselineSavedMessage (locked copy — drift guard)", () => {
  it("contains the locked phrase and the count", () => {
    const m = baselineSavedMessage(7);
    expect(m).toContain("recorded them as your starting point");
    expect(m).toContain("7");
    expect(m).toContain("only NEW code gets checked");
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/check/baseline.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/check/baseline.ts
import type { Finding } from "./types";

export interface BaselineEntry { file: string; rule: string; key: string; count: number; }
export interface Baseline { version: 1; generated: string; entries: BaselineEntry[]; }

/** Stable identity used by BOTH the writer and the filter. Single source of truth. */
export function keyOf(f: Finding): string {
  return `${f.file} ${f.rule} ${f.key}`;
}

/** Snapshot the current baseline-able findings (those with a defined key). Sorted, deduped→counts. */
export function buildBaseline(findings: Finding[], generated: string): Baseline {
  const counts = new Map<string, BaselineEntry>();
  for (const f of findings) {
    if (f.key === undefined) continue;
    const k = keyOf(f);
    const e = counts.get(k);
    if (e) e.count++;
    else counts.set(k, { file: f.file, rule: f.rule, key: f.key, count: 1 });
  }
  const entries = [...counts.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.key.localeCompare(b.key),
  );
  return { version: 1, generated, entries };
}

/** Filter source findings against a baseline. Suppress up to each entry's count; the (count+1)-th is
 *  kept (new). staleEntries = entries whose recorded count exceeds the actual match count. */
export function applyBaseline(
  findings: Finding[],
  baseline: Baseline,
): { kept: Finding[]; suppressed: number; staleEntries: BaselineEntry[] } {
  const budget = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const e of baseline.entries) budget.set(`${e.file} ${e.rule} ${e.key}`, e.count);
  const kept: Finding[] = [];
  let suppressed = 0;
  for (const f of findings) {
    if (f.key === undefined) { kept.push(f); continue; }
    const k = keyOf(f);
    const remaining = budget.get(k) ?? 0;
    const used = seen.get(k) ?? 0;
    if (used < remaining) { seen.set(k, used + 1); suppressed++; }
    else kept.push(f);
  }
  const staleEntries = baseline.entries.filter(
    (e) => (seen.get(`${e.file} ${e.rule} ${e.key}`) ?? 0) < e.count,
  );
  return { kept, suppressed, staleEntries };
}

/** Locked human-facing message printed by `npm run check:baseline` (see spec §7). */
export function baselineSavedMessage(n: number): string {
  return `✓ Saved a snapshot of your existing code (${n} items).

We found ${n} things in your current code that don't follow the design
system's conventions yet — different colors, sizes, that sort of thing.
That's expected: they were written before you added the design system.
We've recorded them as your starting point, so you don't have to fix
anything to get going.

From here on, only NEW code gets checked against the design system, so
everything you build from now on stays consistent with it.

Your existing code is left exactly as it is and keeps working. If you'd
like to bring it in line with the design system too, you can update it
yourself — automatically converting old code isn't part of this template
yet. More in the README.`;
}
```

- [ ] **Step 4: Run — verify**

Run: `npx vitest run tests/check/baseline.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check/baseline.ts tests/check/baseline.test.ts
git commit -m "feat(check): pure baseline core — keyOf/buildBaseline/applyBaseline + locked message"
```

---

## Task 4: wire `run()` — partition + optional baseline

**Files:**
- Modify: `lib/check/run.ts`
- Test: append to `tests/check/baseline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/check/baseline.test.ts
import { run } from "@/lib/check/run";

describe("run(baseline) integration", () => {
  it("no-arg run is unchanged in findings + disableCount", () => {
    const a = run();
    expect(a).toHaveProperty("findings");
    expect(a).toHaveProperty("disableCount");
    expect(a.baselineSuppressed).toBe(0);
    expect(a.staleEntries).toEqual([]);
  });
  it("system checks + ds-disable bypass the baseline (only source findings are baseline-able)", () => {
    // empty baseline → nothing suppressed; system findings (key===undefined) always present if any
    const r = run({ version: 1, generated: "2026-06-24", entries: [] });
    expect(r.findings.every((f) => f.rule !== "off-token-scale" || f.key !== undefined)).toBe(true);
  });
});
```

(The template itself is gate-green, so `run()` returns no source findings — the meaningful suppression path is covered by Task 8's seeded fixture. This task just proves the wiring/return shape.)

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/check/baseline.test.ts` → FAIL (`baselineSuppressed` undefined).

- [ ] **Step 3: Implement** — rewrite `lib/check/run.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "./types";
import { walkSource } from "./files";
import { applySuppressions, bareDisableFindings } from "./ds-disable";
import { checkHardcodedColor } from "./hardcoded-color";
import { checkArbitrary } from "./arbitrary-tailwind";
import { checkBothTheme } from "./both-theme";
import { checkContrast } from "./contrast";
import { checkManifestFresh } from "./manifest-fresh";
import { checkOffTokenScale } from "./off-token-scale";
import { applyBaseline, type Baseline, type BaselineEntry } from "./baseline";
import { parseThemeSteps } from "@/lib/tokens/theme-steps";

const SOURCE_ROOTS = ["app", "components"];
const EXTS = [".ts", ".tsx", ".css"];
const EXCLUDE_DIRS = ["ui"];
const EXCLUDE_FILES = ["app/globals.css", "components/editor/editor-chrome.css"];

export function run(baseline?: Baseline): {
  findings: Finding[];
  disableCount: number;
  baselineSuppressed: number;
  staleEntries: BaselineEntry[];
} {
  const source: Finding[] = [];     // per-file check findings — baseline-able
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

  const system = [
    ...checkBothTheme(globals),
    ...checkContrast(globals),
    ...checkManifestFresh(
      globals,
      readFileSync(resolve("design-system.json"), "utf8"),
      readFileSync(resolve("design-system.md"), "utf8"),
    ),
  ];
  return { findings: [...kept, ...bareDisables, ...system], disableCount, baselineSuppressed, staleEntries };
}
```

- [ ] **Step 4: Run — verify**

Run: `npx vitest run tests/check/baseline.test.ts` → PASS.
Run: `npm test` → all green (run()'s consumers: `scripts/check.ts` updated in Task 6; until then it still destructures `{findings, disableCount}` which remain — so `npm run check` keeps working).
Run: `npm run check` → still `✓ design-system check passed`.

- [ ] **Step 5: Commit**

```bash
git add lib/check/run.ts tests/check/baseline.test.ts
git commit -m "feat(check): run() partitions source vs system findings; optional baseline param"
```

---

## Task 5: `scripts/check-baseline.ts` + npm script

**Files:**
- Create: `scripts/check-baseline.ts`
- Modify: `package.json:13` (add `check:baseline`)

- [ ] **Step 1: Implement the script**

```ts
// scripts/check-baseline.ts
import { resolve } from "node:path";
import { run } from "../lib/check/run";
import { buildBaseline, baselineSavedMessage } from "../lib/check/baseline";
import { atomicWriteFileSync } from "../lib/fs/atomic-write";

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const { findings } = run(); // no baseline → all current findings
const baselineable = findings.filter((f) => f.key !== undefined);
const baseline = buildBaseline(baselineable, today);
atomicWriteFileSync(resolve(".ds-baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
console.log(baselineSavedMessage(baseline.entries.reduce((s, e) => s + e.count, 0)));
```

> N = total baseline-able findings (sum of entry counts), matching "N items" / "N things" in the message.

- [ ] **Step 2: Add the npm script**

`package.json` scripts — after `"check": ...`:
```json
"check:baseline": "tsx scripts/check-baseline.ts",
```

- [ ] **Step 3: Smoke-test on the clean template**

Run: `npm run check:baseline`
Expected: writes `.ds-baseline.json` with `entries: []` (template is clean) and prints "Saved a snapshot of your existing code (0 items)."
Then: `cat .ds-baseline.json` shows `{ "version": 1, "generated": "<today>", "entries": [] }`.
**Clean up:** `rm .ds-baseline.json` (the template must NOT ship one — greenfield stays strict).

- [ ] **Step 4: Commit**

```bash
git add scripts/check-baseline.ts package.json
git commit -m "feat(check): npm run check:baseline writes .ds-baseline.json snapshot"
```

---

## Task 6: `scripts/check.ts` — load + apply + warn-only stale

**Files:**
- Modify: `scripts/check.ts`

- [ ] **Step 1: Implement** — rewrite `scripts/check.ts`:

```ts
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

if (findings.length === 0) {
  const bits = [
    baselineSuppressed ? `${baselineSuppressed} baselined` : "",
    disableCount ? `${disableCount} ds-disable in use` : "",
  ].filter(Boolean);
  console.log(`✓ design-system check passed${bits.length ? ` (${bits.join(", ")})` : ""}`);
  if (staleEntries.length)
    console.error(`⚠ ${staleEntries.length} baseline entr${staleEntries.length === 1 ? "y" : "ies"} no longer match — run npm run check:baseline to prune`);
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
if (staleEntries.length)
  console.error(`⚠ ${staleEntries.length} baseline entr${staleEntries.length === 1 ? "y" : "ies"} no longer match — run npm run check:baseline to prune`);
process.exit(1);
```

- [ ] **Step 2: Verify clean template still strict**

Run: `npm run check` (no `.ds-baseline.json` present) → `✓ design-system check passed (4 ds-disable in use)` — unchanged.

- [ ] **Step 3: Commit**

```bash
git add scripts/check.ts
git commit -m "feat(check): check.ts loads + applies .ds-baseline.json; warn-only on stale"
```

---

## Task 7: docs — AGENTS.md directive + README section + drift coverage

**Files:**
- Modify: `AGENTS.md` (inside `<!-- BEGIN:design-system -->` … `<!-- END:design-system -->`, after the table at line 31)
- Modify: `README.md` (new last section after `## Status`)
- Test: extend `tests/surfaces.test.ts`

- [ ] **Step 1: Write the failing doc-surface test**

```ts
// append inside the surfaces describe in tests/surfaces.test.ts
it("AGENTS.md carries the brownfield baseline directive inside the design-system block", () => {
  const a = read("AGENTS.md");
  expect(a).toContain("check:baseline");
  expect(a).toContain("one-time human adoption step");
});
it("README documents brownfield adoption", () => {
  expect(read("README.md")).toContain("check:baseline");
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/surfaces.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `AGENTS.md`, insert before `<!-- END:design-system -->` (after line 31):

```markdown

**Adopting onto an existing codebase (brownfield).** `npm run check:baseline` records the project's *current* violations to `.ds-baseline.json` so the gate then only flags **new** code. It is a **one-time human adoption step**, run once when the template is first added to a pre-existing repo — **not** a tool you reach for when the gate goes red on your work.

- The **Law above is unchanged for any code you write or edit.** Baseline mode only means: don't treat *pre-existing, human-authored* debt as yours to refactor unless asked.
- If the gate goes red on code **you** wrote this session, that is **never** baseline-eligible — **fix it** (or extend the system per the procedure).
- **Never run `check:baseline` yourself to clear errors.** If you believe the baseline genuinely needs regenerating, **stop and ask the human** — re-baselining to silence your own violations defeats the design system and silently ships broken styling.
- Don't auto-refactor a brownfield repo's legacy code to tokens unless the human asks; automatic conversion isn't part of this template yet.
```

`README.md` — add as the last section (after `## Status`):

```markdown

## Adopting on an existing codebase?

This template assumes a fresh start — that's the intended path. Bringing it to an app you've already built? Run `npm run check:baseline` once. It snapshots your current code so the gate only checks what you build **next**; your existing code is left as-is and keeps working. It's a starting line, not an auto-converter — bringing old code in line with the system is yours to do when you want.
```

- [ ] **Step 4: Run — verify**

Run: `npx vitest run tests/surfaces.test.ts` → PASS (and the existing "no pointer inlines BEGIN:design-system" assertion still passes — the directive is in AGENTS.md, not in a pointer surface).

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md tests/surfaces.test.ts
git commit -m "docs: brownfield baseline directive (AGENTS.md) + README adoption section"
```

---

## Task 8: end-to-end seeded integration

**Files:**
- Test: `tests/check/baseline-e2e.test.ts`

Proves the headline loop with a real seeded fixture: build a baseline over known violations → suppressed → add a new one → caught. Uses the pure `run`-style checks directly over fixture content (no fs walk needed — call the checks on inline content, build/apply a baseline).

- [ ] **Step 1: Write the test**

```ts
// tests/check/baseline-e2e.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";
import { buildBaseline, applyBaseline } from "@/lib/check/baseline";

// p-13 is OFF-scale (p-7 would be allowed → no finding); bg-gray-500 = default-palette; #222 = hardcoded inline color.
const legacy = `<div className="bg-gray-500 p-13" style={{ color: "#222" }} />`;

describe("brownfield baseline — headline loop", () => {
  const findingsOf = (src: string) => [...checkHardcodedColor("legacy.tsx", src), ...checkArbitrary("legacy.tsx", src)];

  it("baselining existing debt → next run is clean", () => {
    const before = findingsOf(legacy);
    expect(before.length).toBeGreaterThan(0); // floods red cold
    const baseline = buildBaseline(before, "2026-06-24");
    const after = applyBaseline(findingsOf(legacy), baseline);
    expect(after.kept).toEqual([]); // green
    expect(after.staleEntries).toEqual([]);
  });

  it("a NEW violation added later is still caught", () => {
    const baseline = buildBaseline(findingsOf(legacy), "2026-06-24");
    const edited = legacy + `\n<span className="text-blue-500" />`; // new default-palette
    const after = applyBaseline(findingsOf(edited), baseline);
    expect(after.kept.map((f) => f.key)).toEqual(["text-blue-500"]);
  });

  it("fixing one baselined item surfaces a stale entry (warn, not fail)", () => {
    const baseline = buildBaseline(findingsOf(legacy), "2026-06-24");
    const fixed = `<div className="bg-primary p-4" style={{ color: "#222" }} />`; // dropped bg-gray-500 + p-13
    const after = applyBaseline(findingsOf(fixed), baseline);
    expect(after.kept).toEqual([]);
    expect(after.staleEntries.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — verify**

Run: `npx vitest run tests/check/baseline-e2e.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/check/baseline-e2e.test.ts
git commit -m "test(check): end-to-end brownfield baseline loop (seed → suppress → new-caught → stale)"
```

---

## Task 9: full verification before merge

- [ ] **Step 1: confirm no `.ds-baseline.json` is staged/committed** (greenfield ships strict)

Run: `git status --porcelain | grep ds-baseline` → empty. `ls .ds-baseline.json` → not found (or `rm` it).

- [ ] **Step 2: full gate**

Run: `npm run verify` (= `check && test && lint && build`) → all green. Per the run-next-build-before-merge memory, `next build` is the only thing that type-checks the app graph + compiles CSS.

- [ ] **Step 3: e2e**

Run: `npx playwright test` → 25 pass (1 gallery skipped). (No UI change here, but the project runs e2e before every merge.)

- [ ] **Step 4: update HANDOFF**

Mark F6 baseline DONE in `docs/HANDOFF.md` (M6 fast-follows / F6 row + the "Brownfield baseline (F6)" near-term item) with counts; convert the date to absolute (2026-06-24). Commit:
```bash
git add docs/HANDOFF.md
git commit -m "docs(HANDOFF): F6 brownfield baseline DONE 2026-06-24"
```

- [ ] **Step 5: merge** (with the user's go-ahead) — `--no-ff` to main, delete branch. Per project convention; confirm with the user first.

---

## Notes for the executor
- **Never `git add -A`/`git add .`** — the smoke-tests (Task 5 Step 3, Task 9) write a throwaway `.ds-baseline.json` at repo root; it must NOT be committed (greenfield ships strict, spec §11). All `git add` lines in this plan are explicit-path; keep them that way and `rm .ds-baseline.json` after each smoke-test. (Do NOT gitignore it — an *adopter* commits their own; the template just ships without one.)
- **Shared-tree hazard:** never `git checkout <paths>` to discard — use `git restore` and only after confirming identity to HEAD (a subagent once orphaned commits this way; you're in-session so lower risk, but the habit matters).
- **`next build` is load-bearing** — `check`/`test`/`lint` skip the app-graph type-check + CSS compile. Always `npm run verify`.
- **The message is locked** (spec §7) — `baselineSavedMessage` is the single source; the drift test guards its phrase. Don't reword without the user.
- **N semantics:** "N items" = total baseline-able findings (sum of counts), not distinct entries — matches the human reading of "things in your code".
