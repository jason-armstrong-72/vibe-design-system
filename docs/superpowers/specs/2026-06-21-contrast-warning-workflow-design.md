# Contrast-warning workflow (editor) — design

**Date:** 2026-06-21
**Status:** Design approved (brainstorm, 3-agent reviewed), pre-plan
**Milestone:** M4 editor fast-follow — "contrast warning workflow beyond the read-only badge" (HANDOFF M4 list).
**Depends on:** M4 (the dev-only editor, `components/editor/*`, `lib/editor/*`), the gate's contrast logic (`lib/tokens/contrast.ts`, `lib/tokens/schema.ts`).

> **What it does:** the editor's colour control has a read-only contrast badge (active block only, flat 4.5,
> blank on `var()`). This makes it an actionable, **gate-aligned, both-block** workflow: it warns when a colour
> edit drops a pair below WCAG-AA **in either theme**, and offers a **labeled per-block "Fix"** that sets the
> edited token's lightness to a computed nearest-passing value. The threshold + pairing logic is **shared with
> the gate** so the editor and `npm run check` can't disagree.

3-agent review reshaped this design; the changes from the first draft are called out inline as **[R: …]**.

---

## 0. Architecture — shared logic, no second contrast truth [R: DRY]

The first draft proposed a new `lib/editor/contrast.ts` re-deriving the threshold, pairing, and resolution. That
creates implementations that drift from the gate. Instead, push the shared facts into the neutral modules the
gate already uses, and make the editor a thin consumer:

- **`lib/tokens/schema.ts`** (the role-fact hub, beside `COLOR_ROLES`/`foregroundFor`) gains:
  - `LARGE_OK` (moved here from `contrast.ts`) + `minRatio(fgName): number` → `3.0` for `--muted-foreground`,
    else `4.5`. **One threshold, two callers** (gate + editor).
  - `partnerOf(name, present: Set<string>): string | null` — the **structural, both-direction** pairing:
    a `-foreground` token pairs with its base; a base pairs with its present `-foreground`; the
    `--background`↔`--foreground` special pair is handled explicitly (so `--foreground` doesn't naively strip to
    `--` **[R: C3]**). Structural (presence-checked) — matches the gate's invented-token pairing (F5), not the
    role-gated `foregroundFor`.
- **`lib/tokens/contrast.ts`** is refactored to **build its pairs via `partnerOf`** and read its threshold via
  `minRatio` (replacing the inlined logic at the current lines 37-42, 49). Behaviour is unchanged — guarded by
  the existing theme-AA + F5 tests. It also **exports `measurable`** (already a pure predicate) for editor reuse.
- **`lib/editor/oklch.ts`** (the existing OKLCH-math home) gains `nearestPassingL(...)` (below), beside
  `parseOklch`/`oklchToHex`/`Lch`. Takes the target ratio as a param — no embedded threshold.
- **No new `lib/editor/contrast.ts`.** The glue (resolve both values, compute per block, render states) lives in
  the colour control via a small testable hook `useContrastReport` (see §4) **[R: cut the module]**.

**Client-safety / imports:** `lib/editor → lib/tokens` is the existing arrow (`color-oklch.tsx` already imports
`schema` + `generate`). `contrast.ts`/`schema.ts` import only `culori`+types (client-safe; culori already runs in
the control). No circular risk: `schema.ts` imports nothing from editor/gate.

---

## 1. Both-block, gate-aligned check [R: P0 — the real hole]

The gate fails a pair if **either** light or dark fails (`contrast.ts:43` loops both themes). The first draft
checked only the active editing block — letting a user fix Light, see green, and ship a Dark failure the gate
rejects. **The report covers BOTH blocks**, regardless of the active block:

For the selected colour token, for **each** theme ∈ {light, dark}:
1. resolve the edited token's value for that theme (the **live** value — §3),
2. find its partner via `partnerOf`; resolve the **partner's live** value for that theme (§3),
3. if either value is **not `measurable`** (after one-level `var()` resolution — §3), skip that theme (no
   report — same "can't measure" stance as the gate, `contrast.ts:28-30`),
4. else compute `wcagContrast`, compare to `minRatio(fgName)` (the fg side of the pair).

Result per theme: `{ theme, ratio, min, pass }` or `null` (skipped). The badge renders both (§4).

---

## 2. `nearestPassingL` — correct directional, gamut-aware search [R: C1, C2]

Lives in `lib/editor/oklch.ts`. Signature: `nearestPassingL(value: string, partnerValue: string, min: number): string | null`.

- **Not a plain binary search.** WCAG contrast is **U-shaped in L** when the partner sits at mid-luminance
  (verified: rises toward both L=0 and L=1) — a naive binary search lands in the valley and returns a false
  "unreachable" **[R: C1]**. Algorithm: compute the partner's relative luminance; pick the **direction** that
  increases contrast (partner dark → raise L toward 1; partner light → lower L toward 0). Within that single
  direction contrast **is** monotonic, so binary-search L between the current L and the chosen endpoint for the
  first L meeting `min`. If the current L is already on the wrong side of the valley, start the search from the
  endpoint, not the current L.
- **Gamut-aware [R: C2].** `wcagContrast` measures the raw (possibly out-of-sRGB) oklch, but the swatch +
  persisted value are **gamut-mapped** (`oklchToHex` calls `clampChroma`). Measuring the raw value can return a
  "passing" L whose clamped colour actually fails. So the search must measure the **gamut-mapped** value at each
  candidate L (clamp via the same path `oklchToHex` uses, then contrast), so the returned L passes *as rendered*.
- Keeps C and H fixed; returns the new `oklch(...)` string, or **`null`** if no L in the chosen direction
  reaches `min` at this chroma.

---

## 3. Live values + `var()` resolution [R: C4, C5]

- **Live partner value [R: C4].** The control today reads partners from the static manifest snapshot, so a
  partner edited earlier this session is stale — and an actionable fix computed against a stale partner is a
  *wrong* fix. The provider already holds live per-block committed values in `committedRef`
  (`Map<"name|theme", value>`) but doesn't expose them. **Add `committedValue(name, theme): string` to the
  editor context** (returns the committed value, falling back to the manifest) and read partner values through
  it. The edited token's own live value is the control's current `value` prop.
- **`var()` resolution (one level) [R: C5].** Close the M4 nit ("badge hides for `var()`-indirected colours"):
  if a resolved value is `var(--x)`, look up `--x`'s live value for that theme (via `committedValue`) **one
  level**. If still unmeasurable (`color-mix`/alpha/`var()` chain), skip per §1.3. **Documented divergence:** the
  gate's `measurable` *skips* all `var()`; the editor resolves one level for display — so the editor can show a
  state for an aliased pair the gate doesn't check. Acceptable (the editor is a live helper, not the enforcer);
  noted so "agree with the gate" isn't over-claimed. The **fix** is only offered when the *edited* token's own
  value is a literal oklch (you can't nudge the L of an alias) — otherwise show the warning but no Fix button,
  with "aliased — edit the source token".

---

## 4. UI — `useContrastReport` hook + badge states [R: P1, P2, P4]

A small hook `useContrastReport(token, value, tokens, committedValue)` returns `{ light, dark }` (each a
per-theme result or null) + the fix suggestions. The control renders:

- **pass (a block)** → the existing subtle badge style (`data-pass`), per block: `Light 5.2 · PASS`.
- **fail (a block)** → prominent warning (reuse `--ed-warn` + the `data-pass="false"` pattern; no new token —
  there isn't a dedicated danger token) showing `Dark 3.9 : 1 — below 4.5`, **plus a labeled per-block Fix**
  button **[R: P1]**: `Fix Dark → L 0.45` (states the target; not a silent jump). Clicking calls the existing
  `onChange` with `nearestPassingL(...)` for **that** block's partner value — applied like any edit (live
  preview + persist + undoable via ⌘Z). Because fixing one block can change the other, each failing block gets
  its **own** labeled button; the user sees both readouts and both targets.
- **unreachable (`null`) [R: P4]** → no dead button; show `Dark: can't reach AA at this chroma — lower Chroma
  or change Hue` (redirects to the visible knob, matching the system's ethos).
- **no partner / unmeasurable** → no badge for that block (unchanged).

**a11y [R: P2]:** the sliders fire on every drag, so `role="alert"` would spam screen readers. Use a single
`aria-live="polite"` region that updates **only on a pass↔fail transition** (not on every ratio tick), and
associate the readout with the L/C/H inputs via `aria-describedby`. Icons (if any) from `@untitled-ui/icons-react`
(the editor's set), not inline SVG.

---

## 5. Testing

**Pure units (highest value):**
- `schema.ts`: `minRatio("--muted-foreground")===3.0`, else 4.5; `partnerOf` both directions
  (`--primary`↔`--primary-foreground`, `--background`↔`--foreground`, invented `--promo`↔`--promo-foreground`),
  `--foreground` does **not** strip to `--`, returns null when no partner present.
- `oklch.ts` `nearestPassingL`: converges to ≥min and keeps C/H; **mid-luminance partner** (U-shaped) case —
  returns a passing L, not a false null (regression for C1); **high-chroma** case where the raw value would
  "pass" but the clamped one fails → returned L passes *gamut-mapped* (C2); returns null when truly unreachable.
- `contrast.ts` refactor: `contrastResults` output is **unchanged** vs before (run the existing theme-AA + F5
  + contrast-pairing suites — all green; that's the parity guard for the schema-extraction refactor).

**Hook/behaviour:**
- `useContrastReport` (or the control): a pair failing in **dark only** shows a Dark warning + a Light pass
  (proves both-block); the Fix button label contains the target L; clicking calls `onChange` with a value whose
  gamut-mapped ratio ≥ min for that block.
- `var()`-indirected partner now produces a state (not blank); a `color-mix`/alpha partner is skipped.
- editing `--muted-foreground` (a `-foreground` token) shows a badge (reverse pairing) at the 3.0 threshold.

**No gate/contract change:** `npm run check` logic is reused, not modified; `tests/check/*` stay green.

---

## 6. Out of scope

The other M4 nits (save-state reset on block-switch, debounce key `token|theme`); multi-hop `var()` chains
(one level only); contrast for non-color tokens; lowering chroma automatically in the fix (we *measure*
gamut-mapped but the fix only moves L — chroma is the user's knob, surfaced in the unreachable message).

---

## 7. Done =

The colour control reports WCAG-AA contrast for **both** light and dark (gate-aligned threshold + structural
pairing, shared via `schema.ts`/`contrast.ts` so it can't drift from `npm run check`); resolves one-level
`var()` so aliased colours aren't blank; computes against **live** edited + partner values; on failure shows a
prominent per-block warning with a **labeled** `Fix <block> → L x.xx` that applies a directional, gamut-aware
nearest-passing L (or an actionable "lower chroma" message when unreachable); is screen-reader-safe
(`aria-live="polite"` on transition, `aria-describedby`); stays a dev-only island; and the `contrast.ts`
refactor leaves `contrastResults` output identical (existing suites green).
