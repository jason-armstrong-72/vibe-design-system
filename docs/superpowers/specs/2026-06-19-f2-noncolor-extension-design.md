# F2 — One-step non-colour extension — design

**Date:** 2026-06-19
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** v1 fast-follow **F2** (from the M6 dogfood findings ledger — [docs/M6-DOGFOOD.md](../../M6-DOGFOOD.md), F2). Second of the two promoted near-term fast-follows (F3 done; F2 here).
**Depends on:** M1 (`lib/tokens/parse`), M2 (`lib/tokens/{sync,generate}`, `npm run tokens`), F3 (`lib/check/off-token-scale.ts` `parseThemeSteps`, reused here).

> **The problem M6 found (F2):** non-colour extension is unreliable. Same "softer corners" task, 3 blind
> LLMs, 3 outcomes — one edited contract machinery (`lib/tokens/utilities.ts`) → would fail CI; one added a
> step that worked but was **undocumented in the manifest**; one used built-in classes that **silently
> no-op**. None found the single-knob path.
>
> **Root cause:** every scale step has a **value token** in `:root` (`--fs-8xl`, `--elevation-xl`,
> `--fw-black`) and a **`@theme` mapping** that makes the utility compile (`--text-8xl`, `--shadow-xl`,
> `--font-weight-black`). `sync.ts` (`syncThemeColorMappings`) auto-writes the mapping **for colour only**
> (`--color-<name>: var(--<name>)`) — which is exactly what makes colour extension one-step. For scale
> families the mapping is **hand-written**, so adding a scale value to `:root` and running `npm run tokens`
> leaves the utility un-wired (silent no-op) → the LLM improvises (edits machinery / uses a no-op class).
>
> **F2 removes the asymmetry:** `sync.ts` auto-wires scale `@theme` mappings the same way it does colour, so
> the **one procedure** — *add the value to `:root`, run `npm run tokens`* — works for colour AND scales.
> Radius (a single knob, no per-step value token) gets a clear knob-nudge + a documented rare-new-step
> recipe, and the manifest is fixed to report the true radius scale (F4).

---

## 1. Approach (approved)

**Make non-colour extension genuinely one-step** by generalising `sync.ts` from "colour only" to "colour +
scale value-tokens", so the same `add-to-:root → npm run tokens` procedure auto-wires the `@theme` mapping
for every family. Radius stays knob-driven (it has no per-step value token); the manifest is fixed to read
the real `@theme` radius steps; docs present one unified procedure.

Rejected alternatives: *document-the-multi-step-recipe only* (leaves the asymmetry that tripped all 3 M6
agents) and *lock the scales / no extension* (contradicts the "extend, don't hardcode" philosophy).

---

## 2. The model (how a scale step works today)

| Family | `:root` value token | `@theme` mapping (makes the utility compile) | Utility |
|---|---|---|---|
| font size | `--fs-<step>` (+ paired `--lh-<step>`) | `--text-<step>: var(--fs-<step>)` (+ `--text-<step>--line-height: var(--lh-<step>)`) | `text-<step>` |
| font weight | `--fw-<step>` | `--font-weight-<step>: var(--fw-<step>)` | `font-<step>` |
| shadow | `--elevation-<step>` | `--shadow-<step>: var(--elevation-<step>)` | `shadow-<step>` |
| **colour** (today, for reference) | `--<name>` | `--color-<name>: var(--<name>)` ← **auto-wired by sync** | `bg-/text-/border-<name>` |
| **radius** (the oddball) | *(none — single `--radius` knob)* | `--radius-<step>: calc(var(--radius) ± Npx)` *(derived, hand-authored)* | `rounded-<step>` |

`generate.ts` builds the manifest by iterating parsed `:root`/`.dark` tokens and calling
`utilitiesForToken` per token. So once a scale **value token** exists in `:root`, the manifest already lists
its utility correctly (`--elevation-xl` → `shadow-xl`, `--fs-8xl` → `text-8xl`). The only thing missing is
the `@theme` mapping (so the utility compiles) — which is what F2 auto-wires.

---

## 3. Part 1 — auto-wire scale `@theme` mappings (`lib/tokens/sync.ts`)

Generalise the sync pass so `npm run tokens` ensures, for each **value token** in `:root`, that its `@theme`
mapping exists (additive + idempotent, exactly like the colour pass):

| `:root` value token (group) | ensure in `@theme inline` |
|---|---|
| `--fs-<x>` (fontSize) | `--text-<x>: var(--fs-<x>)` — **and** `--text-<x>--line-height: var(--lh-<x>)` *iff `--lh-<x>` exists* |
| `--fw-<x>` (fontWeight) | `--font-weight-<x>: var(--fw-<x>)` |
| `--elevation-<x>` (shadow) | `--shadow-<x>: var(--elevation-<x>)` |

- **Line-height is lenient (approved):** wire `--text-<x>` always; add the `--text-<x>--line-height` mapping
  **only if** the paired `--lh-<x>` value token exists. A missing line-height falls back to Tailwind's
  default — never blocks. Docs nudge "add both `--fs-X` and `--lh-X` for a proper pair."
- **Grouping:** keyed by token **group** (from `parseTokens` / `groupForName`), not by raw name prefix, so
  classification stays consistent with the rest of the system. (`--fs-*` → fontSize, `--fw-*` → fontWeight,
  `--elevation-*` → shadow.)
- **Idempotent + additive:** only appends a mapping that isn't already present; existing mappings untouched.
  Re-running `npm run tokens` is a no-op once wired (same contract as the colour pass — preserves the
  manifest-fresh invariant).
- **`:root`-only:** scale value tokens are not themed (light only); the pass keys on the `light` tokens, like
  the colour pass does. (Scales legitimately live in `:root` only — `both-theme` exempts non-`COLOR_ROLES`.)

**Structure — fold INTO `syncThemeColorMappings` (decided; review-driven).** `syncThemeColorMappings` has
**4 callers, one of them gate-critical** — `lib/tokens/regenerate.ts` (`npm run tokens`),
**`lib/check/manifest-fresh.ts` (the `npm run check` freshness enforcer — treats `sync.changed===true` as a
hard failure)**, `scripts/watch-tokens.ts` (dev watch), and the colour-sync tests. A *sibling* function wired
only into `regenerate.ts` would make the gate's freshness view diverge from what `npm run tokens` writes
(a scale mapping could be missing yet the gate pass, or vice-versa). So **generalise the existing
`syncThemeColorMappings` in place** — keep its name, signature, and `SyncResult` — to wire colour **and**
scale mappings in one pass over a small table `{ group → (bare ⇒ themeProp(s)) }`. All 4 callers get the new
behaviour for free; the colour behaviour and its tests stay **unchanged**.

**Idempotency detail (review-driven):** the existence check must be **exact-prop membership** (the colour
pass already does this: `existing.has(themeVar)`), NOT a `startsWith(prefix)`. The `@theme` block also
contains the namespace-clear decls `--text-*: initial`, `--shadow-*: initial`, `--font-weight-*: initial` —
an exact check (`existing.has("--shadow-xl")`) correctly ignores those; a prefix check would not.

**`@theme` block locator:** for **writing** mappings, reuse sync's existing postcss `walkAtRules("theme")`
+ `/(^|\s)inline(\s|$)/` params test (handles the multi-decl-per-line formatting — postcss splits each
`--text-xs: …; --text-xs--line-height: …;` into discrete decls, verified). For the radius **read** (Part 3)
reuse F3's string-based `parseThemeSteps`. Two locators coexist (one writes via postcss, one reads via
string slice); the plan notes which is used where so a future edit to the `@theme` comment/preamble can't
silently break one.

**Result:** the one-step procedure for a new scale step becomes:
```css
/* add to :root */  --elevation-xl: 0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1);
```
then `npm run tokens` → `--shadow-xl` auto-wired, `shadow-xl` compiles, manifest lists it, F3 sees it defined.
Identical shape to colour.

---

## 4. Part 2 — radius: knob nudge + rare-new-step recipe (docs only, no sync change)

Radius has **no per-step value token** — it's the single `--radius` knob with `sm/md/lg/xl` derived in
`@theme` via `calc()`. So there's nothing for sync to key on, and radius is **not** auto-wired. Two paths,
both documented:
- **Change overall roundness → edit `--radius`** (the knob; all derived steps shift). This is the common
  case and the **nudge** (M6: 0/3 LLMs found it).
- **Genuinely need a new step (e.g. `rounded-2xl`) →** add `--radius-2xl: calc(var(--radius) + 8px)` to the
  `@theme inline` block directly, then `npm run tokens` (regenerates the manifest, which now reports it —
  Part 3). A deliberate scale change, documented as the exception.

---

## 5. Part 3 — manifest reports the true radius scale (`lib/tokens/utilities.ts` + `generate.ts`) — fixes F4 for radius

Today `utilitiesForToken` hardcodes radius utilities: `["rounded-sm","rounded-md","rounded-lg","rounded-xl"]`
— so a hand-added `--radius-2xl` never appears in the manifest (M6 F4). Fix: the radius row's utility list is
**derived from the actual `@theme` radius steps** by reusing F3's `parseThemeSteps(globals).radius`.

- `regenerate.ts`/`generate.ts` have the globals CSS available; pass `parseThemeSteps(globals).radius` into
  `buildManifest`/`utilitiesForToken` so the radius token lists `rounded-<step>` for **every** defined
  `@theme` radius step.
- **Order it explicitly (review-driven):** `parseThemeSteps` returns a `Set` in **source order** (regex
  match order over the block), not canonical scale order — for the current file that's `sm,md,lg,xl`, but a
  hand-added `--radius-2xl` could land out of place. Sort the steps against F3's `VOCAB.radius` ordering
  (`xs,sm,md,lg,xl,2xl,3xl,4xl` in `lib/check/off-token-scale.ts`) before emitting `rounded-<step>`, so the
  manifest is stable regardless of CSS authoring order.
- The other scale families need **no** manifest change: once a value token exists in `:root` (Part 1),
  `utilitiesForToken` already derives the correct utility (`--elevation-xl` → `shadow-xl`). Verify in tests.
- Keep `utilitiesForToken` pure: pass radius steps in as an argument rather than reading the filesystem
  inside it. **This changes its signature** → `tests/tokens/utilities.test.ts` (currently asserts
  `utilitiesForToken(tok("--radius","radius"))` contains `rounded-lg`) must be updated to pass the steps
  argument. Flag for the plan.

---

## 6. Part 4 — docs: one unified extension procedure

Rewrite the **generated preamble** in `generate.ts` (`PREAMBLE`, which becomes `design-system.md`'s
"Extension procedure" section) to present a **single** procedure, not "colour = easy, non-colour = fixed/rare":

- **Add a value the system lacks (colour OR a scale step):** add the **value token** to `:root` (`--<name>`
  for a colour, with `.dark` + `-foreground` as needed; `--fs-<x>`+`--lh-<x>` / `--elevation-<x>` /
  `--fw-<x>` for a scale step), then `npm run tokens`. It **auto-wires the utility and refreshes this
  manifest.** Never hardcode; never use an off-scale class (it produces no styles and the gate rejects it).
- **Radius / spacing density are knobs:** to change roundness edit `--radius`; to change spacing density edit
  `--spacing-base`. (Add a new `--radius-<step>` to `@theme` only for a deliberate new step.)
- Keep the colour worked example; add a scale worked example (e.g. a new shadow level).

Also update:
- **`AGENTS.md`** — the design-system contract block + failure→fix table (the extension procedure pointer
  now covers scales; the off-token-scale row from F3 already points here).
- **`docs/NAMING-CONVENTION.md`** — replace "non-colour scales are fixed/rare" with the value-token naming
  convention for adding a scale step (`--fs-<x>`/`--lh-<x>`, `--elevation-<x>`, `--fw-<x>`), and the radius
  knob rule. This is the doc the old preamble punted to.
- **`design-system.md`** is regenerated (`npm run tokens`); never hand-edited.

---

## 7. Testing (TDD)

- **`sync` (the core):** fixture CSS with a new `--elevation-xl` (no `--shadow-xl` yet) → after sync, `@theme`
  contains `--shadow-xl: var(--elevation-xl)`. Same for `--fs-8xl`+`--lh-8xl` → `--text-8xl` +
  `--text-8xl--line-height`; `--fs-8xl` **without** `--lh-8xl` → `--text-8xl` only (lenient). `--fw-black` →
  `--font-weight-black`. **Idempotent:** running sync twice adds nothing the second time. **Colour
  unchanged:** the existing colour-sync tests stay green; a colour + a scale token in one fixture both wire.
- **`generate`/manifest:** a globals with `--radius-2xl` in `@theme` → the radius manifest token lists
  `rounded-2xl` (in scale order). A globals with `--elevation-xl` → a shadow token with `shadow-xl`. Order
  deterministic.
- **End-to-end (the headline):** start from the real repo; add `--elevation-xl` to `:root`; run the actual
  `npm run tokens`; assert (a) `@theme` now has `--shadow-xl: var(--elevation-xl)`, (b) `design-system.json`
  lists `shadow-xl`, (c) `npm run check` passes (off-token-scale sees `shadow-xl` defined, manifest fresh).
  Revert. (A scripted integration test or a documented manual check in the plan.)
- **Manifest-fresh invariant (verified in review — holds):** every current `--fs-*`/`--fw-*`/`--elevation-*`
  already has its `@theme` mapping, so the generalised sync pass finds them all present → `npm run tokens`
  and `npm run check` (via `lib/check/manifest-fresh.ts`, which calls the same sync) stay a **no-op** on the
  unchanged repo. Test this explicitly: `sync(globals).changed === false` and `sync(globals).added === []`
  on the real `app/globals.css`. The pass must not rewrite existing `@theme` on any run.
- **All-callers parity:** assert the gate agrees with `npm run tokens` — after adding a scale value token,
  `lib/check/manifest-fresh.ts`'s sync sees the same `changed===true` that `regenerate.ts` acts on (same
  function, so this is structural, but include a test that the gate flags an un-wired scale token as stale).

---

## 8. Out of scope / non-goals

- **Spacing steps** — `--spacing-base` is a single multiplier; the whole numeric scale derives. There are no
  per-step tokens to add. Off-scale spacing is already handled by `off-scale-spacing` + the adopter-editable
  `lib/check/spacing-steps.ts`. F2 only adds a docs note (edit `--spacing-base` for density).
- **Auto-creating the value token** — F2 wires the `@theme` mapping from an existing `:root` value token; it
  does not invent values. The user/LLM still chooses the `--elevation-xl` shadow value etc. (as with colour).
- **Removing/renaming tokens** — additive only, same as the colour pass.

---

## 9. Done =

`npm run tokens` auto-wires the `@theme` mapping for a newly-added scale **value token** (shadow/text/
font-weight) — so adding a non-colour value is the **same one step as colour** (`add to :root` → `npm run
tokens`), the utility compiles, the manifest lists it, and F3's check sees it defined. Radius is documented
as knob-first with a rare-new-step recipe, and the manifest reports the true radius scale (F4 fixed). The
generated extension procedure + `AGENTS.md` + `NAMING-CONVENTION.md` present one unified procedure. The
colour path and the manifest-fresh invariant are unchanged (all existing tests green). Updates the M6 ledger
(F2 → done).
