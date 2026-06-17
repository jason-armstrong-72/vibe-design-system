# M3a — Theme Preset Suite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v1 theme gallery — author **Swiss** and **Brutalist** as complete `:root`/`.dark` value-sets under the fixed token names (Neutral already ships from M0), add `npm run theme <name>` to swap a preset into `app/globals.css`, gate every theme on WCAG-AA + no-overflow, and publish a README screenshot gallery.

**Architecture:** A theme is a `themes/<name>.css` file containing only the `:root` and `.dark` token-value blocks (names are the fixed contract, §13). A pure `applyTheme(globalsCss, themeCss)` function replaces the `:root`/`.dark` rule nodes in `globals.css` and leaves the theme-invariant `@theme inline` / `@utility` / `@layer` / imports untouched (reusing M1's PostCSS approach). `scripts/apply-theme.ts` wires it to `npm run theme <name>` then regenerates the manifest. Gates: a pure-vitest WCAG contrast check over each theme file (via `culori`, no hand-rolled color math) and a Playwright overflow check that **injects** the theme CSS onto `/design-system` (deterministic, no file-swap/recompile race). Gallery screenshots use the same injection path.

**Tech Stack:** Next 16 + Tailwind v4 (CSS-first), PostCSS (already used by `lib/tokens/parse|write`), Vitest, Playwright, `culori` (new devDependency — canonical OKLCH/WCAG lib, avoids buggy hand-rolled `oklch→sRGB` conversion in a correctness gate).

---

## Why no separate brainstorm

The design direction is fully locked: spec §13 fixes the mechanism and the 3-theme v1 set; `docs/DESIGN-BRIEF.md` fixes the per-theme mini-briefs (Swiss = near-monochrome, radius 0, hairline borders, no shadow, type does the work; Brutalist = stark + 1–2 loud primaries, thick borders, hard offset shadows, mono, radius 0). The only open variance is the exact OKLCH/numeric values, which is made convergent by the contrast gate (Task 5) + the screenshot→critique→revise loop + human checkpoint (Task 7). Per the handoff, the milestone entry point is the writing-plans skill, not brainstorming.

## Load-bearing facts (verified against the repo this session)

- `app/globals.css`: `:root` = lines 12–119 (light, full token set, with group comments), `.dark` = lines 121–152 (**color overrides only, no group comments** — type/radius/spacing/etc. are authored once in `:root` and inherited). `@theme inline` (159–264), `@utility`/`@layer` (266–289), and the three `@import`s (1–3) + `@custom-variant` (5) are **theme-invariant** and must survive a swap byte-for-byte.
- The authored spacing token is **`--spacing-base`** (globals.css:101); `--spacing` exists **only** in `@theme inline` (`--spacing: var(--spacing-base)`). Theme files use `--spacing-base`; the parity gate enforces this.
- `.dark` only carrying color overrides means a theme file's `.dark` block also only needs color (+ any group the theme wants different in dark, e.g. a hard-shadow theme may override `--elevation-*`). Honest boundary per spec §13.
- Font tokens reference `--font-bundled-sans` / `--font-bundled-mono` (`lib/fonts.ts`, Geist + Geist Mono). Swiss uses the sans; Brutalist uses the mono. **Both are already bundled — no `lib/fonts.ts` change in M3a.** (Serif lands with Editorial, a fast-follow.)
- `npm run tokens` (`scripts/generate-tokens.ts`) = `syncThemeColorMappings` (no-op for a name-invariant theme) → `buildManifest(parseTokens(css))` → writes `design-system.{json,md}`.
- `lib/tokens/schema.ts` `foregroundFor(name)` enumerates the fg/bg pairs for the contrast gate.
- e2e config (`playwright.config.ts`) boots `next dev`; existing `e2e/design-system.spec.ts` reads `design-system.json`. `e2e/__shots__/` is gitignored.
- `radius: 0` themes are already safe: `@theme inline` derives `--radius-sm/md` with `max(0px, …)`.

---

## File structure

- **Create** `lib/tokens/apply-theme.ts` — pure `applyTheme(globalsCss, themeCss): string`. One responsibility: swap the `:root`/`.dark` rule nodes.
- **Create** `lib/tokens/regenerate.ts` — shared `syncAndGenerate(globalsPath)` extracted from `scripts/generate-tokens.ts` (DRY: both `npm run tokens` and `npm run theme` call it).
- **Create** `lib/tokens/contrast.ts` — `contrastResults(tokens): PairResult[]`; thin wrapper over `culori`'s `wcagContrast`. Pure.
- **Create** `themes/neutral.css`, `themes/swiss.css`, `themes/brutalist.css` — value-sets (`:root`+`.dark` only).
- **Create** `scripts/apply-theme.ts` — CLI: `npm run theme <name>`.
- **Create** `e2e/gallery.spec.ts` — env-guarded Playwright spec (reuses the configured `webServer`); injects each theme onto `/design-system`, captures `themes/screenshots/<name>{,-dark}.png`.
- **Create** `tests/themes/apply-theme.test.ts`, `tests/themes/contrast.test.ts`, `tests/themes/parity.test.ts`.
- **Create** `e2e/themes.spec.ts` — overflow gate per theme (injection).
- **Modify** `scripts/generate-tokens.ts` — call `syncAndGenerate`.
- **Modify** `package.json` — add `"theme"` + `"gallery"` scripts; add `culori` devDependency.
- **Modify** `README.md` — gallery section + `npm run theme` instructions.
- **Create** `themes/screenshots/` — committed gallery PNGs (NOT gitignored, unlike `e2e/__shots__/`).

---

## Branch

```bash
git switch -c m3a-theme-presets
```
(Matches the M0–M3 "one milestone per branch" convention. `--no-ff` merge to `main` after full suite green.)

---

### Task 1: `applyTheme` core (pure swap)

**Files:**
- Create: `lib/tokens/apply-theme.ts`
- Test: `tests/themes/apply-theme.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/themes/apply-theme.test.ts
import { describe, it, expect } from "vitest";
import { applyTheme } from "@/lib/tokens/apply-theme";
import { parseTokens } from "@/lib/tokens/parse";

const GLOBALS = `@import "tailwindcss";
:root {
  --primary: oklch(0.2 0 0);
  --radius: 0.625rem;
}
.dark {
  --primary: oklch(0.9 0 0);
}
@theme inline {
  --color-primary: var(--primary);
}
`;

const THEME = `:root {
  --primary: oklch(0.5 0.2 250);
  --radius: 0rem;
}
.dark {
  --primary: oklch(0.7 0.2 250);
}
`;

describe("applyTheme", () => {
  it("swaps :root and .dark values from the theme", () => {
    const out = applyTheme(GLOBALS, THEME);
    const t = parseTokens(out);
    const light = t.find((x) => x.name === "--primary" && x.theme === "light");
    const dark = t.find((x) => x.name === "--primary" && x.theme === "dark");
    expect(light?.value).toBe("oklch(0.5 0.2 250)");
    expect(dark?.value).toBe("oklch(0.7 0.2 250)");
    expect(t.find((x) => x.name === "--radius")?.value).toBe("0rem");
  });

  it("leaves the @theme inline block and imports untouched", () => {
    const out = applyTheme(GLOBALS, THEME);
    expect(out).toContain(`@import "tailwindcss";`);
    expect(out).toContain(`--color-primary: var(--primary);`);
  });

  it("is idempotent when the theme equals the current :root/.dark", () => {
    // Extract current blocks as a 'theme' → applying must not change the token set.
    const before = parseTokens(GLOBALS);
    const selfTheme = `:root {\n  --primary: oklch(0.2 0 0);\n  --radius: 0.625rem;\n}\n.dark {\n  --primary: oklch(0.9 0 0);\n}\n`;
    const after = parseTokens(applyTheme(GLOBALS, selfTheme));
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/themes/apply-theme.test.ts`
Expected: FAIL — `applyTheme` not found.

- [ ] **Step 3: Implement `applyTheme`**

```ts
// lib/tokens/apply-theme.ts
import postcss from "postcss";

const SWAPPABLE = new Set([":root", ".dark"]);

/**
 * Replace the :root and .dark rule blocks in `globalsCss` with those from `themeCss`,
 * leaving everything else (imports, @theme inline, @utility, @layer) untouched. A theme
 * is a values-only swap under the fixed token names (spec §13), so the utility layer is
 * invariant. Reuses PostCSS like lib/tokens/parse|write.
 */
export function applyTheme(globalsCss: string, themeCss: string): string {
  const target = postcss.parse(globalsCss);
  const source = postcss.parse(themeCss);

  const replacements = new Map<string, postcss.Rule>();
  source.walkRules((rule) => {
    const sel = rule.selector.trim();
    if (SWAPPABLE.has(sel)) replacements.set(sel, rule);
  });

  target.walkRules((rule) => {
    const sel = rule.selector.trim();
    const next = replacements.get(sel);
    if (next) rule.replaceWith(next.clone());
  });

  return target.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/themes/apply-theme.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/apply-theme.ts tests/themes/apply-theme.test.ts
git commit -m "feat(m3a): applyTheme — pure :root/.dark value-set swap"
```

---

### Task 2: Extract `themes/neutral.css` + round-trip identity gate

The current shipped Neutral lives only inline in `globals.css`. Extract it verbatim so `npm run theme neutral` is a no-op and the round-trip is a provable identity (the load-bearing safety property of the swap).

**Files:**
- Create: `themes/neutral.css`
- Test: extend `tests/themes/apply-theme.test.ts`

- [ ] **Step 1: Create `themes/neutral.css`** — copy the `:root { … }` block (globals.css lines 12–119) and the `.dark { … }` block (lines 121–152) **verbatim**. Note: `:root` carries the `/* ---- … ---- */` group comments; `.dark` has **none** (it's a bare declaration list) — copy each as-is. Header comment:

```css
/* Neutral — the M0 canonical default. Values only; names are the fixed contract
   (docs/NAMING-CONVENTION.md). Applied by `npm run theme neutral`. */
:root {
  /* …copy globals.css :root verbatim… */
}

.dark {
  /* …copy globals.css .dark verbatim… */
}
```

- [ ] **Step 2: Write the failing round-trip test** (append to `tests/themes/apply-theme.test.ts`)

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("applying themes/neutral.css to globals.css is a token-set identity", () => {
  const globals = readFileSync(resolve("app/globals.css"), "utf8");
  const neutral = readFileSync(resolve("themes/neutral.css"), "utf8");
  const applied = applyTheme(globals, neutral);
  expect(parseTokens(applied)).toEqual(parseTokens(globals));
  // utility layer survives untouched
  const themeBlock = (s: string) => s.slice(s.indexOf("@theme inline"));
  expect(themeBlock(applied)).toEqual(themeBlock(globals));
});
```

- [ ] **Step 3: Run** `npx vitest run tests/themes/apply-theme.test.ts` — if the identity fails, fix `themes/neutral.css` to match globals exactly (whitespace inside declarations is normalized by parse; the `@theme` slice must be byte-identical). Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add themes/neutral.css tests/themes/apply-theme.test.ts
git commit -m "feat(m3a): extract themes/neutral.css + round-trip identity gate"
```

---

### Task 3: `syncAndGenerate` extraction (DRY) + `npm run theme` CLI

**Files:**
- Create: `lib/tokens/regenerate.ts`
- Modify: `scripts/generate-tokens.ts`
- Create: `scripts/apply-theme.ts`
- Modify: `package.json`

- [ ] **Step 1: Extract `syncAndGenerate`** into `lib/tokens/regenerate.ts` (move the body of `scripts/generate-tokens.ts`):

```ts
// lib/tokens/regenerate.ts
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
```

Then reduce `scripts/generate-tokens.ts` to:

```ts
import { syncAndGenerate } from "../lib/tokens/regenerate";
syncAndGenerate();
```

- [ ] **Step 2: Verify the refactor is green** — `npm run tokens` then `git diff --stat` shows `design-system.{json,md}` unchanged (clean tree). Run `npm test`. Expected: still 88 passing.

- [ ] **Step 3: Write `scripts/apply-theme.ts`**

```ts
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
```

- [ ] **Step 4: Add npm scripts + culori** to `package.json`:

```jsonc
"scripts": {
  // …existing…
  "theme": "tsx scripts/apply-theme.ts"
  // ("gallery" added in Task 7: "GALLERY=1 playwright test e2e/gallery.spec.ts")
},
"devDependencies": {
  // …existing… add:
  "culori": "^4.0.1"
}
```

Run: `npm install`

- [ ] **Step 5: Smoke-test the no-op path**

Run: `npm run theme neutral && git status --porcelain`
Expected: applies cleanly; working tree clean (Neutral round-trips to itself — `globals.css`, manifest unchanged). If dirty, Task 2's neutral.css drifted from globals — fix before proceeding.

- [ ] **Step 6: Commit**

```bash
git add lib/tokens/regenerate.ts scripts/generate-tokens.ts scripts/apply-theme.ts package.json package-lock.json
git commit -m "feat(m3a): npm run theme <name> + syncAndGenerate (DRY) + culori dep"
```

---

### Task 4: Theme parity gate (names fixed, no accidental drift)

Asserts each theme defines the **same `:root` token names** as Neutral and that `.dark` names are a subset — catches a typo'd/renamed/dropped token (which would break a consumer) and partially enforces "nothing left at the Neutral default unintentionally" by requiring the full set to be present.

> **Green-between-commits strategy (no `.skip`).** The gate's theme list is **filtered by `existsSync`**, so it tests only the theme files that exist *right now*. Committed in Task 4 it tests only Neutral (trivially green, no missing-file `readFileSync` crash); once Task 6 authors Swiss/Brutalist the same test auto-covers them. A standalone "all 3 v1 themes exist" assertion (committed in Task 6, where it can pass) closes the "silently untested" gap. This avoids the `describe.skip.each`-body-execution subtlety entirely.

**Files:**
- Create: `tests/themes/parity.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/themes/parity.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";

const names = (css: string, theme: "light" | "dark") =>
  new Set(parseTokens(css).filter((t) => t.theme === theme).map((t) => t.name));

const neutral = readFileSync(resolve("themes/neutral.css"), "utf8");
const lightRef = names(neutral, "light");

// Only the non-default themes that already exist on disk (keeps suite green between commits).
const OTHERS = ["swiss", "brutalist"].filter((n) => existsSync(resolve(`themes/${n}.css`)));

describe.each(OTHERS)("theme parity: %s", (name) => {
  const css = readFileSync(resolve(`themes/${name}.css`), "utf8");
  it("defines exactly the Neutral :root token name set", () => {
    expect(names(css, "light")).toEqual(lightRef);
  });
  it(".dark names are a subset of :root names", () => {
    for (const n of names(css, "dark")) expect(lightRef.has(n)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/themes/parity.test.ts`
Expected: PASS — `OTHERS` is empty (only `themes/neutral.css` exists), so zero parity cases run but the file loads green. (After Task 5 authors the themes, re-running this covers Swiss + Brutalist with no edit to this file.)

- [ ] **Step 3: Commit**

```bash
git add tests/themes/parity.test.ts
git commit -m "test(m3a): theme parity gate (existsSync-filtered; activates as themes land)"
```

---

### Task 5: WCAG-AA contrast gate (the hard gate)

A pure-vitest check (no browser) that every fg/bg semantic pair in every theme meets WCAG AA in **both** light and dark. Uses `culori.wcagContrast` so the OKLCH→sRGB→ratio math is library-correct, not hand-rolled in a gate.

**Threshold policy (decide against the Neutral baseline first):** body pairs ≥ **4.5**; `muted-foreground/muted` is secondary/large text → ≥ **3.0** (WCAG AA large). Step 1 measures Neutral to confirm this split is honest before locking it. If Neutral's `muted-foreground` actually clears 4.5, raise it to 4.5 for all and drop the exception.

**Files:**
- Create: `lib/tokens/contrast.ts`
- Create: `tests/themes/contrast.test.ts`

- [ ] **Step 1: Characterize Neutral** — a throwaway snippet (or a `console.log` in the test, run once) prints `wcagContrast` for each pair in `themes/neutral.css`, light + dark. Record the numbers. Confirm which pairs sit below 4.5 (expect only `muted-foreground`). Lock the threshold policy from real numbers, not assumption. Note results in the commit message.

- [ ] **Step 2: Write `lib/tokens/contrast.ts`**

```ts
// lib/tokens/contrast.ts
import { wcagContrast } from "culori";
import type { Token, Theme } from "./types";
import { foregroundFor } from "./schema";

export interface PairResult {
  bg: string;
  fg: string;
  theme: Theme;
  ratio: number;
  min: number;
  pass: boolean;
}

/** Resolve a token's effective value for a theme: dark falls back to light if not overridden. */
function effective(tokens: Token[], name: string, theme: Theme): string | undefined {
  if (theme === "dark") {
    const d = tokens.find((t) => t.name === name && t.theme === "dark");
    if (d) return d.value;
  }
  return tokens.find((t) => t.name === name && t.theme === "light")?.value;
}

/** Secondary/large-text pairs allowed at the AA-large 3:1 threshold. */
const LARGE_OK = new Set(["--muted-foreground"]);

export function contrastResults(tokens: Token[]): PairResult[] {
  const out: PairResult[] = [];
  const bgNames = [...new Set(tokens.map((t) => t.name))].filter((n) => foregroundFor(n));
  for (const theme of ["light", "dark"] as Theme[]) {
    for (const bg of bgNames) {
      const fg = foregroundFor(bg)!;
      const bgv = effective(tokens, bg, theme);
      const fgv = effective(tokens, fg, theme);
      if (!bgv || !fgv) continue;
      const ratio = wcagContrast(fgv, bgv);
      const min = LARGE_OK.has(fg) ? 3.0 : 4.5;
      out.push({ bg, fg, theme, ratio, min, pass: ratio >= min });
    }
  }
  return out;
}
```

- [ ] **Step 3: Write `tests/themes/contrast.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { contrastResults } from "@/lib/tokens/contrast";

// existsSync-filtered, same green-between-commits strategy as parity.test.ts.
const THEMES = ["neutral", "swiss", "brutalist"].filter((n) => existsSync(resolve(`themes/${n}.css`)));

describe.each(THEMES)("WCAG AA: %s", (name) => {
  const css = readFileSync(resolve(`themes/${name}.css`), "utf8");
  const results = contrastResults(parseTokens(css));
  it("evaluates at least the core semantic pairs", () => {
    expect(results.length).toBeGreaterThanOrEqual(16); // 10 pairs × 2 themes = 20; ≥16 is margin
  });
  it("no fg/bg pair uses a translucent (alpha) value — ratio would be meaningless", () => {
    for (const r of results) {
      const v = `${r.fg}/${r.bg}`;
      const tokens = parseTokens(css);
      const has = (name: string) => tokens.some((t) => t.name === name && /\/\s*[\d.]/.test(t.value));
      expect(has(r.fg) || has(r.bg), `alpha in pair ${v}`).toBe(false);
    }
  });
  for (const r of results) {
    it(`${r.theme}: ${r.fg} on ${r.bg} ≥ ${r.min} (got ${r.ratio?.toFixed(2)})`, () => {
      expect(r.ratio).toBeGreaterThanOrEqual(r.min);
    });
  }
});
```

- [ ] **Step 4: Run** `npx vitest run tests/themes/contrast.test.ts`
Expected: PASS — only `neutral` exists at this point, so Neutral's pairs are checked (it ships, must pass). Swiss/Brutalist auto-join the run once authored in Task 5; no edit to this file needed.

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/contrast.ts tests/themes/contrast.test.ts
git commit -m "feat(m3a): WCAG-AA contrast gate over theme files (culori); Neutral baseline locked"
```

---

### Task 6: Author Swiss + Brutalist value-sets (visual loop)

This is the convergent creative task. For **each** theme: draft values from the mini-brief → run the contrast + parity gates → fix failures → screenshot (Task 7 machinery) → critique vs `DESIGN-BRIEF.md` → revise. Author against the gates; the gates are the floor, the brief is the target.

**Files:**
- Create: `themes/swiss.css`, `themes/brutalist.css`
- Modify: `tests/themes/parity.test.ts` (add the "all 3 v1 themes exist" assertion)

> **Token-name reminder (parity will enforce):** the authored runtime spacing token is **`--spacing-base`** (not `--spacing` — that name only exists in the `@theme inline` mapping, which themes never touch). Keep `--spacing-base` in every theme file. The parity gate fails loudly on any renamed/dropped name, so copy `themes/neutral.css` as the starting point rather than hand-typing the name set.

**Authoring guidance (direction, not exact values — tune to pass gates + brief):**

- **Swiss** (`docs/DESIGN-BRIEF.md` §2): near-monochrome — true black/white/grey, near-zero chroma. One *tiny* signal accent (a single restrained red, e.g. `oklch(0.55 0.22 27)`, used only as `--primary`/`--ring` or as `--destructive`). `--radius: 0`. Hairline borders: keep `--border-width-thin: 1px`, set `--border-width-base/thick` modest (no thick brutalist slabs). **No shadows:** set `--elevation-sm/md/lg` to `none` (the `shadow` validator accepts any non-empty string; `none` is valid). Strong type-scale contrast is already in the token set (xs→7xl); Swiss leans on it — no token change needed beyond keeping `--font-sans` = bundled sans. Backgrounds pure white `oklch(1 0 0)` / near-black dark.
- **Brutalist** (§5): stark black/white + 1–2 loud primaries (electric blue `oklch(0.55 0.24 255)`, hot red, or acid yellow) used at full chroma for `--primary`/`--accent`. `--radius: 0`. **Thick borders:** raise `--border-width-base`/`--border-width-thick` (e.g. 3px/6px). **Hard offset shadows, no blur:** `--elevation-md: 4px 4px 0 0 oklch(0 0 0)` etc. (zero blur radius = the brutalist signature). `--font-sans: var(--font-bundled-mono), ui-monospace, …` — mono carries the blunt feel (bundled, no `lib/fonts.ts` change). Keep contrast high — loud ≠ failing AA.

- [ ] **Step 1: Draft `themes/swiss.css`** — full `:root` (every Neutral name, Swiss values) + `.dark` (color overrides; if Swiss wants `none` shadows in dark too they inherit from `:root`). Start by copying `themes/neutral.css` and editing values, so the name set stays exact (satisfies parity).

- [ ] **Step 2: Draft `themes/brutalist.css`** — same approach.

- [ ] **Step 3: Add the "all 3 v1 themes exist" guard** to `tests/themes/parity.test.ts` (closes the existsSync-filter's "silently untested" gap now that the files exist):

```ts
it("all 3 v1 themes are present on disk", () => {
  for (const n of ["neutral", "swiss", "brutalist"]) {
    expect(existsSync(resolve(`themes/${n}.css`)), `themes/${n}.css missing`).toBe(true);
  }
});
```

The `existsSync`-filtered `describe.each` in both gate files now auto-covers Swiss + Brutalist — no list edits needed.

- [ ] **Step 4: Run gates**

Run: `npx vitest run tests/themes/`
Expected: parity PASS (3 themes share the name set + existence guard); contrast PASS in both light + dark for all 3 themes. **Iterate values until green** — darken a foreground, lift a background, bump chroma down. Do not weaken the thresholds to pass.

- [ ] **Step 5: Apply each theme + confirm it builds**

```bash
npm run theme swiss && npm run build
npm run theme brutalist && npm run build
npm run theme neutral   # restore default
```
Expected: each `next build` succeeds (no off-token compile errors introduced). Tree clean after restoring neutral.

- [ ] **Step 6: Commit (function complete; aesthetic refined in Task 7)**

```bash
git add themes/swiss.css themes/brutalist.css tests/themes/parity.test.ts tests/themes/contrast.test.ts
git commit -m "feat(m3a): author Swiss + Brutalist value-sets — pass WCAG-AA + parity gates"
```

---

### Task 7: Overflow gate + gallery screenshots (injection) + visual critique loop

Screenshots and the overflow gate **inject** the theme's `:root`/`.dark` CSS onto the running `/design-system` page via `page.addStyleTag` (appended to `<head>`, so its same-specificity `:root`/`.dark` rules win on source order). This is deterministic — no `globals.css` swap, no dev-server recompile race, no restore dance. The injected vars drive the same `@theme inline var()` utilities, so the render is faithful.

> **Dark mode — the real mechanism (verified by review).** The app has **no theme toggle and no theme provider**: `app/layout.tsx` renders a static `<html>`, and `globals.css` keys dark on the `.dark` class (`@custom-variant dark (&:where(.dark, .dark *))`) — NOT `prefers-color-scheme`. So dark screenshots are produced **only** by `document.documentElement.classList.add("dark")`; `emulateMedia({colorScheme})` is irrelevant here and is dropped. **Caveat (same class as the overflow caveat):** `/design-system` was authored and tested light-only (M3 e2e never sets `.dark`), so the dark gallery shots are a brand-new render path — any dark glitch they surface is an **M3 page bug**, not a theme bug; note it for a separate fix, don't try to fix the page inside a theme file.

**Files:**
- Create: `e2e/themes.spec.ts` (overflow gate — runs in the normal suite)
- Create: `e2e/gallery.spec.ts` (committed PNGs — env-guarded, skipped in the normal suite)
- Create: `themes/screenshots/` (committed output)
- Modify: `package.json` (`"gallery"` script)

- [ ] **Step 1: Write the overflow gate** `e2e/themes.spec.ts`

```ts
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const THEMES = ["neutral", "swiss", "brutalist"];
const themeCss = (name: string) => readFileSync(resolve(`themes/${name}.css`), "utf8");

for (const name of THEMES) {
  test(`${name}: no horizontal overflow at any breakpoint`, async ({ page }) => {
    for (const width of [375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/design-system");
      await page.addStyleTag({ content: themeCss(name) });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, `${name} overflow at ${width}px`).toBe(false);
    }
  });
}
```

- [ ] **Step 2: Run** `npx playwright test e2e/themes.spec.ts`
Expected: PASS for all 3 themes × 4 widths. (Brutalist's thick borders are the likely offender — if it overflows, the page's container/padding already absorbed Neutral; fix by confirming borders are inside `box-sizing: border-box`, which Tailwind sets globally. If a specific demo overflows, that's a page bug to note, not a theme bug.)

- [ ] **Step 3: Write `e2e/gallery.spec.ts`** — a Playwright **spec** (not a standalone script), so it reuses the configured `webServer` + `baseURL` (no manual `npm run dev`, no `localhost` hardcode, no top-level `await`). Env-guarded so the normal `npx playwright test` skips it (it writes committed files — must not run/dirty the tree on every CI invocation):

```ts
import { test } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Generation-only: skipped unless GALLERY=1. Writes committed PNGs; never part of the gate suite.
test.skip(!process.env.GALLERY, "gallery generation — run with GALLERY=1");

const THEMES = ["neutral", "swiss", "brutalist"];
const OUT = resolve("themes/screenshots");

test("generate theme gallery (light + dark)", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const name of THEMES) {
    const css = readFileSync(resolve(`themes/${name}.css`), "utf8");

    // light
    await page.goto("/design-system");
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.addStyleTag({ content: css });
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

    // dark — the ONLY mechanism: add the .dark class (no toggle/provider exists)
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.addStyleTag({ content: css });
    await page.screenshot({ path: `${OUT}/${name}-dark.png`, fullPage: true });
  }
});
```

Add to `package.json` scripts: `"gallery": "GALLERY=1 playwright test e2e/gallery.spec.ts"`.

- [ ] **Step 4: Generate + self-critique (the visual loop)**

```bash
npm run gallery   # boots its own webServer via playwright.config.ts; writes themes/screenshots/
```
Then `Read` each `themes/screenshots/*.png` and grade against `DESIGN-BRIEF.md`:
1. Coherence — one intentional system?
2. Distinctiveness — could you tell Swiss from Brutalist from Neutral in a thumbnail?
3. Liveability — would a builder be happy starting here?

Revise `themes/swiss.css` / `themes/brutalist.css` values, re-run gates (Task 6 Step 4) + `npm run gallery`, repeat until each reads as its brief. **Off-token compile is not a risk here (values only), but re-run the contrast gate after every value change.**

- [ ] **Step 5: HUMAN CHECKPOINT** — present the final light+dark screenshots for all 3 themes to the user. Do not proceed to the README/merge until the user approves the aesthetic. (Per HANDOFF: the user reviews screenshots before "done"; strong design opinions.)

- [ ] **Step 6: Commit** (after approval)

```bash
git add e2e/themes.spec.ts e2e/gallery.spec.ts package.json themes/screenshots/
git commit -m "feat(m3a): overflow gate + committed gallery screenshots (light+dark)"
```

---

### Task 8: README gallery + docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a Themes section** to `README.md`:

```markdown
## Themes

Pick a look at adoption time, then fine-tune in the editor. Default is **Neutral** (already applied — doing nothing is valid).

```bash
npm run theme neutral    # calm, professional default
npm run theme swiss      # austere, monochrome, grid + whitespace
npm run theme brutalist  # raw, thick borders, hard shadows, mono
```

`npm run theme <name>` swaps the preset's values into `app/globals.css` and regenerates the manifest. Names are the fixed contract; only values change.

| Neutral | Swiss | Brutalist |
|---|---|---|
| ![Neutral](themes/screenshots/neutral.png) | ![Swiss](themes/screenshots/swiss.png) | ![Brutalist](themes/screenshots/brutalist.png) |

_(Five more themes — Editorial, Warm, Pastel, Technical, Corporate — are a fast-follow on the same machinery.)_
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(m3a): README theme gallery + npm run theme usage"
```

---

### Task 9: Full suite green + merge

- [ ] **Step 1: Restore Neutral as the committed default**

```bash
npm run theme neutral && git status --porcelain   # expect clean
```

- [ ] **Step 2: Full suite**

```bash
npm test        # vitest — expect 88 + new theme tests, all green
npx playwright test   # e2e — expect prior 4 + themes.spec (3) green
```
Expected: all green. Note exact counts.

- [ ] **Step 3: Update HANDOFF + spec status** — mark M3a done in `docs/HANDOFF.md` (move it from "next steps" to "where we are"; record the 3 themes, `npm run theme`, the gates, the gallery). Commit:

```bash
git add docs/HANDOFF.md
git commit -m "docs(m3a): mark M3a complete in handoff"
```

- [ ] **Step 4: Merge**

```bash
git switch main
git merge --no-ff m3a-theme-presets -m "Merge M3a: theme preset suite (Swiss + Brutalist + gallery)"
git branch -d m3a-theme-presets
```

- [ ] **Step 5: Verify on main** — `npm test && npx playwright test` green on `main`.

---

## Gates summary (every theme must pass)

- **Parity** (vitest): same `:root` name set as Neutral; `.dark` ⊆ that set.
- **WCAG AA** (vitest, `culori`): body fg/bg pairs ≥ 4.5, secondary (`muted-foreground`) ≥ 3.0, in **both** light and dark.
- **No overflow** (Playwright): `/design-system` at 375/768/1024/1280 under each theme.
- **Builds** (`next build`): each applied theme compiles (no off-token utilities introduced).
- **Aesthetic** (human checkpoint): coherent, distinct in a thumbnail, liveable — graded vs `DESIGN-BRIEF.md`.

## Risks / honest boundaries

- **Injection ≠ file-swap.** Screenshots/overflow use `addStyleTag` injection; `npm run theme` does the real file swap. Both drive the same vars, so the render is faithful — but the round-trip identity test (Task 2) + the `next build` check (Task 6 Step 5) are what prove the *file-swap* path is correct. Injection alone wouldn't catch a malformed theme file that breaks the cascade; the build check does.
- **culori is a new dependency** in a project that pins carefully. It's devDependency-only (gate math), canonical, and removes hand-rolled OKLCH→sRGB risk in a *correctness gate*. If the reviewer objects, the fallback is a hand-rolled converter TDD'd against known anchors (white=21:1 on black, etc.) — more code, more risk.
- **`muted-foreground` threshold.** Set from the measured Neutral baseline (Task 5 Step 1), not assumed. If Neutral clears 4.5, the 3.0 exception is dropped.
- **Dark-mode screenshots use the `.dark` class** — confirmed the only mechanism (no toggle/provider; `globals.css` `@custom-variant dark` keys on `.dark`, not `prefers-color-scheme`). `/design-system` was authored/tested light-only, so dark shots are a new render path: any glitch they expose is an **M3 page bug** to fix separately, not a theme-file fix.
- **Overflow gate runs light-only** (matching M3's existing gate); thick-border themes (Brutalist) are the likely offender. Tailwind's global `box-sizing: border-box` keeps borders inside the box, so this should pass — but if a specific demo overflows, treat it as a page bug to note, not a theme bug.
