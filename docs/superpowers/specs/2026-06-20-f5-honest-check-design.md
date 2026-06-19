# F5 — Honest standalone `check` (contrast + theme-completeness) — design

**Date:** 2026-06-20
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** v1 fast-follow **F5** (from the M6 dogfood findings ledger — [docs/M6-DOGFOOD.md](../../M6-DOGFOOD.md), F5). Third near-term fast-follow, after F3 + F2 (both done).
**Depends on:** M5 (`npm run check` harness in `lib/check/`), M3a (`lib/tokens/contrast.ts` + the WCAG-AA theme gates), M1 (`lib/tokens/parse.ts`).

> **What M6 found (F5):** the `npm run check` **script alone** is not honest. It does **not** contrast-check
> `app/globals.css`, and its `both-theme` sub-check only covers `COLOR_ROLES` — so a consumer who invents a
> color (`--promo`/`--promo-foreground`) and runs **only** `npm run check` ships **below-AA** or
> **one-theme-only** color **green**. The full gate (`check && test`, what husky + CI run) *does* catch it —
> but only **indirectly**, via the `apply-theme` neutral-identity test failing with a confusing
> "token-set identity" message that never says "your color's contrast is too low." The honesty lives in the
> test suite, not in the tool that claims to enforce the contract.
>
> **F5 closes that** by moving the two missing guards into the `check` script itself, reusing the existing
> `lib/tokens/contrast.ts` as the single source of truth — so `check` is **honest for the consumer's
> edit-globals loop** (not "fully standalone" — see §6 residuals).

---

## 0. Framing correction (load-bearing — surfaced in review)

The M6 ledger (HANDOFF.md:39, M6-DOGFOOD.md) claims `lib/tokens/contrast.ts` "pairs ANY `--x`/`--x-foreground`."
**That is currently false.** `contrastResults` pairs via `foregroundFor()` (schema.ts:82-86), which is
**`COLOR_ROLES`-gated** — an invented `--promo`/`--promo-foreground` is **never paired**, by `check` *or* by
the test suite. So even the test suite does not contrast-check invented colors; it catches them only through
the neutral-identity drift failure.

**This spec is the change that makes that doc claim true.** The contrast leg is therefore a **fix** to
`foregroundFor`/`contrastResults` pairing, not free reuse. The docs must be corrected in the same PR (§5).

---

## 1. Scope (approved)

Close exactly **two leaks** in the `check` script, via a **single source of truth** (`lib/tokens/contrast.ts`,
consumed by both `check` and the theme tests):

1. **No contrast over `globals.css`.** Add a contrast sub-check that runs `contrastResults` over the parsed
   tokens of `app/globals.css` and fails on any below-AA pair.
2. **`both-theme` is `COLOR_ROLES`-only.** Broaden it to **all color-valued tokens** (ramps exempt), so a
   one-theme-only invented color is flagged even when it has no `-foreground` sibling to contrast-check.

**Explicitly OUT of scope (recorded, not forgotten):**
- **Parity + neutral-identity stay test-only.** They guard **multi-theme authoring** (`themes/*.css` against
  the Neutral reference set) — meaningless to a consumer who only edits `globals.css`. Porting them into
  `check` would couple the lint to the theme files and the gallery concern. Reviewers (scope lens) confirmed
  the consumer/author boundary is sound.
- **The check does NOT shell out to vitest.** `run.ts` is deliberately pure/in-process; shelling out couples
  the lint to the test runner and slows pre-commit. We port *logic* (shared `contrast.ts`), not *execution*.
- **The check does NOT pair colors itself.** Rejected — a second pairing rule that must stay in sync with the
  test path is the exact duplication F5 exists to remove. Pairing lives once, in `contrast.ts`.

---

## 2. The contrast leg

### 2.1 `lib/tokens/contrast.ts` — pairing role-gated → structural, + an unresolvable-skip

Two changes to the shared lib (both paths benefit):

**(a) Structural pairing.** Replace the `foregroundFor()`-gated pair selection (contrast.ts:33-34) with a
structural rule: for every token name `--x` present in the set, if `--x-foreground` is **also present**, pair
them. Keep the explicit `--background/--foreground` body pair (the one pair not following the `-foreground`
convention) and keep `LARGE_OK` (`--muted-foreground` evaluated at the AA-large **3.0** threshold; everything
else **4.5**). This makes the theme tests *stronger too* (a theme that invents a `--promo-foreground` now gets
contrast-checked) at zero cost on current data.

**(b) Skip unresolvable / meaningless pairs (SEV-1 from review — without this, F5 is worse than the hole).**
`wcagContrast` **throws** on `color-mix()`/`var()` values and returns a **bogus 21:1 PASS** on alpha values
(culori ignores the alpha channel). Pointed at `globals.css`, the new check meets exactly the values the
extension procedure *encourages* (e.g. `--promo-foreground: var(--foreground)`, or a `color-mix()` tint) →
**gate crash**; and an alpha foreground → **false green**. Empirically verified in review:
```
wcagContrast("color-mix(in oklab, var(--primary) 50%, white)", "#000") → THROWS
wcagContrast("var(--primary)", "#000")                                 → THROWS
wcagContrast("oklch(1 0 0 / 0.1)", "#000")                             → 21  (bogus; alpha ignored)
```
**Rule:** before computing a ratio, **skip** any pair where either side is not a **resolvable, opaque, literal
color** — i.e. fails `isColorValue` (catches `var()`/`color-mix()`) **or** carries alpha (the test's
`/\/\s*[\d.]/` translucency check; note it is OKLCH/RGB-slash specific, which matches this system's
OKLCH-only storage). **Skip silently** — do **not** flag (a `var()`-indirected foreground is legitimate and
common; flagging it would be noise, and it's consistent with the M4 editor hiding its contrast badge on
`var()` indirection). Skipped pairs are an acknowledged residual (§6), not a failure.

This skip lives in `contrastResults` (single source) so `check` and tests share it. Themes stay **22 pairs,
all AA-pass** (all opaque literal oklch; `--border`/`--input` alpha tokens have no `-foreground` partner so
never pair) — the `results.length >= 16` and no-alpha assertions in `tests/themes/contrast.test.ts` still
hold. Baseline guard confirmed in review: real `globals.css` passes the new check today.

### 2.2 `lib/check/contrast.ts` (new pure sub-check)

`checkContrast(globalsCss: string): Finding[]` — mirrors the `both-theme`/`manifest-fresh` shape (operates on
the globals string, not per-file). `parseTokens(globalsCss)` → `contrastResults(tokens)` → one `Finding`
(rule **`contrast`**) per `!pass` result. Wired in `run.ts` alongside the other globals-level checks (§4).

### 2.3 The message (must redirect the LLM — match the radius-message model)

`contrastResults` already carries `{ bg, fg, theme, ratio, min }`. The message must name **the token, the
block, the L-direction, and the target ratio** — the same specificity the off-token-scale radius message uses
to "redirect" an LLM (messages.ts; the channel HANDOFF credits for F2/F3). `MSG.contrastBelow`:

```ts
contrastBelow: (fg: string, bg: string, theme: "light" | "dark", ratio: number, min: number) =>
  `${fg} on ${bg} is ${ratio.toFixed(2)}:1 in ${theme === "dark" ? ".dark" : ":root"} — below the ` +
  `${min}:1 WCAG-AA minimum. In the ${theme === "dark" ? ".dark" : ":root"} block of app/globals.css, ` +
  `move ${fg}'s oklch lightness (L) away from ${bg}'s L (raise L for light text on a dark bg, lower it ` +
  `for dark text on a light bg) until the ratio is ≥ ${min}:1, then npm run tokens.`
```

`min` is `3` for `--muted-foreground` (LARGE_OK) and `4.5` otherwise — carried through from `contrastResults`,
so the message states the correct target automatically.

---

## 3. The theme-completeness leg (`both-theme` broadening)

`lib/check/both-theme.ts` currently iterates `COLOR_ROLES` only. Broaden to **every color-valued token**:

- **Color detection:** filter the union of light+dark token *names* by whether the token's **value** satisfies
  `isColorValue(value)` (schema.ts:14). **Do NOT** filter by `groupForName(...) === "color"` — that classifies
  `--brand-*`/`--chart-*` as color *by prefix regardless of value*, pulling ramps in only to re-exclude them
  (review, correctness lens). `isColorValue(value)` + explicit ramp-prefix exclusion is the clean path.
- **Ramp exemption (unchanged intent):** skip names matching `^--(brand|chart)-` — ramps are intentionally
  allowed in one block (HANDOFF "load-bearing decisions"). Non-color tokens are excluded by the `isColorValue`
  filter.
- **Rule + message unchanged:** still rule `both-theme`, still `MSG.bothThemeMissing(name, missingIn)`.

**False-positive check (review, correctness lens):** enumerated against the real `app/globals.css` +
`themes/neutral.css` — **every non-ramp color token is already present in both blocks** (`missing in .dark: []`,
`missing in :root: []`). The 11 `--brand-*` are `:root`-only and correctly exempt; `--chart-*` happen to be in
both but are exempt anyway. **Zero new findings on the baseline.** Update the file's docstring (currently says
"Every semantic color role (COLOR_ROLES)…") to describe the broadened behavior.

---

## 4. Wiring

`lib/check/run.ts` already reads `app/globals.css` once and runs the globals-level checks (`checkBothTheme`,
`checkManifestFresh`) after the per-file loop. Add `...checkContrast(globals)` there. No per-file work (contrast
is a globals concern). `both-theme` keeps its existing call site. The `ds-disable` suppression pass applies to
per-file findings only (unchanged); globals-level findings (`both-theme`, `contrast`, `manifest-fresh`) are not
line-suppressible, which is correct — they're whole-file token-graph facts.

---

## 5. Docs (honesty — the point of F5)

- **AGENTS.md recovery table** — add a `contrast` row, pointing at the L knob + block (mirror the message):
  `| color pair below WCAG-AA contrast | raise/lower the foreground token's oklch L in the failing block (:root or .dark) until ≥ 4.5:1 (3:1 for muted/large), then npm run tokens |`
- **`.cursor/rules/design-system.mdc`** — mirror the same new row (M5 keeps the two in sync).
- **Generated `design-system.md` preamble** — the file is **generated**; edit the generator template (the
  preamble source in `lib/tokens/generate.ts`), not the file, then `npm run tokens`. Add one line to the
  **Color — extend freely** block: *"the `<name>`/`<name>-foreground` pair must clear WCAG-AA (4.5:1, or 3:1
  for large/muted text) in **both** blocks, or `npm run check` fails."* So an LLM is warned **before** it trips
  the new gate, not after.
- **`both-theme.ts` docstring** — update to "all color-valued tokens (ramps exempt)".
- **Correct the false claim:** HANDOFF.md:39 (and the mirror in M6-DOGFOOD.md) say contrast "pairs ANY
  `--x`/`--x-foreground`" — currently false; becomes true with this PR. Reword the F5 bullet to "DONE" and
  state that `check` is now honest **for the consumer edit-globals loop**, with the §6 residuals named.
  Update HANDOFF.md:23 (M5 line describing `both-theme` as "COLOR_ROLES only").

---

## 6. Acknowledged residuals (documented, NOT silently implied-covered)

After F5, these can still ship green through `npm run check` **standalone** — by design, named in the docs so
the contract doesn't over-claim:

1. **A color token with no `-foreground` sibling that carries text** (e.g. `bg-promo` with `text-foreground`
   on top) — nothing to pair, so no contrast check. The exact M6 residual; structural limit of
   convention-based pairing.
2. **An orphan `--x-foreground` whose base `--x` is absent** — `effective()` returns `undefined` for the base,
   the pair is skipped (contrast.ts:40 `if (!bgv||!fgv) continue`). `both-theme` doesn't cover it either
   (it checks light/dark symmetry, not base/foreground completeness). Acceptable; document it.
3. **`var()`/`color-mix()`/alpha pairs** — skipped (§2.1), unverified-but-green. The price of not crashing /
   not false-passing. Consistent with the editor's badge behavior.
4. **Theme-completeness across `themes/*.css`** — a consumer who invents `--promo` and never adds it to the
   three theme files ships a globals-only token. Caught only by `npm test` (neutral-identity) — **author
   concern, by design** (§1 scope).

The reframe: `check` is **honest for the consumer's edit-globals loop**, not "fully standalone." Severity stays
**Low** precisely because the *real* gate (`check && test`, husky + CI) already catches everything — F5 buys
**contract cleanliness** (the tool enforces what it claims) for the "runs `check` but not `test`" path.

---

## 7. Testing (TDD)

New fixture-driven unit tests (mirror `tests/check/*` + `tests/themes/contrast.test.ts`):

**`lib/check/contrast.ts`:**
- **Flagged:** globals fixture with `--promo`/`--promo-foreground` at a **below-AA** ratio in `:root` (and one
  in `.dark` only) → `contrast` finding(s) naming the right token/block/ratio.
- **Not flagged:** a passing `--promo` pair; the real `globals.css` (baseline guard) → `[]`.
- **Skip (no crash, no false-pass):** a pair whose foreground is `var(--foreground)` → no throw, no finding;
  a `color-mix(...)` foreground → no throw, no finding; an **alpha** foreground (`oklch(... / 0.5)`) → no
  finding (not a bogus pass).
- **Message:** assert it contains the token names, the block (`:root`/`.dark`), and the target ratio.

**`lib/tokens/contrast.ts` (structural-pairing regression):**
- A token set with `--promo`/`--promo-foreground` (names outside `COLOR_ROLES`) now yields a pair result
  (proves structural, not role-gated).
- Themes still yield 22 pairs all-pass (no regression); alpha/`var()` tokens never produce a pair.

**`lib/check/both-theme.ts`:**
- **Flagged:** invented `--promo` in `:root` only (no `-foreground`) → `both-theme` finding.
- **Not flagged:** a `--brand-600` ramp in `:root` only (ramp exempt); a non-color token in one block.
- Real `globals.css` → `[]`.

**Integration / self-pass:** the existing dogfood test (`tests/check/self.test.ts`, asserts `run()` → `[]` on
the repo) must **stay green** after wiring — confirmed zero baseline findings in review, so no source fixes are
needed (unlike F3). `npm run check` on a fixture with a below-AA invented pair exits non-zero with a `contrast`
finding.

---

## 8. Done =

`npm run check` **standalone** rejects (a) a color pair below WCAG-AA in `app/globals.css` and (b) an invented
color present in only one theme block — with messages that name the token, block, and knob to turn; it never
crashes on `var()`/`color-mix()` values and never false-passes alpha; the theme tests still pass (single source
of truth, no regression); the repo passes its own gate unchanged; the docs are corrected so the contract no
longer over- or under-claims (and HANDOFF.md:39's previously-false "pairs ANY `--x`/`--x-foreground`" is now
true); and the M6 fast-follow ledger marks F5 done with the §6 residuals named.
