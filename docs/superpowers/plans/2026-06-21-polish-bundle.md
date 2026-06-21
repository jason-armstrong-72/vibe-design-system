# Polish bundle (F5 cosmetic + F1 nudge) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `checkContrast` double-reporting a `.dark` contrast finding for a `:root`-only token, and nudge the LLM contract to extend rather than reuse a semantically-wrong token.

**Architecture:** Part A is a one-line filter added to `lib/check/contrast.ts` (shared `contrastResults`/`effective` untouched, so theme tests are unaffected). Part B is a doc-only sentence in the generated manifest preamble (`lib/tokens/generate.ts` → `npm run tokens`) and `AGENTS.md`.

**Tech Stack:** TypeScript, Vitest, the `lib/check/` harness, the `lib/tokens/generate.ts` manifest generator.

**Spec:** [docs/superpowers/specs/2026-06-21-polish-bundle-design.md](../specs/2026-06-21-polish-bundle-design.md)

**Branch:** `polish-bundle` (already created).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/check/contrast.ts` | suppress pure-fallback dark contrast finding | Modify |
| `tests/check/contrast.test.ts` | `:root`-only single-finding + both-block two-finding cases | Extend |
| `lib/tokens/generate.ts` | F1 nudge in the generated preamble | Modify |
| `design-system.{md,json}` | regenerated via `npm run tokens` | Regenerate |
| `AGENTS.md` | F1 nudge in "Need a value" paragraph | Modify |
| `docs/M6-DOGFOOD.md` | mark F5 cosmetic + F1 addressed | Modify |

---

## Task 1: Part A — suppress pure-fallback dark contrast finding

**Files:** Modify `lib/check/contrast.ts`; extend `tests/check/contrast.test.ts`.

The existing `tests/check/contrast.test.ts` helper is:
```ts
const wrap = (root: string, dark = "") => `@import "tailwindcss";\n:root {\n--background: oklch(1 0 0);\n--foreground: oklch(0.15 0 0);\n${root}\n}\n.dark {\n--background: oklch(0.15 0 0);\n--foreground: oklch(0.99 0 0);\n${dark}\n}\n`;
```
**Single-arg `wrap(root)` = a `:root`-only token** (`.dark` gets only background/foreground). **Two-arg `wrap(root, dark)` = a both-block token.** Use this distinction below.

- [ ] **Step 1: Add failing tests** — append inside the `describe("checkContrast", …)` in `tests/check/contrast.test.ts`

```ts
  it("reports a :root-only below-AA pair ONCE (not a redundant .dark finding)", () => {
    // single-arg wrap → --promo present in :root only (no own .dark)
    const css = wrap(`--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`);
    const findings = checkContrast(css).filter((f) => f.message.includes("--promo-foreground"));
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain(":root");
  });
  it("still reports a both-block below-AA pair in BOTH themes", () => {
    const pair = `--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`;
    const findings = checkContrast(wrap(pair, pair)).filter((f) => f.message.includes("--promo-foreground"));
    expect(findings.length).toBe(2); // :root + .dark (real own-dark, not fallback)
  });
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run tests/check/contrast.test.ts`
Expected: the first new case fails (currently 2 findings for the `:root`-only pair).

- [ ] **Step 3: Implement** — edit `lib/check/contrast.ts`. Add an `ownDark` check and a filter for pure-fallback dark findings. Final function:

```ts
import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { contrastResults } from "@/lib/tokens/contrast";

/** Every measurable fg/bg color pair in globals.css must clear WCAG-AA (4.5, or 3.0 for muted/large).
 *  Pairs with unresolvable/alpha values are skipped upstream in contrastResults. A dark finding whose
 *  tokens have no OWN .dark declaration (pure light→dark fallback) is suppressed — both-theme already
 *  reports "add it to .dark"; once added, the real dark values get contrast-checked. */
export function checkContrast(globalsCss: string): Finding[] {
  const tokens = parseTokens(globalsCss);
  const ownDark = (n: string) => tokens.some((t) => t.name === n && t.theme === "dark");
  return contrastResults(tokens)
    .filter((r) => !r.pass)
    .filter((r) => !(r.theme === "dark" && !ownDark(r.bg) && !ownDark(r.fg)))
    .map((r) => ({
      file: "app/globals.css",
      line: 0,
      rule: "contrast",
      message: MSG.contrastBelow(r.fg, r.bg, r.theme, r.ratio, r.min),
    }));
}
```

- [ ] **Step 4: Run — expect PASS** — `npx vitest run tests/check/contrast.test.ts` (new + existing cases green; the existing baseline-`[]` and message-format cases are unaffected).

- [ ] **Step 5: Theme tests untouched** — `npx vitest run tests/themes/contrast.test.ts` → still green (proves `contrastResults` wasn't changed).

- [ ] **Step 6: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/check/contrast.ts tests/check/contrast.test.ts
git commit -m "fix(f5): suppress redundant pure-fallback .dark contrast finding (both-theme owns it)"
```

---

## Task 2: Part B — F1 extend-over-reuse nudge (docs)

**Files:** Modify `lib/tokens/generate.ts`, `AGENTS.md`; regenerate `design-system.{md,json}`.

The nudge sentence (use verbatim in both places):
> If no existing token fits the **meaning** (not just the syntax), extend — don't repurpose a semantically-wrong token (e.g. `warning` for a celebratory promo).

- [ ] **Step 1: generate.ts preamble.** Read `lib/tokens/generate.ts`; find the `## Extension procedure (add a value the system lacks)` section (around line 55, the "One procedure for everything…" paragraph). Add the nudge as a new sentence/line at the end of that intro paragraph (before the "**Color — extend freely**" block), matching the surrounding escaped-backtick template-string style. The `warning` token reference renders fine (it's a real token).

- [ ] **Step 2: Regenerate manifest** — `npm run tokens`. Confirm `design-system.md` now contains the nudge (`grep "fits the" design-system.md`). Required or `manifest-fresh` fails.

- [ ] **Step 3: AGENTS.md.** Read `AGENTS.md`; find the "**Need a value the system lacks?**" paragraph (~line 16). Append the same nudge sentence to the end of that paragraph.

- [ ] **Step 4: Verify gate** — `npm run check` → `✓ design-system check passed (4 ds-disable in use)` (manifest fresh, no regressions).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/generate.ts design-system.md design-system.json AGENTS.md
git commit -m "docs(f1): extension procedure nudges extend over semantically-wrong reuse"
```

---

## Task 3: Ledger + full verification + merge

**Files:** Modify `docs/M6-DOGFOOD.md`; then verify + merge.

- [ ] **Step 1: M6 ledger.** In `docs/M6-DOGFOOD.md`, mark F1 addressed (extend-over-reuse nudge in the extension procedure) and note the F5 deferred cosmetic (redundant `.dark` contrast finding) is fixed. Keep terse, consistent with the other ledger entries.

- [ ] **Step 2: Commit ledger**

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(polish): M6 ledger — F1 nudge + F5 cosmetic addressed"
```

- [ ] **Step 3: Full gate** — `npm run check && npm test && npm run lint`
Expected: check ✓ (4 ds-disable); all tests pass incl. the new contrast cases + theme tests; lint 0.

- [ ] **Step 4: Verify before claiming done** — @superpowers:verification-before-completion. Confirm the three commands green + tree clean.

- [ ] **Step 5: Merge to main** — @superpowers:finishing-a-development-branch. `--no-ff`, full suite green before merge, delete branch after.

```bash
git checkout main && git merge --no-ff polish-bundle && git branch -d polish-bundle
```

---

## Done =

A `:root`-only below-AA invented color produces a single `:root` `contrast` finding (plus `both-theme`'s "add to .dark"), not a contradictory `:root`+`.dark` pair; both-block below-AA pairs still flag in both themes; `contrastResults` + theme tests untouched; the extension procedure (generated preamble + AGENTS) nudges extending over semantically-wrong reuse; `npm run check` + full suite green; merged to main.
