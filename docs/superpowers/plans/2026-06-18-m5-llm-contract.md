# M5 — LLM Contract + Blocking Lint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the design system self-enforcing for LLM-built code: a TDD'd `npm run check` gate (no hardcoded colors / off-token / off-scale-spacing / one-theme colors / stale manifest), a portable LLM-contract doc, wired into Husky pre-commit + GitHub Actions CI; the template passes its own gate.

**Architecture:** Pure, fixture-tested sub-checks in `lib/check/` (each returns `Finding[]`, no IO); `scripts/check.ts` + `lib/check/run.ts` own IO (file walk, read globals/manifest), apply `ds-disable` suppression, print actionable messages, exit non-zero on findings. Reuses M1's `parseTokens` + M2's `buildManifest`/`syncThemeColorMappings`. Docs append a managed block to `AGENTS.md` (pointer, not a copy of the generated `design-system.md`).

**Tech Stack:** TypeScript + `tsx` (already a dep) · Vitest · PostCSS (via `lib/tokens/parse`) · Husky (new devDep) · GitHub Actions. No new lint frameworks (the spec deliberately uses a script, not stylelint/custom-eslint).

**Authoritative spec:** `docs/superpowers/specs/2026-06-18-m5-llm-contract-design.md` (read it; this implements it). Honest scope (spec §8): M5 **enforces the extension procedure was followed + backstops drift** — it does not "prevent all hardcoding" (the M0 cleared-namespace compile-gate silently no-ops off-token color classes; this gate makes drift loud).

---

## Build order (de-risk: prove the harness on the easiest check, riskiest detectors last)

1. **Harness primitives** (types, messages, file walk, ds-disable) — no checks yet.
2. **both-theme** — lowest-risk check (reuses `parseTokens`; natural fixtures); proves a check end-to-end.
3. **manifest-fresh** — low-risk (reuses `buildManifest`/sync).
4. **arbitrary-tailwind (+ off-scale spacing)** — riskiest className parser.
5. **hardcoded-color** — fixtured against the REAL inline-style components.
6. **Runner + `npm run check` + dogfood self-pass** — wire it together; the template passes its own gate.
7. **eslint fix.** 8. **Contract docs.** 9. **Husky.** 10. **CI.** 11. **Close + merge.**

## Branch
```bash
git switch -c m5-llm-contract   # from main, after M4 merged
```

## File map
```
lib/check/
  types.ts            # Finding
  messages.ts         # message + fix strings (single source; tests import these)
  files.ts            # walkSource(roots, exts, exclude) -> {path, content}[]  (recursive, no glob dep)
  ds-disable.ts       # parse ds-disable comments; suppress line-scoped findings; flag bare (reason-less)
  spacing-steps.ts    # ALLOWED_SPACING_STEPS (adopter-editable)
  both-theme.ts       # checkBothTheme(globalsCss): Finding[]   (COLOR_ROLES, presence-of-row)
  manifest-fresh.ts   # checkManifestFresh(globalsCss, json, md): Finding[]  (in-process; CI uses git-dirty too)
  arbitrary-tailwind.ts # checkArbitrary(path, content): Finding[]
  hardcoded-color.ts  # checkHardcodedColor(path, content): Finding[]
  run.ts              # compose: walk + per-file checks + whole-repo checks + suppression -> {findings, disableCount}
scripts/check.ts      # CLI: run() -> print -> process.exit
lib/tokens/schema.ts  # MODIFY: `export` COLOR_ROLES
eslint.config.mjs     # MODIFY: ignore **/.next/** + .claude/**
package.json          # MODIFY: scripts.check, scripts.lint (pinned), prepare (husky), husky devDep
AGENTS.md             # MODIFY: append <!-- BEGIN:design-system --> managed block
.cursor/rules/design-system.mdc  # CREATE: thin mirror/pointer
.husky/pre-commit     # CREATE: npm run check
.github/workflows/ci.yml  # CREATE: blocking gate job + non-blocking e2e job
tests/check/*         # fixture tests per check + dogfood self-pass
```

---

### Task 1: Harness primitives (types, messages, file walk, ds-disable)

**Files:** Create `lib/check/{types,messages,files,ds-disable,spacing-steps}.ts`; Test `tests/check/ds-disable.test.ts`, `tests/check/files.test.ts`

- [ ] **Step 1: Write `lib/check/types.ts`**
```ts
export interface Finding {
  file: string;
  line: number; // 1-based; 0 = whole-file (not line-suppressible)
  rule: string;
  message: string; // includes the fix (recovery UX, spec §2)
}
```

- [ ] **Step 2: Write `lib/check/messages.ts`** (single source — tests import these)
```ts
export const MSG = {
  hardcodedColor: (cls: string) =>
    `hardcoded color "${cls}" — use a token utility (bg-<token>/text-<token>) or add a token (see design-system.md), then npm run tokens`,
  arbitraryColor: (cls: string) =>
    `off-token arbitrary color "${cls}" — use a token utility or add a token (see design-system.md)`,
  arbitraryLength: (cls: string) =>
    `hardcoded length "${cls}" — use a token-based utility/value (see design-system.md)`,
  offScaleSpacing: (cls: string) =>
    `off-scale spacing "${cls}" — use a step on the spacing scale (edit lib/check/spacing-steps.ts to extend)`,
  defaultPalette: (cls: string) =>
    `off-token Tailwind palette class "${cls}" — produces no styles; use a token utility (see design-system.md)`,
  bothThemeMissing: (name: string, missingIn: "light" | "dark") =>
    `${name} is missing from ${missingIn === "dark" ? ".dark" : ":root"} — add it to both blocks, then npm run tokens`,
  manifestStale: (file: string) =>
    `${file} is stale — run npm run tokens and commit`,
  bareDisable: () => `ds-disable needs a reason: /* ds-disable: <why> */`,
} as const;
```

- [ ] **Step 3: Write `lib/check/files.ts`** — recursive source walker (no glob dependency)
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface SourceFile { path: string; content: string; }

/** Recursively collect files under `roots` with one of `exts`, skipping any path that contains
 *  one of `excludeDirs` segments or matches an `excludeFile` (repo-relative, posix). */
export function walkSource(
  roots: string[],
  exts: string[],
  opts: { excludeDirs?: string[]; excludeFiles?: string[] } = {},
): SourceFile[] {
  const out: SourceFile[] = [];
  const exclDirs = new Set(opts.excludeDirs ?? []);
  const exclFiles = new Set(opts.excludeFiles ?? []);
  const visit = (dir: string) => {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = join(dir, name);
      const rel = relative(process.cwd(), full).split(sep).join("/");
      if (statSync(full).isDirectory()) {
        if (!exclDirs.has(name)) visit(full);
        continue;
      }
      if (!exts.some((e) => name.endsWith(e))) continue;
      if (exclFiles.has(rel)) continue;
      out.push({ path: rel, content: readFileSync(full, "utf8") });
    }
  };
  for (const r of roots) visit(r);
  return out;
}
```

- [ ] **Step 4: Write `lib/check/spacing-steps.ts`**
```ts
/** Allowed steps on Tailwind v4's --spacing multiplier scale. Adopter-editable: add steps your
 *  design uses. The off-scale-spacing check flags p-/m-/gap-/space- utilities outside this set. */
export const ALLOWED_SPACING_STEPS = new Set([
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44,
  48, 52, 56, 60, 64, 72, 80, 96,
]);
```

- [ ] **Step 5: Write `lib/check/ds-disable.ts`**
```ts
import type { Finding } from "./types";
import { MSG } from "./messages";

const DISABLE_RE = /(?:\/\/|\/\*)\s*ds-disable:\s*(.*?)\s*(?:\*\/|$)/;
const BARE_RE = /(?:\/\/|\/\*)\s*ds-disable\s*(?:\*\/|$)/; // no colon/reason

/** Lines (1-based) that carry a valid ds-disable (reason present). */
export function disabledLines(content: string): Set<number> {
  const set = new Set<number>();
  content.split("\n").forEach((ln, i) => {
    const m = ln.match(DISABLE_RE);
    if (m && m[1].trim()) set.add(i + 1);
  });
  return set;
}

/** Findings for bare ds-disable (no reason). */
export function bareDisableFindings(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((ln, i) => {
    if (BARE_RE.test(ln) && !DISABLE_RE.test(ln)) {
      out.push({ file: path, line: i + 1, rule: "ds-disable", message: MSG.bareDisable() });
    }
  });
  return out;
}

/** Drop line-scoped findings whose immediately-preceding line carries a valid ds-disable.
 *  Whole-file findings (line 0) are never suppressible. Returns [kept, suppressedCount]. */
export function applySuppressions(findings: Finding[], content: string): [Finding[], number] {
  const dis = disabledLines(content);
  let suppressed = 0;
  const kept = findings.filter((f) => {
    if (f.line > 0 && (dis.has(f.line - 1) || dis.has(f.line))) { suppressed++; return false; }
    return true;
  });
  return [kept, suppressed];
}
```

- [ ] **Step 6: Tests** — `tests/check/ds-disable.test.ts`: a `/* ds-disable: legacy */` on the line above suppresses a line-N finding; a bare `/* ds-disable */` yields a `bareDisable` finding + does NOT suppress; whole-file (line 0) findings are never suppressed. `tests/check/files.test.ts`: `walkSource(["tests/check/__fixtures__"], [".tsx"], {excludeDirs:["skip"]})` returns the expected files, skips excluded dir. (Create a tiny `tests/check/__fixtures__/` tree.)

- [ ] **Step 7: Run** `npx vitest run tests/check/` → green.
- [ ] **Step 8: Commit** `feat(m5): check harness — types, messages, file walk, ds-disable`

---

### Task 2: both-theme check (+ export COLOR_ROLES)

**Files:** Modify `lib/tokens/schema.ts` (export COLOR_ROLES); Create `lib/check/both-theme.ts`; Test `tests/check/both-theme.test.ts`

- [ ] **Step 1: Export COLOR_ROLES** — in `lib/tokens/schema.ts` change `const COLOR_ROLES =` to `export const COLOR_ROLES =`. (Verify nothing else breaks: it's currently used internally by `groupForName`/`foregroundFor`.)

- [ ] **Step 2: Write the failing test** `tests/check/both-theme.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { checkBothTheme } from "@/lib/check/both-theme";
import { MSG } from "@/lib/check/messages";

const ok = `:root{ --primary: oklch(0.2 0 0); --primary-foreground: oklch(1 0 0); --brand-50: oklch(0.97 0 0); }
.dark{ --primary: oklch(0.9 0 0); --primary-foreground: oklch(0.2 0 0); }`;
const missingDark = `:root{ --primary: oklch(0.2 0 0); --primary-foreground: oklch(1 0 0); }
.dark{ --primary-foreground: oklch(0.2 0 0); }`;

describe("both-theme", () => {
  it("passes when semantic roles exist in both blocks; ignores :root-only brand ramps", () => {
    expect(checkBothTheme(ok)).toEqual([]);
  });
  it("flags a semantic role missing from .dark", () => {
    const f = checkBothTheme(missingDark);
    expect(f).toHaveLength(1);
    expect(f[0].message).toBe(MSG.bothThemeMissing("--primary", "dark"));
  });
});
```

- [ ] **Step 3: Implement** `lib/check/both-theme.ts`
```ts
import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { COLOR_ROLES } from "@/lib/tokens/schema";

/** Every semantic color role (COLOR_ROLES) defined in :root must also be in .dark and vice-versa.
 *  Ramps (--brand-*/--chart-*) and non-color tokens are intentionally NOT required in both blocks. */
export function checkBothTheme(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const light = new Set(tokens.filter((t) => t.theme === "light").map((t) => t.name));
  const dark = new Set(tokens.filter((t) => t.theme === "dark").map((t) => t.name));
  const out: Finding[] = [];
  for (const role of COLOR_ROLES) {
    const name = `--${role}`;
    if (light.has(name) && !dark.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "dark") });
    else if (dark.has(name) && !light.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "light") });
  }
  return out;
}
```

- [ ] **Step 4: Run** `npx vitest run tests/check/both-theme.test.ts` → green. Also run `npm test` to confirm exporting COLOR_ROLES broke nothing.
- [ ] **Step 5: Commit** `feat(m5): both-theme check (semantic color roles in :root+.dark); export COLOR_ROLES`

---

### Task 3: manifest-fresh check

**Files:** Create `lib/check/manifest-fresh.ts`; Test `tests/check/manifest-fresh.test.ts`

- [ ] **Step 1: Write the failing test** — using the real `lib/tokens` helpers on an in-memory globals + matching/mismatching manifest strings.
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkManifestFresh } from "@/lib/check/manifest-fresh";

const globals = readFileSync(resolve("app/globals.css"), "utf8");
const json = readFileSync(resolve("design-system.json"), "utf8");
const md = readFileSync(resolve("design-system.md"), "utf8");

describe("manifest-fresh", () => {
  it("passes when the committed manifest matches globals", () => {
    expect(checkManifestFresh(globals, json, md)).toEqual([]);
  });
  it("flags a stale json", () => {
    const f = checkManifestFresh(globals, json.replace(/"name"/, '"NAME"'), md);
    expect(f.some((x) => x.rule === "manifest-fresh")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement** `lib/check/manifest-fresh.ts`
```ts
import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { buildManifest } from "@/lib/tokens/generate";
import { syncThemeColorMappings } from "@/lib/tokens/sync";

/** In-process freshness: the committed manifest must equal what `npm run tokens` would produce.
 *  (CI ALSO runs the authoritative git-dirty check — see .github/workflows/ci.yml.) */
export function checkManifestFresh(globalsCss: string, committedJson: string, committedMd: string): Finding[] {
  const sync = syncThemeColorMappings(globalsCss);
  const out: Finding[] = [];
  if (sync.changed)
    out.push({ file: "app/globals.css", line: 0, rule: "manifest-fresh",
      message: "missing @theme color mapping — run npm run tokens and commit" });
  const { json, markdown } = buildManifest(parseTokens(sync.css));
  const expectedJson = JSON.stringify(json, null, 2) + "\n";
  if (committedJson !== expectedJson)
    out.push({ file: "design-system.json", line: 0, rule: "manifest-fresh", message: MSG.manifestStale("design-system.json") });
  if (committedMd !== markdown)
    out.push({ file: "design-system.md", line: 0, rule: "manifest-fresh", message: MSG.manifestStale("design-system.md") });
  return out;
}
```
> Note: `buildManifest` returns `markdown` WITHOUT a trailing-newline transform in `generate-tokens.ts` (it writes `markdown` directly). Confirm the exact write form in `lib/tokens/regenerate.ts` and match it byte-for-byte (json = `JSON.stringify(...,2)+"\n"`; md = `markdown` as-is). Adjust the comparison to whatever `regenerate.ts` writes.

- [ ] **Step 3: Run** → green. **Step 4: Commit** `feat(m5): manifest-fresh check (in-process; CI adds git-dirty)`

---

### Task 4: arbitrary-tailwind check (+ off-scale spacing)

**Files:** Create `lib/check/arbitrary-tailwind.ts`; Test `tests/check/arbitrary-tailwind.test.ts`

Detects, in className string literals: (a) arbitrary literal-color brackets `bg-[#..]`/`text-[rgb(..)]`;
(b) arbitrary literal-length on type/spacing prefixes `text-[10px]`/`p-[13px]`; (c) off-scale bare-numeric
spacing `p-13`; (d) off-token default-palette classes `bg-red-500`. ALLOWS `var(`/`color-mix(`/`calc(`-containing
arbitraries and layout/size arbitraries.

- [ ] **Step 1: Write the failing test** (cover flag + allow cases incl. the repo's real patterns)
```ts
import { describe, it, expect } from "vitest";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";

const find = (s: string) => checkArbitrary("x.tsx", `const c = "${s}";`).map((f) => f.rule);

describe("arbitrary-tailwind", () => {
  it("flags arbitrary literal color", () => expect(find("bg-[#abc]")).toContain("arbitrary-color"));
  it("flags arbitrary literal length on type/spacing", () => {
    expect(find("text-[10px]")).toContain("arbitrary-length");
    expect(find("p-[13px]")).toContain("arbitrary-length");
  });
  it("flags off-scale spacing", () => expect(find("p-13")).toContain("off-scale-spacing"));
  it("flags default-palette classes", () => expect(find("bg-red-500")).toContain("default-palette"));
  it("allows token-referencing + layout arbitraries + on-scale spacing + token classes", () => {
    expect(find("bg-[color-mix(in_oklch,var(--secondary),transparent_40%)]")).toEqual([]);
    expect(find("rounded-[min(var(--radius-md),10px)]")).toEqual([]);
    expect(find("grid-cols-[1fr_2fr]")).toEqual([]);
    expect(find("w-[20rem]")).toEqual([]);          // size prefix: not bare-numeric-checked
    expect(find("p-4 gap-1.5 px-2.5 bg-primary text-lg")).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement** `lib/check/arbitrary-tailwind.ts`
```ts
import type { Finding } from "./types";
import { MSG } from "./messages";
import { ALLOWED_SPACING_STEPS } from "./spacing-steps";

const STRING_LIT = /["'`]([^"'`]*)["'`]/g; // candidate class strings
const SPACING = "p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y";
const PALETTES = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const reArbitrary = /^-?[a-z][a-z-]*-\[([^\]]*)\]$/;
const reArbColorPrefix = /^-?(bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|caret|accent|shadow)-\[/;
const reSpacingNum = new RegExp(`^-?(?:${SPACING})-(\\d+(?:\\.\\d+)?)$`);
const rePalette = new RegExp(`^-?(?:bg|border|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|ring-offset)-(?:${PALETTES})-\\d{2,3}$`);

const lineOf = (content: string, idx: number) => content.slice(0, idx).split("\n").length;

export function checkArbitrary(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  for (const m of content.matchAll(STRING_LIT)) {
    const line = lineOf(content, m.index!);
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      const arb = cls.match(reArbitrary);
      if (arb) {
        const inner = arb[1];
        if (/var\(|color-mix\(|calc\(|min\(|max\(|clamp\(/.test(inner)) continue; // token/computed → allowed
        if (reArbColorPrefix.test(cls) && /^(#|rgb\(|hsl\()/.test(inner))
          out.push({ file: path, line, rule: "arbitrary-color", message: MSG.arbitraryColor(cls) });
        else if (/^-?(?:text|leading|p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-\[/.test(cls)
                 && /^\d*\.?\d+(px|rem|em|%)$/.test(inner))
          out.push({ file: path, line, rule: "arbitrary-length", message: MSG.arbitraryLength(cls) });
        continue; // other arbitraries (layout/size) allowed
      }
      const sp = cls.match(reSpacingNum);
      if (sp && !ALLOWED_SPACING_STEPS.has(Number(sp[1]))) {
        out.push({ file: path, line, rule: "off-scale-spacing", message: MSG.offScaleSpacing(cls) });
        continue;
      }
      if (rePalette.test(cls))
        out.push({ file: path, line, rule: "default-palette", message: MSG.defaultPalette(cls) });
    }
  }
  return out;
}
```
> The `text-` prefix is overloaded (`text-lg`, `text-center`, `text-primary`) — note the default-palette regex deliberately EXCLUDES `text-` to avoid flagging those; arbitrary `text-[10px]` is still caught by the length rule.

- [ ] **Step 3: Run** → green (iterate the regexes until all cases pass). **Step 4: Commit** `feat(m5): arbitrary-tailwind + off-scale-spacing check`

---

### Task 5: hardcoded-color check

**Files:** Create `lib/check/hardcoded-color.ts`; Test `tests/check/hardcoded-color.test.ts`

- [ ] **Step 1: Write the failing test** (flag literal hex/rgb; exempt var() inline styles + href/url/id)
```ts
import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const find = (s: string) => checkHardcodedColor("x.tsx", s).length;

describe("hardcoded-color", () => {
  it("flags a literal hex in a style", () => expect(find(`<div style={{color:'#fff'}}/>`)).toBe(1));
  it("flags rgb()/hsl()", () => expect(find(`const a='rgb(0 0 0)'; const b='hsl(0 0% 0%)';`)).toBe(2));
  it("allows var()-valued inline styles", () => expect(find(`<div style={{background:'var(--primary)'}}/>`)).toBe(0));
  it("does not flag href/url/id anchors", () =>
    expect(find(`<a href="#top"/>; const u='url(#clip)'; const id='#section';`)).toBe(0));
});
```

- [ ] **Step 2: Implement** `lib/check/hardcoded-color.ts`
```ts
import type { Finding } from "./types";
import { MSG } from "./messages";

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNC = /\b(rgb|rgba|hsl|hsla)\(/;
const EXEMPT = /(href=|url\(|id=|["'`]#)/; // anchors, svg url refs, id strings

/** Flag literal color values (#hex, rgb(/hsl() in source. Exempt var()-valued styles + href/url/id.
 *  Path-level exclusions (token sources, components/ui/**, editor-chrome.css) are applied by run.ts. */
export function checkHardcodedColor(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((ln, i) => {
    if (EXEMPT.test(ln)) return;
    const hex = ln.match(HEX);
    if (hex) out.push({ file: path, line: i + 1, rule: "hardcoded-color", message: MSG.hardcodedColor(hex[0]) });
    const fn = ln.match(FUNC);
    if (fn) out.push({ file: path, line: i + 1, rule: "hardcoded-color", message: MSG.hardcodedColor(fn[0]) });
  });
  return out;
}
```
> Acceptable limitation (state in spec §8): line-scoped literal detection; a hex composed at runtime or split across lines is not caught. Good enough — the realistic drift is literals.

- [ ] **Step 3: Run** → green. **Step 4: Commit** `feat(m5): hardcoded-color check (literal colors; var()/href exempt)`

---

### Task 6: Runner + `npm run check` + dogfood self-pass

**Files:** Create `lib/check/run.ts`, `scripts/check.ts`; Modify `package.json`; Test `tests/check/self.test.ts`

- [ ] **Step 1: Write `lib/check/run.ts`** — compose everything; centralize exclusions.
```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "./types";
import { walkSource } from "./files";
import { applySuppressions, bareDisableFindings } from "./ds-disable";
import { checkHardcodedColor } from "./hardcoded-color";
import { checkArbitrary } from "./arbitrary-tailwind";
import { checkBothTheme } from "./both-theme";
import { checkManifestFresh } from "./manifest-fresh";

const SOURCE_ROOTS = ["app", "components", "lib"];
const EXTS = [".ts", ".tsx", ".css"];
const EXCLUDE_DIRS = ["ui"]; // components/ui/** (vendored shadcn) — by dir name under components
const EXCLUDE_FILES = ["app/globals.css", "components/editor/editor-chrome.css"];
// themes/*.css aren't under SOURCE_ROOTS, so not walked.

export function run(): { findings: Finding[]; disableCount: number } {
  const all: Finding[] = [];
  let disableCount = 0;
  for (const f of walkSource(SOURCE_ROOTS, EXTS, { excludeDirs: EXCLUDE_DIRS, excludeFiles: EXCLUDE_FILES })) {
    const raw = [...checkHardcodedColor(f.path, f.content), ...checkArbitrary(f.path, f.content)];
    const [kept, n] = applySuppressions(raw, f.content);
    disableCount += n;
    all.push(...kept, ...bareDisableFindings(f.path, f.content));
  }
  const globals = readFileSync(resolve("app/globals.css"), "utf8");
  all.push(...checkBothTheme(globals));
  all.push(...checkManifestFresh(
    globals,
    readFileSync(resolve("design-system.json"), "utf8"),
    readFileSync(resolve("design-system.md"), "utf8"),
  ));
  return { findings: all, disableCount };
}
```
> Note: `EXCLUDE_DIRS: ["ui"]` skips any dir named `ui` — fine here (only `components/ui`). If a stricter path match is wanted, extend `walkSource` to take path-prefixes; not needed for v1.

- [ ] **Step 2: Write `scripts/check.ts`**
```ts
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
```

- [ ] **Step 3: Add scripts** to `package.json`: `"check": "tsx scripts/check.ts"`.

- [ ] **Step 4: Run `npm run check` against the real repo.** Expect: it surfaces any real violations in the template's own source. **Fix them** (or add a justified `/* ds-disable: <reason> */`) until the template passes. Likely-clean given the exclusions, but the design-system showcase / editor TSX may surface a stray case — fix per the recovery messages. Capture the final state.

- [ ] **Step 5: Write the dogfood self-pass test** `tests/check/self.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { run } from "@/lib/check/run";
describe("dogfood", () => {
  it("the template's own source passes npm run check", () => {
    const { findings } = run();
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  });
});
```

- [ ] **Step 6: Run** `npm test` → green (incl. self-pass). **Step 7: Commit** `feat(m5): check runner + npm run check + dogfood self-pass`

---

### Task 7: Fix eslint scope

**Files:** Modify `eslint.config.mjs`, `package.json`

- [ ] **Step 1:** In `eslint.config.mjs` `globalIgnores([...])` add `"**/.next/**"` and `".claude/**"` (keep existing entries).
- [ ] **Step 2:** Pin `package.json` `"lint": "eslint app components lib scripts tests"`.
- [ ] **Step 3: Run** `npm run lint` → expect **0 errors** (real source is clean; verified pre-plan). If `tests/**` surfaces warnings/errors, address or scope them out.
- [ ] **Step 4: Commit** `fix(m5): eslint ignores nested .next/.claude; pin lint to source globs`

---

### Task 8: LLM contract docs

**Files:** Modify `AGENTS.md`; Create `.cursor/rules/design-system.mdc`

- [ ] **Step 1:** Append to `AGENTS.md` a managed block (mirrors the existing `nextjs-agent-rules` markers):
```markdown
<!-- BEGIN:design-system -->
# Design system contract

**Law:** style with the design system's Tailwind token utilities (`bg-primary`, `p-4`, `text-lg`, `rounded-lg`) or CSS vars (`var(--primary)`). Never hardcode a color, size, font, or duration. Off-token classes produce no styles **and** fail `npm run check`.

**The token reference is generated and always current:** see [`design-system.md`](design-system.md) for the full token table, usage rules, and the one-step extension procedure. Read it before building.

**Need a value the system lacks?** Follow the extension procedure in `design-system.md` (for a color: add it to BOTH `:root` and `.dark` in `app/globals.css`, then `npm run tokens`). The new token auto-appears on `/design-system` and becomes editable in the visual editor — extend the system, don't hardcode.

**The gate (`npm run check`, also run in CI + pre-commit) and how to fix each failure:**

| Failure | Fix |
|---|---|
| stale manifest | `npm run tokens && git add design-system.*` |
| color in one theme only | add it to both `:root` and `.dark`, then `npm run tokens` |
| hardcoded color / off-token class | replace with a token utility, or add a token via the procedure |
| off-scale spacing | use a step on the spacing scale (or extend `lib/check/spacing-steps.ts`) |
| deliberate one-off | `/* ds-disable: <reason> */` on the line above (reason required) |

_Note: the gate runs on `npm run check` / pre-commit / CI — not as live editor squiggles._
<!-- END:design-system -->
```
- [ ] **Step 2:** Create `.cursor/rules/design-system.mdc` — a thin mirror:
```markdown
---
description: Design system token contract
alwaysApply: true
---
Style only with the design system's token utilities / CSS vars — never hardcode color, size, font, or duration. Off-token classes produce no styles and fail `npm run check`. The authoritative, always-current token reference + one-step extension procedure is in `design-system.md`. To add a value: follow that procedure (`npm run tokens`), don't hardcode. See `AGENTS.md` (Design system contract) for the failure→fix table.
```
- [ ] **Step 3:** Confirm `CLAUDE.md` still `@AGENTS.md`-includes (no change needed). **Step 4: Commit** `docs(m5): AGENTS.md design-system contract block + .cursor rule`

---

### Task 9: Husky pre-commit

**Files:** `package.json`, `.husky/pre-commit`

- [ ] **Step 1:** `npm install -D husky` then `npx husky init` (creates `.husky/` + adds a `prepare` script). 
- [ ] **Step 2:** Set `.husky/pre-commit` to `npm run check`.
- [ ] **Step 3: Verify** — stage a temporary file with a hardcoded `#fff` in `app/` → `git commit` is **blocked** by the hook; remove it → commits fine. (Don't leave the temp file.)
- [ ] **Step 4: Commit** `chore(m5): husky pre-commit runs npm run check`

---

### Task 10: CI workflow

**Files:** Create `.github/workflows/ci.yml`

- [ ] **Step 1:** Write the workflow — blocking gate job + non-blocking e2e job.
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npm run build
      - name: manifest is committed fresh
        run: npm run tokens && git diff --exit-code design-system.json design-system.md
  e2e:
    runs-on: ubuntu-latest
    continue-on-error: true   # non-blocking (browser tests are slower/flakier) — promote later
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --workers=1
      - if: always()
        run: git checkout -- app/globals.css   # editor specs write+restore; guard a crashed run
```
- [ ] **Step 2:** Sanity-check the YAML parses (e.g. `npx --yes yaml-lint .github/workflows/ci.yml` or a quick node parse). We can't run Actions locally; verify each step's command works locally: `npm run check`, `npm test`, `npm run build`, and `npm run tokens && git diff --exit-code design-system.*` (expect clean).
- [ ] **Step 3: Commit** `ci(m5): blocking gate (check+test+build+manifest) + non-blocking e2e job`

---

### Task 11: Close — full suite, HANDOFF, merge

- [ ] **Step 1:** `npm run check` (clean) · `npm test` (green) · `npx playwright test` (green) · `npm run build` (ok) · `npm run lint` (0 errors) · `git status` clean.
- [ ] **Step 2:** Update `docs/HANDOFF.md`: mark M5 done (the gate, the contract docs, CI, husky, eslint fix); update test counts; note M6 is next; move the M5 lint-debt note to "resolved." Commit.
- [ ] **Step 3:** Merge:
```bash
git switch main
git merge --no-ff m5-llm-contract -m "Merge M5: LLM contract + blocking lint gate"
git branch -d m5-llm-contract
```
- [ ] **Step 4:** Verify suite green on `main`.

---

## Definition of done (spec §10)
- A hardcoded color / off-token class / off-scale spacing **fails `npm run check`** (and CI + pre-commit).
- A color in one theme only **fails**; a stale manifest **fails** (locally + the CI git-dirty gate).
- The extension procedure + recovery commands are documented in `AGENTS.md` (pointer to `design-system.md`, no duplication) + `.cursor/rules`.
- The **template's own source passes** `npm run check` (dogfood self-pass test).
- `ds-disable: <reason>` is the explicit, greppable, reason-required override.
- Full vitest + Playwright green; eslint clean; build ok; tree clean.

## Risks / notes
- **Riskiest: arbitrary-tailwind regexes** (Task 4) — false-positive/negative risk on real className patterns; fixture against the actual repo strings; the dogfood self-pass (Task 6) is the backstop.
- **manifest byte-matching** (Task 3) — must match `regenerate.ts`'s exact write form (json `+"\n"`, md as-is); confirm by reading it.
- **CI can't be run locally** — verify each step's command locally; the workflow itself activates on push (repo isn't pushed yet — that's fine, it ships with the template).
- **Deferred (fast-follow):** bundled Claude skill, stylelint, e2e-blocking promotion, off-scale checks on w/h/size, off-token palette detection beyond the curated family list.
