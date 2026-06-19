# F2 — One-step non-colour extension — design

**Date:** 2026-06-19
**Status:** Design approved (brainstorm + 3-reviewer challenge), pre-plan
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

**Framing decision (3-reviewer pass): "easy-but-discouraged" for scales.** Type/shadow/weight scales are
**curated on purpose** — a constrained ramp is the product value. So F2 keeps the one-step *machinery* (it
removes the trap that forced machinery-edits and silent no-ops) but **frames scale extension as a last
resort** in docs and gate messages: *reach for an existing step first; the ramp is deliberately small;
extend only when it genuinely can't express what you need.* Colour stays "extend freely." This avoids
teaching LLMs that adding `text-8xl`/`font-black` is the normal move.

**The radius gate-message fix (the load-bearing change — see §5b).** The 3-reviewer pass converged on this:
M6's failing scenario was *radius* ("rounder corners"), and radius is **not** auto-wired (it's a single
knob). F2's only defense for radius is docs — which M6 proved LLMs skim. The fix: put the `--radius` knob
nudge **into the `off-token-scale` gate error message** (the red gate is the one channel M6 proved reliably
redirects an LLM — the seeded run recovered purely from gate output). So `rounded-3xl` → the failure message
itself routes the LLM to the knob.

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
  default — never blocks. Docs nudge "add both `--fs-X` and `--lh-X` for a proper pair." **Visible signal
  (review-driven):** when the pass wires a `--text-<x>` whose `--lh-<x>` is absent, `npm run tokens` prints a
  **warning** ("wired text-8xl with default line-height; add --lh-8xl for a proper pair") — leniency stays,
  but the silent-quality-regression gets a signal.
- **Grouping — CLOSED ALLOWLIST (review-critical).** Key by token **group** (from `parseTokens`), but match
  against an **explicit `Set` of exactly the 3 wired groups** `{fontSize, fontWeight, shadow}`. **Every other
  group is silently ignored** (no mapping appended), exactly as the colour pass ignores all non-colour today.
  This is load-bearing: `--lh-*` is its own first-class `lineHeight` group (11 tokens: `--lh-xs…7xl`), and
  `--fs-*` line-heights are wired only as a *side-effect* of the fontSize entry (the `--text-X--line-height`
  pair), never as their own mapping. **The loop must NOT fall through to an exhaustiveness `throw`** for
  unwired groups (unlike `utilitiesForToken`, which throws) — a throw on `lineHeight` would crash
  `npm run tokens` **and** `npm run check` on the unchanged repo. Ignore-by-default, wire only the 3.
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
function in place** — keep its signature and `SyncResult` — to wire colour **and** scale mappings in one
pass over a small table `{ group → (bare ⇒ themeProp(s)) }`. All 4 callers get the new behaviour for free;
the colour behaviour and its tests stay **unchanged**.

**Rename + family-aware message (review-driven hygiene).** Rename `syncThemeColorMappings` → `syncThemeMappings`
(mechanical, update all 4 callers + the colour-sync tests) — the old name becomes a lie once it wires 4
namespaces. And `lib/check/manifest-fresh.ts` hardcodes the failure message "missing @theme **color**
mapping" — make it **family-aware** (`missing @theme mapping for "<token>" — run npm run tokens`) so a
missing `--shadow-xl` doesn't report as a colour problem.

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
  `@theme inline` block **directly** (NOT `:root`), then `npm run tokens` (regenerates the manifest, which
  now reports it — Part 3). A deliberate scale change, documented as the exception.

**New-trap warning (review-driven):** an LLM that just learned the scale procedure ("add the value to
`:root` → `npm run tokens`") may try `--radius-2xl` in **`:root`** — which `groupForName` does not recognise
(only bare `--radius` maps to radius), so `parseTokens` would **throw** and crash `npm run tokens`. F2 must
not introduce this. Mitigations (all three): (a) the gate message (§5b) and docs say radius steps go in
`@theme`, not `:root`; (b) the docs *loudly* lead with "radius is NOT like the other scales — it's a knob";
(c) **harden `groupForName`** so an unknown `--radius-*` / `--shadow-*` / `--text-*` / `--font-weight-*`
name does not throw — classify by prefix into its family (so a misplaced token is handled gracefully, and
the gate/manifest stay alive to guide the fix) rather than crashing the toolchain. The plan pins the exact
`groupForName` change + a regression test.

---

## 5. Part 3 — manifest reports the true radius scale (`lib/tokens/utilities.ts` + `generate.ts`) — fixes F4 for radius

Today `utilitiesForToken` hardcodes radius utilities: `["rounded-sm","rounded-md","rounded-lg","rounded-xl"]`
— so a hand-added `--radius-2xl` never appears in the manifest (M6 F4). Fix: the radius row's utility list is
**derived from the actual `@theme` radius steps** by reusing F3's `parseThemeSteps(globals).radius`.

- **Read from the POST-sync string (review-critical):** in `regenerate.ts` use `parseThemeSteps(sync.css)`
  (the post-sync globals that `parseTokens` also consumes), NOT the original `readFileSync` — and likewise in
  `lib/check/manifest-fresh.ts` derive the radius steps from the post-sync string its sync produces, so the
  manifest the gate computes matches what `npm run tokens` writes. Pass `.radius` into
  `buildManifest`/`utilitiesForToken` so the radius token lists `rounded-<step>` for **every** defined
  `@theme` radius step.
- **Order it explicitly (review-driven):** `parseThemeSteps` returns a `Set` in **source order** (regex
  match order over the block), not canonical scale order — for the current file that's `sm,md,lg,xl`, but a
  hand-added `--radius-2xl` could land out of place. Sort the steps against F3's `VOCAB.radius` ordering
  (`xs,sm,md,lg,xl,2xl,3xl,4xl` in `lib/check/off-token-scale.ts`) before emitting `rounded-<step>`, so the
  manifest is stable regardless of CSS authoring order.
- The other scale families need **no** manifest change: once a value token exists in `:root` (Part 1),
  `utilitiesForToken` already derives the correct utility (`--elevation-xl` → `shadow-xl`). Verify in tests.
- Keep `utilitiesForToken` pure: pass radius steps in as an argument. **Make the arg OPTIONAL with the
  current default (`["rounded-sm","rounded-md","rounded-lg","rounded-xl"]`) (review-driven)** — so the 4
  `buildManifest` callers + `mergeByName` + `generate.test.ts` that don't pass it keep working, and only the
  `regenerate.ts`/`manifest-fresh.ts` paths thread the live steps in. `tests/tokens/utilities.test.ts`
  (asserts `rounded-lg`) stays green with the default; add a test for the passed-steps case.

### 5b. Part 3b — radius knob nudge in the gate message (`lib/check/off-token-scale.ts` + `messages.ts`) — the load-bearing ergonomic fix

M6's failing scenario was radius, and the red gate is the only channel that reliably redirects an LLM. So
make `MSG.offTokenScale` **family-aware**: for `family === "radius"`, the message names the knob, not just
"use a defined step." Concretely:
> `off-token scale step "rounded-3xl" produces no styles — the radius scale is sm/md/lg/xl. To make corners rounder/softer overall, increase --radius in app/globals.css then npm run tokens (it shifts every step); for a one-off, add --radius-<step> to @theme. (see design-system.md)`

For the other families, keep the existing message but ensure it routes to the **one-step** procedure
("add the value token to `:root`, then `npm run tokens`") consistent with the new docs. `checkOffTokenScale`
already knows the `family` per finding — thread it into the message. (F2 touches F3's check here; F3's tests
update for the new message text.)

---

## 6. Part 4 — docs: one unified extension procedure

Rewrite the **generated preamble** in `generate.ts` (`PREAMBLE`, which becomes `design-system.md`'s
"Extension procedure" section). It currently says *"Non-color scales like type/shadow are fixed; adding to
those is rare"* — an LLM reading that concludes it **can't** add a shadow and improvises (the M6 #1/#3
behaviours). Replace with a **single procedure** but with **"easy-but-discouraged" framing for scales** (the
3-reviewer decision) — NOT a uniform "extend freely" story:

- **Colour — extend freely** (the common, legitimate case): add `--<name>` to `:root`+`.dark` (+
  `--<name>-foreground` if text sits on it), `npm run tokens`. Auto-wires `bg-/text-/border-<name>`.
- **Scales (type / shadow / weight) — the ramp is deliberately small; reach for an existing step FIRST.**
  Only when the ramp genuinely can't express what you need: add the **value token** to `:root`, then
  `npm run tokens` (same one step — auto-wires the utility + refreshes this manifest). **Use the value-token
  name from the table, which differs from the utility name:** shadow `--elevation-<step>` → `shadow-<step>`;
  font size `--fs-<step>` **and** its `--lh-<step>` pair → `text-<step>`; font weight `--fw-<step>` →
  `font-<step>`. (Get the value-token name wrong and sync silently won't wire it.)
- **Roundness & spacing are KNOBS, not per-step tokens — radius is NOT like the other scales.** To make
  corners rounder/softer, **increase `--radius`** (e.g. `0.625rem` → `1rem`) then `npm run tokens` — it
  shifts every derived step. **Do NOT reach for `rounded-2xl`/`rounded-3xl`** (cleared namespace → no CSS →
  the gate rejects it). For spacing density, edit `--spacing-base`. Only add a `--radius-<step>` to `@theme`
  (not `:root`) for a genuine one-off extra step.
- **Never hardcode; never use an off-scale class** — it renders unstyled and the gate rejects it.
- Keep the colour worked example; add a scale worked example (a new shadow level).

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
  `--font-weight-black`. **Idempotent:** running sync twice adds nothing the second time — including no
  duplicate `--text-8xl--line-height` (exact-prop check on the line-height prop). **Closed allowlist:** a
  fixture with `--lh-9xl` (lineHeight) and other non-wired groups present → sync wires **nothing** for them
  and does **not throw**. **Colour unchanged:** the existing colour-sync tests stay green; a colour + a scale
  token in one fixture both wire.
- **`groupForName` regression (review-driven insurance):** assert it classifies every current
  `--elevation-*` / `--fs-*` / `--fw-*` as shadow/fontSize/fontWeight (guards the prefix-before-value-inference
  ordering — a reorder must not flip a shadow token to colour). And assert an unknown suffixed name
  (`--radius-2xl`, `--shadow-9xl`) **does not throw** (the hardening from §4) — classifies by prefix.
- **`generate`/manifest:** a globals with `--radius-2xl` in `@theme` → the radius manifest token lists
  `rounded-2xl` (in scale order). A globals with `--elevation-xl` → a shadow token with `shadow-xl`. Order
  deterministic.
- **Gate message (off-token-scale, F3):** a `rounded-3xl` finding's message contains `--radius` (the knob
  nudge); a `shadow-2xl` finding routes to the `:root` one-step procedure. Update F3's existing message
  assertions for the new text.
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
- **No semantic/a11y guardrail for scales (acknowledged, review-driven).** Colour extension is backstopped
  by the `npm test` suite (theme parity/identity + WCAG-AA contrast, per M6 F5). Scales have **no analogue** —
  a chosen `--elevation-xl` value or a `--fw-thin: 100` ships green with no quality check. F2's parity claim
  with colour is "equally **unvalidated**, not equally safe." The docs therefore don't oversell scale
  extension as risk-free; a lightweight scale guardrail (min font-size, paired `--fs`/`--lh` enforcement) is a
  possible later fast-follow, **out of F2 scope.** The line-height **warning** (§3) is the one cheap signal F2
  does add.
- **Theme files are values-only.** `npm run theme` swaps `:root`/`.dark` value blocks and leaves `@theme`
  untouched (and doesn't run sync). The extension procedure applies to **`app/globals.css`**; a docs note
  says so (editing a `themes/*.css` directly won't wire a new mapping until `npm run tokens` runs on globals).

---

## 9. Done =

`npm run tokens` auto-wires the `@theme` mapping for a newly-added scale **value token** (shadow/text/
font-weight) — so adding a non-colour value is the **same one step as colour** (`add to :root` → `npm run
tokens`), the utility compiles, the manifest lists it, and F3's check sees it defined. Radius is documented
as knob-first with a rare-new-step recipe, and the manifest reports the true radius scale (F4 fixed). The
generated extension procedure + `AGENTS.md` + `NAMING-CONVENTION.md` present one unified procedure. The
colour path and the manifest-fresh invariant are unchanged (all existing tests green). Updates the M6 ledger
(F2 → done).
