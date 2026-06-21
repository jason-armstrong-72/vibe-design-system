# Contrast-warning workflow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the editor's colour control warn (both light + dark, gate-aligned) when a colour edit drops a pair below WCAG-AA, with a labeled per-block "Fix → L x.xx" that applies a directional, gamut-aware nearest-passing lightness — sharing threshold/pairing/measurability with the gate so they can't diverge.

**Architecture:** Push shared facts into `schema.ts` (`LARGE_OK`, `minRatio`, structural `partnerOf`) + export `measurable` from `contrast.ts`; refactor `contrastResults` to use them (output unchanged, guarded by existing suites). Add `nearestPassingL` to `lib/editor/oklch.ts`. Expose `committedValue` from the editor provider. Build the UI as a `useContrastReport` hook + both-block badge in `color-oklch.tsx`.

**Tech Stack:** TypeScript, React, Vitest + Testing Library, `culori`.

**Spec:** [docs/superpowers/specs/2026-06-21-contrast-warning-workflow-design.md](../specs/2026-06-21-contrast-warning-workflow-design.md)

**Branch:** `contrast-warning` (already created).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/tokens/schema.ts` | `LARGE_OK` + `minRatio(fg)` + structural `partnerOf(name, present)` | Modify |
| `lib/tokens/contrast.ts` | use `minRatio`/`partnerOf`; export `measurable` | Modify |
| `lib/editor/oklch.ts` | `nearestPassingL(value, partnerValue, min)` | Modify |
| `components/editor/editor-provider.tsx` | expose `committedValue(name, theme)` | Modify |
| `components/editor/controls/color-oklch.tsx` | `useContrastReport` + both-block badge + per-block Fix + a11y | Modify |
| `components/editor/editor-chrome.css` | warning/fix styles (reuse `--ed-warn`) | Modify |
| `tests/tokens/schema.test.ts`, `tests/editor/oklch.test.ts`, `tests/editor/editor-provider.test.tsx`, `tests/editor/color-oklch.test.tsx` | unit + behaviour | Extend |
| `docs/HANDOFF.md` | mark the contrast-warning fast-follow done | Modify |

---

## Task 1: Shared threshold + pairing in `schema.ts`

**Files:** Modify `lib/tokens/schema.ts`; extend `tests/tokens/schema.test.ts`.

- [ ] **Step 1: Write failing tests** — append to `tests/tokens/schema.test.ts`

```ts
import { minRatio, partnerOf } from "@/lib/tokens/schema";

describe("minRatio", () => {
  it("3.0 for muted-foreground, 4.5 otherwise", () => {
    expect(minRatio("--muted-foreground")).toBe(3.0);
    expect(minRatio("--primary-foreground")).toBe(4.5);
    expect(minRatio("--foreground")).toBe(4.5);
  });
});
describe("partnerOf (structural, both directions)", () => {
  const present = new Set(["--background","--foreground","--primary","--primary-foreground","--promo","--promo-foreground","--muted","--muted-foreground"]);
  it("base → its -foreground", () => expect(partnerOf("--primary", present)).toBe("--primary-foreground"));
  it("-foreground → its base", () => expect(partnerOf("--primary-foreground", present)).toBe("--primary"));
  it("background ↔ foreground special pair", () => {
    expect(partnerOf("--background", present)).toBe("--foreground");
    expect(partnerOf("--foreground", present)).toBe("--background");
  });
  it("invented token pairs structurally", () => expect(partnerOf("--promo", present)).toBe("--promo-foreground"));
  it("--foreground does NOT strip to '--'", () => expect(partnerOf("--foreground", present)).not.toBe("--"));
  it("null when partner absent", () => expect(partnerOf("--ring", present)).toBe(null));
});
```

- [ ] **Step 2: Run — expect FAIL** (`minRatio`/`partnerOf` undefined): `npx vitest run tests/tokens/schema.test.ts`

- [ ] **Step 3: Implement** — in `lib/tokens/schema.ts` add (and MOVE `LARGE_OK` here from contrast.ts):

```ts
/** Foreground roles allowed at the AA-large 3:1 threshold (secondary/large text). */
export const LARGE_OK = new Set(["--muted-foreground"]);

/** WCAG-AA minimum for a pair, keyed on the FOREGROUND token name. */
export function minRatio(fgName: string): number {
  return LARGE_OK.has(fgName) ? 3.0 : 4.5;
}

/** Structural, both-direction contrast partner (presence-checked), or null. Mirrors the gate's
 *  pairing: a base pairs with its `-foreground`; a `-foreground` pairs back with its base; the
 *  `--background`/`--foreground` body pair is explicit (so `--foreground` never strips to `--`). */
export function partnerOf(name: string, present: Set<string>): string | null {
  if (name === "--background") return present.has("--foreground") ? "--foreground" : null;
  if (name === "--foreground") return present.has("--background") ? "--background" : null;
  if (name.endsWith("-foreground")) {
    const base = name.slice(0, -"-foreground".length);
    return present.has(base) ? base : null;
  }
  const fg = `${name}-foreground`;
  return present.has(fg) ? fg : null;
}
```

- [ ] **Step 4: Run — expect PASS** (incl. existing schema tests): `npx vitest run tests/tokens/schema.test.ts`

- [ ] **Step 5: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/tokens/schema.ts tests/tokens/schema.test.ts
git commit -m "feat(editor): schema gains LARGE_OK + minRatio + structural partnerOf (shared)"
```

---

## Task 2: Refactor `contrast.ts` to the shared helpers (parity-safe)

**Files:** Modify `lib/tokens/contrast.ts`. No new tests — the existing suites are the parity guard.

- [ ] **Step 1: Refactor** `lib/tokens/contrast.ts`:
  - Remove the local `const LARGE_OK = …` (now imported from schema).
  - Import `{ isColorValue, minRatio, partnerOf }` from `./schema`.
  - `export function measurable(...)` (add `export` to the existing private fn).
  - Replace the pair-building + `min` with `partnerOf`/`minRatio`:

```ts
export function contrastResults(tokens: Token[]): PairResult[] {
  const out: PairResult[] = [];
  const names = [...new Set(tokens.map((t) => t.name))];
  const present = new Set(names);
  const pairs: Array<[string, string]> = [];
  for (const name of names) {
    if (name.endsWith("-foreground")) continue; // bases only — reverse handled by the base side
    const fg = partnerOf(name, present);
    if (fg) pairs.push([name, fg]);
  }
  for (const theme of ["light", "dark"] as Theme[]) {
    for (const [bg, fg] of pairs) {
      const bgv = effective(tokens, bg, theme);
      const fgv = effective(tokens, fg, theme);
      if (!measurable(bgv) || !measurable(fgv)) continue;
      const ratio = wcagContrast(fgv!, bgv!);
      out.push({ bg, fg, theme, ratio, min: minRatio(fg), pass: ratio >= minRatio(fg) });
    }
  }
  return out;
}
```

Note: `partnerOf("--background", present)` returns `--foreground`, replacing the old explicit seed — same output (the old unconditional seed was filtered by `measurable` when absent). Iterating bases-only avoids double-pairing.

- [ ] **Step 2: Parity guard — run all contrast consumers, expect ALL GREEN:**

Run: `npx vitest run tests/themes/contrast.test.ts tests/tokens/contrast-pairing.test.ts tests/check/contrast.test.ts`
Expected: PASS (theme-AA pairs unchanged + ≥16 floor; invented `--promo` still pairs; `:root`-only-once + both-block still hold). This proves the refactor is output-identical.

- [ ] **Step 3: Full check unaffected** — `npm run check` → `✓ … passed`.

- [ ] **Step 4: Commit**

```bash
git add lib/tokens/contrast.ts
git commit -m "refactor(editor): contrastResults uses shared minRatio/partnerOf; export measurable (parity-safe)"
```

---

## Task 3: `nearestPassingL` in `lib/editor/oklch.ts`

**Files:** Modify `lib/editor/oklch.ts`; extend `tests/editor/oklch.test.ts`.

- [ ] **Step 1: Write failing tests** — append to `tests/editor/oklch.test.ts`

```ts
import { nearestPassingL } from "@/lib/editor/oklch";
import { wcagContrast } from "culori";
import { oklchToHex, parseOklch } from "@/lib/editor/oklch";

const ratio = (oklchStr: string, partner: string) =>
  wcagContrast(oklchToHex(parseOklch(oklchStr)!), partner);

describe("nearestPassingL", () => {
  it("returns an L that passes AS RENDERED (gamut-mapped), keeping C/H", () => {
    const partner = "#ffffff"; // white
    const out = nearestPassingL("oklch(0.85 0.1 250)", partner, 4.5);
    expect(out).not.toBeNull();
    expect(ratio(out!, partner)).toBeGreaterThanOrEqual(4.5);
    const p = parseOklch(out!)!;
    expect(p.c).toBeCloseTo(0.1, 3); // chroma preserved
    expect(p.h).toBeCloseTo(250, 1); // hue preserved
  });
  it("handles a mid-luminance partner (U-shaped) without false-null", () => {
    const partner = oklchToHex(parseOklch("oklch(0.5 0 0)")!);
    const out = nearestPassingL("oklch(0.5 0 0)", partner, 4.5);
    expect(out).not.toBeNull();
    expect(ratio(out!, partner)).toBeGreaterThanOrEqual(4.5);
  });
  it("returns null when unreachable at this chroma", () => {
    // a partner + chroma where neither L extreme reaches the min
    const partner = oklchToHex(parseOklch("oklch(0.6 0.15 250)")!);
    const out = nearestPassingL("oklch(0.6 0.15 250)", partner, 7.5);
    // 7.5 is likely unreachable mid-hue; assert the contract: null OR a genuinely-passing L
    if (out !== null) expect(ratio(out, partner)).toBeGreaterThanOrEqual(7.5);
    else expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`nearestPassingL` undefined): `npx vitest run tests/editor/oklch.test.ts`

- [ ] **Step 3: Implement** — append to `lib/editor/oklch.ts`:

```ts
import { wcagContrast } from "culori";

/** Nearest lightness (keeping C/H) whose GAMUT-MAPPED colour clears `min` contrast vs `partnerValue`,
 *  or null if unreachable at this chroma. Contrast is U-shaped in L (valley where luminances match), so
 *  we ternary-search the valley, then binary-search each monotonic arm and pick the L closest to the
 *  current one. Measures the clamped value (oklchToHex) so the result passes as rendered. */
export function nearestPassingL(value: string, partnerValue: string, min: number): string | null {
  const cur = parseOklch(value);
  if (!cur) return null;
  const r = (l: number) => wcagContrast(oklchToHex({ l, c: cur.c, h: cur.h }), partnerValue);
  // valley = L minimizing contrast (unimodal in L at fixed C/H)
  let lo = 0, hi = 1;
  for (let i = 0; i < 50; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (r(m1) < r(m2)) hi = m2; else lo = m1;
  }
  const valley = (lo + hi) / 2;
  // arm UP [valley,1] increasing → smallest L≥valley meeting min
  let up: number | null = null;
  if (r(1) >= min) { let a = valley, b = 1; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (r(m) >= min) b = m; else a = m; } up = b; }
  // arm DOWN [0,valley] decreasing → largest L≤valley meeting min
  let down: number | null = null;
  if (r(0) >= min) { let a = 0, b = valley; for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (r(m) >= min) a = m; else b = m; } down = a; }
  const cands = [up, down].filter((x): x is number => x !== null);
  if (cands.length === 0) return null;
  const best = cands.reduce((p, c) => (Math.abs(c - cur.l) < Math.abs(p - cur.l) ? c : p));
  return formatOklch({ l: best, c: cur.c, h: cur.h });
}
```

(Imports: `oklch.ts` already imports from culori — add `wcagContrast` to that import rather than a second line.)

- [ ] **Step 4: Run — expect PASS**: `npx vitest run tests/editor/oklch.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/editor/oklch.ts tests/editor/oklch.test.ts
git commit -m "feat(editor): nearestPassingL — directional, gamut-aware L search for AA"
```

---

## Task 4: Expose `committedValue` from the provider

**Files:** Modify `components/editor/editor-provider.tsx`; extend `tests/editor/editor-provider.test.tsx`.

- [ ] **Step 1: Write failing test** — append to `tests/editor/editor-provider.test.tsx` (follow the file's existing render/act pattern; assert the new accessor returns a freshly-committed value, manifest fallback otherwise). Sketch:

```ts
it("committedValue returns the live per-block value (edited > manifest)", () => {
  // render provider, select a token, editValue(...) in light, then read committedValue(name,"light")
  // → the edited value; committedValue(otherToken,"dark") → manifest value.
});
```
(Use the existing test harness in this file for mounting the provider + invoking context methods.)

- [ ] **Step 2: Run — expect FAIL**: `npx vitest run tests/editor/editor-provider.test.tsx`

- [ ] **Step 3: Implement** — in `editor-provider.tsx`:
  - Add `committedValue: (name: string, theme: Theme) => string;` to `EditorContextValue`.
  - Implement it as the existing `committedBaseline` (already reads `committedRef` with `currentValue` manifest fallback) — expose that fn (it's already a `useCallback`). Add `committedValue: committedBaseline` to the context `value` object + its `useMemo` deps.

- [ ] **Step 4: Run — expect PASS** (+ existing provider tests green): `npx vitest run tests/editor/editor-provider.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/editor/editor-provider.tsx tests/editor/editor-provider.test.tsx
git commit -m "feat(editor): expose committedValue(name,theme) for live partner reads"
```

---

## Task 5: `useContrastReport` + both-block badge + per-block Fix + a11y

**Files:** Modify `components/editor/controls/color-oklch.tsx`, `components/editor/editor-chrome.css`; extend `tests/editor/color-oklch.test.tsx`.

- [ ] **Step 1: Write failing tests** — append to `tests/editor/color-oklch.test.tsx`. The file has two render helpers (`renderControl`, `renderRerenderable`) that don't pass `committedValue` — since it's optional (manifest-fallback default, Step 3) the existing 10+ cases keep working untouched. New cases pass a `committedValue` stub where they need live partner values. Cover:
  - a pair failing in **dark only** → a Dark warning AND a Light pass badge both render (both-block).
  - the Fix button label contains the target (`/Fix Dark → L 0\.\d+/`); clicking calls `onChange` with a value whose gamut-mapped ratio ≥ min for that block.
  - editing `--muted-foreground` (a `-foreground` token) renders a badge (reverse pairing) at min 3.0.
  - a `var(--foreground)` partner renders a state (not blank); a `color-mix(...)` partner renders no badge for that block.
  - unreachable case renders the "lower Chroma" message, not a dead button.

- [ ] **Step 2: Run — expect FAIL**: `npx vitest run tests/editor/color-oklch.test.tsx`

- [ ] **Step 3: Implement.**
  - Add an **optional** `committedValue?` prop to `ColorOklchProps` (signature `(name: string, theme: Theme) => string`), **defaulting to a manifest-snapshot lookup** (reuse the existing `blockValue` over `tokens`) so the existing test render helpers keep working without passing it. `ColorOklch` is rendered **only** in `components/editor/controls/control-host.tsx` (not editor-panel.tsx) — and `ControlHost` already calls `useEditor()` and passes `tokens`/`editingBlock` to the control, so thread `committedValue` from there the same way (prop approach, consistent with the existing pure-prop control + test harness).
  - Add a `useContrastReport(token, value, tokens, committedValue)` helper (in the same file or a small local hook) that:
    - builds `present = new Set(tokens.map(t => t.name))`;
    - `partner = partnerOf(token, present)`; if null → `{light:null,dark:null}`;
    - determines the foreground name of the pair (`token`/`partner` whichever is the fg) → `min = minRatio(fgName)`;
    - for each theme: resolve edited value (the live `value` for the active block; `committedValue(token, theme)` for the other) + `committedValue(partner, theme)`, each through a one-level `var()` resolve (`resolveVar(v, theme)` → if `/^var\(--/` look up the referenced token via `committedValue`); skip (null) if `!measurable`;
    - compute `wcagContrast(oklchToHex(parseOklch(fg)!), bgResolved)` (gamut-mapped) vs `min` → `{ratio,min,pass}`.
  - Render per block: pass → subtle `data-pass` badge; fail → `--ed-warn` warning + `Fix <Block> → L x.xx` button calling `onChange(nearestPassingL(value, partnerValueForBlock, min))` (only when the edited token's own value is literal oklch; if aliased, show "aliased — edit the source token" instead); unreachable (`nearestPassingL` null) → "can't reach AA at this chroma — lower Chroma or change Hue".
  - a11y: one `aria-live="polite"` region for the report; only change its text on a pass↔fail transition (track previous pass-state per block); add `aria-describedby` linking the L/C/H sliders to the report id. Use `@untitled-ui/icons-react` for any icon (it's a dep); plain text is fine.
  - Keep the existing `data-testid="contrast-badge"` (extend, don't remove — existing tests may key on it).

- [ ] **Step 4: Run — expect PASS** (+ existing color-oklch tests green): `npx vitest run tests/editor/color-oklch.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add components/editor/controls/color-oklch.tsx components/editor/editor-chrome.css components/editor/controls/control-host.tsx tests/editor/color-oklch.test.tsx
git commit -m "feat(editor): both-block contrast warning + labeled per-block Fix + aria-live"
```

---

## Task 6: Docs + full verification + merge

- [ ] **Step 1: HANDOFF.** In `docs/HANDOFF.md` M4 fast-follows, mark "contrast warning workflow beyond the read-only badge" done (both-block, gate-aligned, labeled per-block fix); note the badge-hides-on-var() nit is also closed. Commit.

- [ ] **Step 2: Full gate** — `npm run check && npm test && npm run lint`
Expected: check ✓; all tests pass incl. new schema/oklch/provider/color-oklch + the parity suites; lint 0.

- [ ] **Step 3: editor-chrome.css gate.** `editor-chrome.css` is excluded from the design-system check (run.ts EXCLUDE_FILES) — confirm any new styles there don't need tokenizing. (No action expected.)

- [ ] **Step 4: Verify before done** — @superpowers:verification-before-completion. Three gate commands green + tree clean.

- [ ] **Step 5: Merge** — @superpowers:finishing-a-development-branch. `--no-ff`, full suite green, delete branch.

```bash
git checkout main && git merge --no-ff contrast-warning && git branch -d contrast-warning
```

---

## Done =

The editor colour control reports WCAG-AA for **both** light and dark using the **same** threshold + structural pairing as the gate (extracted to `schema.ts`; `contrastResults` refactor parity-proven by the existing suites); resolves one-level `var()`; computes against **live** edited + partner values; on failure shows a per-block warning with a **labeled** `Fix <block> → L x.xx` applying a directional, gamut-aware nearest-passing L (or a "lower chroma" message when unreachable); is screen-reader-safe (`aria-live="polite"` on transition + `aria-describedby`); stays a dev-only island; full suite + `npm run check` green; merged to main.
