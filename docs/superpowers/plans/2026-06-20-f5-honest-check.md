# F5 — Honest standalone `check` Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm run check` reject below-AA color pairs and one-theme-only invented colors in `app/globals.css` standalone, reusing `lib/tokens/contrast.ts` as the single source of truth — without crashing on `var()`/`color-mix()` or false-passing alpha.

**Architecture:** Two leaks closed via shared lib. (1) `lib/tokens/contrast.ts` pairs `--x`/`--x-foreground` **structurally** (was `COLOR_ROLES`-gated) and **skips** unresolvable/alpha pairs; both the new check and the existing theme tests consume it. (2) A new pure sub-check `lib/check/contrast.ts` runs `contrastResults` over globals and emits findings; `lib/check/both-theme.ts` broadens from `COLOR_ROLES` to all color-valued tokens (ramps exempt). Docs corrected to match.

**Tech Stack:** TypeScript, Vitest, `culori` (`wcagContrast`), the `lib/check/` harness, `lib/tokens/{parse,schema}.ts`.

**Spec:** [docs/superpowers/specs/2026-06-20-f5-honest-check-design.md](../specs/2026-06-20-f5-honest-check-design.md)

**Branch:** `f5-honest-check` (already created).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/tokens/contrast.ts` | structural pairing + unresolvable/alpha skip (single source of truth) | Modify |
| `tests/themes/contrast.test.ts` | existing theme AA tests — must stay green (regression) | Verify |
| `tests/tokens/contrast-pairing.test.ts` | structural-pairing + skip regression for the lib | Create |
| `lib/check/contrast.ts` | `checkContrast(globalsCss)` — findings per below-AA pair | Create |
| `lib/check/messages.ts` | `MSG.contrastBelow` (names token+block+L-direction+target) | Modify |
| `lib/check/run.ts` | wire `checkContrast(globals)` into the globals-level checks | Modify |
| `lib/check/both-theme.ts` | broaden `COLOR_ROLES` → all color-valued tokens (ramps exempt) | Modify |
| `tests/check/contrast.test.ts` | flagged / passing / skip / message cases for the sub-check | Create |
| `tests/check/both-theme.test.ts` | broadened-flag + ramp-exempt + non-color cases (file EXISTS — append) | Extend |
| `lib/tokens/generate.ts` | preamble: add the WCAG-AA caveat to "Color — extend freely" | Modify |
| `design-system.md` / `design-system.json` | regenerated via `npm run tokens` after generate.ts edit | Regenerate |
| `AGENTS.md` | recovery table: add `contrast` row | Modify |
| `docs/HANDOFF.md` | correct the false "pairs ANY" claim (:39); update both-theme desc (:23); F5→done | Modify |
| `docs/M6-DOGFOOD.md` | F5 ledger → done; correct the "auto-pairs ANY" note | Modify |

**Note:** `.cursor/rules/design-system.mdc` only *points* to AGENTS.md for the recovery table — **no mirror edit needed** (verified). The spec's "mirror the row" item is a no-op here.

---

## Task 1: Structural pairing + skip in `lib/tokens/contrast.ts`

**Files:**
- Modify: `lib/tokens/contrast.ts`
- Create: `tests/tokens/contrast-pairing.test.ts`
- Verify (no edit): `tests/themes/contrast.test.ts`

Current pairing (contrast.ts:31-37) builds pairs via `foregroundFor(n)` (COLOR_ROLES-gated). Replace with structural pairing keyed on token presence, and add a resolvable-opaque guard inside the loop.

- [ ] **Step 1: Write the failing test** — `tests/tokens/contrast-pairing.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { contrastResults } from "@/lib/tokens/contrast";
import type { Token } from "@/lib/tokens/types";

const tok = (name: string, value: string, theme: "light" | "dark" = "light"): Token =>
  ({ name, value, theme } as Token);

describe("contrastResults — structural pairing", () => {
  it("pairs an invented --x/--x-foreground outside COLOR_ROLES", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "oklch(0.99 0 0)"),
    ];
    const r = contrastResults(tokens);
    expect(r.some((p) => p.bg === "--promo" && p.fg === "--promo-foreground")).toBe(true);
  });

  it("skips a pair whose value is var()/color-mix() (no throw, no result)", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "var(--foreground)"),
    ];
    expect(() => contrastResults(tokens)).not.toThrow();
    expect(contrastResults(tokens).some((p) => p.fg === "--promo-foreground")).toBe(false);
  });

  it("skips an alpha pair (no bogus 21:1 pass)", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "oklch(1 0 0 / 0.1)"),
    ];
    expect(contrastResults(tokens).some((p) => p.fg === "--promo-foreground")).toBe(false);
  });

  it("still pairs --background/--foreground explicitly", () => {
    const tokens = [tok("--background", "oklch(1 0 0)"), tok("--foreground", "oklch(0.15 0 0)")];
    const r = contrastResults(tokens);
    expect(r.some((p) => p.bg === "--background" && p.fg === "--foreground")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/tokens/contrast-pairing.test.ts`
Expected: FAIL — invented `--promo` not paired (foregroundFor is COLOR_ROLES-gated); the alpha case currently returns a bogus passing pair.

- [ ] **Step 3: Implement** — edit `lib/tokens/contrast.ts`

Add a resolvable-opaque helper and replace the pair construction. Reuse `isColorValue` from schema. Alpha detection mirrors the test suite's `/\/\s*[\d.]/`.

```ts
import { wcagContrast } from "culori";
import type { Token, Theme } from "./types";
import { isColorValue } from "./schema";

// ... PairResult, effective(), LARGE_OK unchanged ...

/** A value we can statically measure: a literal, opaque color. var()/color-mix()/calc() are
 *  unresolvable here; alpha makes wcagContrast meaningless (culori ignores it → bogus 21:1). */
function measurable(v: string | undefined): boolean {
  return !!v && isColorValue(v) && !/\/\s*[\d.]/.test(v);
}

export function contrastResults(tokens: Token[]): PairResult[] {
  const out: PairResult[] = [];
  const names = [...new Set(tokens.map((t) => t.name))];
  const present = new Set(names);
  // --background/--foreground is the one body pair not following the -foreground convention.
  const pairs: Array<[string, string]> = [["--background", "--foreground"]];
  for (const bg of names) {
    if (bg.endsWith("-foreground")) continue;
    const fg = `${bg}-foreground`;
    if (present.has(fg)) pairs.push([bg, fg]);
  }
  for (const theme of ["light", "dark"] as Theme[]) {
    for (const [bg, fg] of pairs) {
      const bgv = effective(tokens, bg, theme);
      const fgv = effective(tokens, fg, theme);
      if (!measurable(bgv) || !measurable(fgv)) continue; // skip unresolvable/alpha (no throw, no false pass)
      const ratio = wcagContrast(fgv!, bgv!);
      const min = LARGE_OK.has(fg) ? 3.0 : 4.5;
      out.push({ bg, fg, theme, ratio, min, pass: ratio >= min });
    }
  }
  return out;
}
```

Remove the now-unused `foregroundFor` import. (`foregroundFor` stays in schema.ts — still used by the editor; only contrast.ts stops importing it.)

- [ ] **Step 4: Run new + existing theme tests — expect PASS**

Run: `npx vitest run tests/tokens/contrast-pairing.test.ts tests/themes/contrast.test.ts`
Expected: PASS. Theme tests still produce 22 pairs all-AA (the `>= 16` and no-alpha assertions hold — themes are opaque literal oklch; `--border`/`--input` alpha have no `-foreground` partner).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/contrast.ts tests/tokens/contrast-pairing.test.ts
git commit -m "feat(f5): contrast pairs --x/--x-foreground structurally; skips var()/color-mix()/alpha"
```

---

## Task 2: New `checkContrast` sub-check + message + wiring

**Files:**
- Create: `lib/check/contrast.ts`
- Modify: `lib/check/messages.ts`, `lib/check/run.ts`
- Create: `tests/check/contrast.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/check/contrast.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkContrast } from "@/lib/check/contrast";

const wrap = (root: string, dark = "") =>
  `@import "tailwindcss";\n:root {\n--background: oklch(1 0 0);\n--foreground: oklch(0.15 0 0);\n${root}\n}\n.dark {\n--background: oklch(0.15 0 0);\n--foreground: oklch(0.99 0 0);\n${dark}\n}\n`;

describe("checkContrast", () => {
  it("flags a below-AA invented pair in :root", () => {
    const css = wrap(`--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`,
                     `--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`);
    const f = checkContrast(css);
    expect(f.some((x) => x.rule === "contrast" && x.message.includes("--promo-foreground"))).toBe(true);
  });

  it("message names the block and the target ratio", () => {
    const css = wrap(`--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`);
    const msg = checkContrast(css).find((x) => x.rule === "contrast")!.message;
    expect(msg).toMatch(/:root|\.dark/);
    expect(msg).toContain("4.5");
    expect(msg).toContain("npm run tokens");
  });

  it("does not crash and does not flag a var()-indirected foreground", () => {
    const css = wrap(`--promo: oklch(0.6 0.2 250);\n--promo-foreground: var(--foreground);`);
    expect(() => checkContrast(css)).not.toThrow();
    expect(checkContrast(css).some((x) => x.message.includes("--promo-foreground"))).toBe(false);
  });

  it("passes the real app/globals.css (baseline guard)", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(checkContrast(css)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/check/contrast.test.ts`
Expected: FAIL — `checkContrast` not defined.

- [ ] **Step 3: Add the message** — `lib/check/messages.ts`, inside the `MSG` object

```ts
  contrastBelow: (fg: string, bg: string, theme: "light" | "dark", ratio: number, min: number) =>
    `${fg} on ${bg} is ${ratio.toFixed(2)}:1 in ${theme === "dark" ? ".dark" : ":root"} — below the ` +
    `${min}:1 WCAG-AA minimum. In the ${theme === "dark" ? ".dark" : ":root"} block of app/globals.css, ` +
    `move ${fg}'s oklch lightness (L) away from ${bg}'s L (raise L for light text on a dark bg, lower it ` +
    `for dark text on a light bg) until the ratio is ≥ ${min}:1, then npm run tokens.`,
```

- [ ] **Step 4: Implement the sub-check** — `lib/check/contrast.ts`

```ts
import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { contrastResults } from "@/lib/tokens/contrast";

/** Every measurable fg/bg color pair in globals.css must clear WCAG-AA (4.5, or 3.0 for muted/large).
 *  Pairs with unresolvable/alpha values are skipped upstream in contrastResults (see spec §6 residuals). */
export function checkContrast(globalsCss: string): Finding[] {
  return contrastResults(parseTokens(globalsCss))
    .filter((r) => !r.pass)
    .map((r) => ({
      file: "app/globals.css",
      line: 0,
      rule: "contrast",
      message: MSG.contrastBelow(r.fg, r.bg, r.theme, r.ratio, r.min),
    }));
}
```

- [ ] **Step 5: Wire into `run.ts`** — `lib/check/run.ts`

Add the import and the call alongside the existing globals-level checks:

```ts
import { checkContrast } from "./contrast";
// ... after all.push(...checkBothTheme(globals)); :
all.push(...checkContrast(globals));
```

- [ ] **Step 6: Run tests — expect PASS**

Run: `npx vitest run tests/check/contrast.test.ts`
Expected: PASS (incl. the baseline guard on the real globals.css).

- [ ] **Step 7: Commit**

```bash
git add lib/check/contrast.ts lib/check/messages.ts lib/check/run.ts tests/check/contrast.test.ts
git commit -m "feat(f5): checkContrast sub-check over globals.css with redirecting message"
```

---

## Task 3: Broaden `both-theme` to all color tokens

**Files:**
- Modify: `lib/check/both-theme.ts`
- Create or extend: `tests/check/both-theme.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/check/both-theme.test.ts` **already exists with 2 passing tests — APPEND this `describe` block, do not overwrite** (the existing tests stay green under the broadened logic; reuse its imports if present)

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkBothTheme } from "@/lib/check/both-theme";

const css = (root: string, dark: string) =>
  `:root {\n${root}\n}\n.dark {\n${dark}\n}\n`;

describe("checkBothTheme — broadened to all color tokens", () => {
  it("flags an invented color present in :root only (no -foreground)", () => {
    const f = checkBothTheme(css(`--promo: oklch(0.6 0.2 250);`, ``));
    expect(f.some((x) => x.rule === "both-theme" && x.message.includes("--promo"))).toBe(true);
  });

  it("does NOT flag a brand ramp present in :root only (ramp exempt)", () => {
    const f = checkBothTheme(css(`--brand-600: oklch(0.5 0.2 250);`, ``));
    expect(f.some((x) => x.message.includes("--brand-600"))).toBe(false);
  });

  it("does NOT flag a non-color token present in one block only", () => {
    const f = checkBothTheme(css(`--duration-fast: 120ms;`, ``));
    expect(f.some((x) => x.message.includes("--duration-fast"))).toBe(false);
  });

  it("passes the real app/globals.css (baseline guard)", () => {
    expect(checkBothTheme(readFileSync(resolve("app/globals.css"), "utf8"))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/check/both-theme.test.ts`
Expected: FAIL — `--promo` (not in COLOR_ROLES) not flagged by the current role-gated loop.

- [ ] **Step 3: Implement** — rewrite the body of `lib/check/both-theme.ts`

```ts
import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { isColorValue } from "@/lib/tokens/schema";

const isRamp = (name: string) => /^--(brand|chart)-/.test(name);

/** Every color-valued token (by value, ramps exempt) defined in :root must also be in .dark and
 *  vice-versa. Ramps (--brand-/--chart-) are intentionally allowed in one block; non-color tokens
 *  are exempt. */
export function checkBothTheme(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const valueOf = (name: string) =>
    tokens.find((t) => t.name === name && t.theme === "light")?.value ??
    tokens.find((t) => t.name === name && t.theme === "dark")?.value;
  const light = new Set(tokens.filter((t) => t.theme === "light").map((t) => t.name));
  const dark = new Set(tokens.filter((t) => t.theme === "dark").map((t) => t.name));
  const colorNames = [...new Set([...light, ...dark])].filter(
    (n) => !isRamp(n) && isColorValue(valueOf(n) ?? ""),
  );
  const out: Finding[] = [];
  for (const name of colorNames) {
    if (light.has(name) && !dark.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "dark") });
    else if (dark.has(name) && !light.has(name))
      out.push({ file: "app/globals.css", line: 0, rule: "both-theme", message: MSG.bothThemeMissing(name, "light") });
  }
  return out;
}
```

(Drop the now-unused `COLOR_ROLES` import.)

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/check/both-theme.test.ts`
Expected: PASS (incl. baseline guard).

- [ ] **Step 5: Commit**

```bash
git add lib/check/both-theme.ts tests/check/both-theme.test.ts
git commit -m "feat(f5): both-theme covers all color tokens (ramps exempt), not just COLOR_ROLES"
```

---

## Task 4: Docs — correct the contract so it's honest

**Files:**
- Modify: `lib/tokens/generate.ts` (preamble), then regenerate `design-system.{md,json}`
- Modify: `AGENTS.md`, `docs/HANDOFF.md`, `docs/M6-DOGFOOD.md`

- [ ] **Step 1: Add the AA caveat to the generated preamble** — `lib/tokens/generate.ts`

After the "Color — extend freely" code block's "then `npm run tokens` → use `bg-highlight ...`" line, add one line:

```
**The `<name>`/`<name>-foreground` pair must clear WCAG-AA contrast** (4.5:1, or 3:1 for large/muted text) in **both** blocks, or `npm run check` fails.
```

(Match the surrounding escaped-backtick string style in generate.ts.)

- [ ] **Step 2: Regenerate the manifest**

Run: `npm run tokens`
Expected: `design-system.md` + `design-system.json` updated (preamble line now present). This is required or `manifest-fresh` fails.

- [ ] **Step 3: Add the `contrast` row to the AGENTS.md recovery table** — `AGENTS.md` (after the off-token radius row)

```
| color pair below WCAG-AA contrast | raise/lower the foreground token's oklch L in the failing block (`:root` or `.dark`) until ≥ 4.5:1 (3:1 for muted/large), then `npm run tokens` |
```

- [ ] **Step 4: Correct HANDOFF.md + M6-DOGFOOD.md**

- `docs/HANDOFF.md:39` (F5 bullet): change status to ✅ DONE; remove/correct the "pairs ANY `--x`/`--x-foreground`" claim (now true after Task 1); state `check` is now honest **for the consumer edit-globals loop**, with the spec §6 residuals named (no-`-foreground` color, orphan foreground, var()/color-mix/alpha skipped, theme-completeness author-only).
- `docs/HANDOFF.md:23` (M5 line): update "both-theme (semantic `COLOR_ROLES` only …)" → "all color tokens, ramps exempt".
- `docs/HANDOFF.md:27` and the Next-steps list: mark F5 done; drop it from "remaining fast-follows".
- `docs/M6-DOGFOOD.md`: F5 ledger entry → done; correct the "auto-pairs ANY" note to reflect the structural fix.

- [ ] **Step 5: Verify the full gate is green**

Run: `npm run check`
Expected: `✓ design-system check passed (4 ds-disable in use)` — manifest fresh, contrast + both-theme green on the real repo.

- [ ] **Step 6: Commit**

```bash
git add lib/tokens/generate.ts design-system.md design-system.json AGENTS.md docs/HANDOFF.md docs/M6-DOGFOOD.md
git commit -m "docs(f5): AA caveat in preamble + AGENTS contrast row; correct false 'pairs ANY' claim; F5 done"
```

---

## Task 5: Full-suite verification + merge

**Files:** none (verification + integration)

- [ ] **Step 1: Full vitest suite**

Run: `npm test`
Expected: all pass (337 baseline + the new contrast-pairing/check-contrast/both-theme tests). Self-pass (`tests/check/self.test.ts`) green — zero new findings on the repo.

- [ ] **Step 2: Lint + e2e**

Run: `npm run lint && npx playwright test`
Expected: lint 0; e2e 16 pass (+1 gallery skipped). (No UI change in F5 — e2e should be untouched; run to confirm no regression.)

- [ ] **Step 3: Manual standalone-honesty check (the F5 point)**

In a scratch edit (do NOT commit): add `--promo: oklch(0.85 0.1 250); --promo-foreground: oklch(0.9 0.05 250);` to `:root` only in `app/globals.css`, then run `npm run check`.
Expected: non-zero exit with BOTH a `both-theme` finding (`--promo` missing from `.dark`) AND, once added to `.dark` too, a `contrast` finding naming the block + target ratio. Revert the scratch edit (`git checkout app/globals.css`).

- [ ] **Step 4: Verify before claiming done** — @superpowers:verification-before-completion

Confirm: `npm run check` + `npm test` + `npm run lint` all green; scratch edit reverted; working tree clean.

- [ ] **Step 5: Merge to main**

Use @superpowers:finishing-a-development-branch. Squash/`--no-ff` per project convention (one milestone per branch), full suite green before merge, delete the branch after.

```bash
git checkout main && git merge --no-ff f5-honest-check && git branch -d f5-honest-check
```

---

## Done =

`npm run check` standalone rejects below-AA pairs and one-theme-only invented colors in `app/globals.css` with redirecting messages; never crashes on `var()`/`color-mix()`, never false-passes alpha; the theme tests + self-pass stay green (single source of truth, no regression); docs corrected (HANDOFF:39 claim now true, AA caveat in the preamble, AGENTS contrast row); F5 marked done in the ledgers with residuals named.
