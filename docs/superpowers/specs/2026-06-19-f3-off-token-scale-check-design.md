# F3 — Off-token scale-step check — design

**Date:** 2026-06-19
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** v1 fast-follow **F3** (from the M6 dogfood findings ledger — [docs/M6-DOGFOOD.md](../../M6-DOGFOOD.md), F3). First of the two promoted near-term fast-follows (F3 then F2).
**Depends on:** M5 (the `npm run check` harness in `lib/check/`), M1/M2 (token parse + the `@theme` block in `app/globals.css`).

> **The bug M6 found (F3):** the design system **clears default Tailwind namespaces** in `@theme`
> (`--radius-*: initial`, `--shadow-*`, `--text-*`, `--font-weight-*`, …) and re-defines only a subset of
> steps. A named utility for a **cleared-but-not-redefined** scale step — e.g. `rounded-2xl`, `text-8xl`,
> `shadow-xl`, `font-black` — therefore **produces no CSS**. It is the "off-token classes NO-OP, they don't
> error" trap (HANDOFF), and `npm run check` does **not** catch it (it flags `[...]` arbitraries and
> default-palette colors, not named scale steps outside the defined set). In M6, a blind LLM put
> `rounded-3xl` on its cards → the cards rendered with **flat corners** while the whole gate stayed green.
>
> **F3 closes that hole:** a new `npm run check` sub-check flags named scale-step utilities whose step
> isn't actually defined in the system, in the 4 families where it's high-value and false-positive-safe.

---

## 1. Scope (approved)

**Guarded families = 4** (the cleared namespaces with clean, unambiguous scale vocab):

| Family | Class prefix | Theme namespace (in `@theme`) |
|---|---|---|
| radius | `rounded` (incl. side variants `rounded-{t,r,b,l,tl,tr,bl,br,s,e,ss,se,ee,es}-…`) | `--radius-*` |
| shadow | `shadow` | `--shadow-*` |
| text size | `text` | `--text-*` |
| font weight | `font` | `--font-weight-*` |

**Out of scope (recorded, not forgotten):**
- **color** (`--color-*` cleared) — already covered: `default-palette` flags `bg-gray-500`-style named palette classes, `arbitrary-color` flags `[#...]`, and the M0 cleared-namespace compile-gate makes off-token color classes no-op at build. F3 here would be redundant.
- **easing** (`--ease-*`) — niche, low usage; `ease-*` vocab is small and overlaps built-ins → low value, not worth the surface.
- **container** (`--container-*`) — powers `max-w-*`/`@container` and overlaps layout/breakpoints; no clean scale list → false-positive risk, low value.

These are deferred as *possible* later additions, not committed work. color needs nothing.

---

## 2. Detection rule (the core idea)

For each guarded family with prefix `P`, the check holds two sets:
- **`vocab(P)`** — the static set of Tailwind v4 **theme-var-based** scale steps for that family (the steps that the namespace-clear *can* turn off). Hardcoded in the check, with a comment that they are Tailwind v4 defaults.
- **`defined(P)`** — the steps **actually defined in the `@theme` block** of `app/globals.css` right now (parsed live).

**Flag** a class `P-{step}` (or `P-{side}-{step}`) **iff** `step ∈ vocab(P)` **and** `step ∉ defined(P)`.

Two consequences that make it safe and self-maintaining:
- **Non-scale utilities are never touched.** `text-center`, `text-accent`, `text-balance`, `font-mono`, `font-sans`, `shadow-brand-500`, `rounded-full`, `rounded-none` — none is in `vocab(P)`, so none is flagged. (`vocab` is *only* the scale steps, not every utility sharing the prefix.)
- **Source of truth = `@theme`, NOT the manifest.** (Why: M6 finding F4 — `@theme`-only additions don't reach `design-system.{md,json}`. Keying on `@theme` means F3 keys on **what actually compiles**, and if someone legitimately extends the scale in `@theme` — e.g. adds `--radius-2xl` — the check **stops flagging** `rounded-2xl` with no other change. Self-maintaining, no hardcoded "defined" list to drift.)

### The vocab sets (Tailwind v4 theme-var-based scale steps)

| Family | `vocab(P)` | `defined(P)` today (from `@theme`) | Flagged today |
|---|---|---|---|
| radius | `xs sm md lg xl 2xl 3xl 4xl` | `sm md lg xl` | `xs 2xl 3xl 4xl` |
| shadow | `2xs xs sm md lg xl 2xl` | `sm md lg` | `2xs xs xl 2xl` |
| text size | `xs sm base lg xl 2xl 3xl 4xl 5xl 6xl 7xl 8xl 9xl` | `xs … 7xl` | `8xl 9xl` |
| font weight | `thin extralight light normal medium semibold bold extrabold black` | `normal medium semibold bold` | `thin extralight light extrabold black` |

`defined(P)` is parsed from `@theme`, so the "flagged today" column is *derived*, never hardcoded — it shifts automatically if the scale is extended.

### Edge handling
- **Variant prefixes (CRITICAL — review gap).** Real classes carry `md:`, `hover:`, `dark:`, `group-hover:`, `sm:`, stacked (`md:hover:`), etc. `md:rounded-2xl` is one whitespace-delimited token and an `^`-anchored `rounded-{step}` match would **miss it** (false negative — the no-op still ships). **Rule:** before matching, strip the leading variant chain — split the class on `:` and take the **last segment** as the utility (`md:hover:rounded-2xl` → `rounded-2xl`). Match `P-{step}` on that final segment. (Arbitrary variants like `[&:hover]:` are rare in app code; splitting on the last `:` outside brackets is sufficient — the plan pins the exact tokenizer.)
- **Side variants (radius):** `rounded-t-2xl`, `rounded-tl-3xl`, etc. The side segment is **optional** and the **step is always the final segment**. Match shape (after variant-strip): `^rounded(?:-(?:t|r|b|l|tl|tr|bl|br|s|e|ss|se|ee|es))?-(<step>)$`; check `<step>` against radius vocab/defined. `rounded-t-lg` → `lg` defined → ok; `rounded-t-2xl` → flag.
- **Bare prefix:** `rounded` (alone) maps to the `--radius` knob (defined) → never flagged. `shadow`/`text`/`font` alone aren't scale steps → ignored.
- **Static survivors:** `rounded-full`, `rounded-none`, `shadow-none`, `shadow-inner` are NOT in `vocab` → never flagged. (`shadow-inner` *is* a theme var in v4, but the **safe-omission rule** keeps it out of vocab → never flagged, which is the correct outcome.)
- **Arbitrary values** (`rounded-[5px]`, `text-[10px]`) are NOT scale-step classes (they're `[...]` arbitraries, handled by `arbitrary-tailwind` separately) → not in scope for this rule.

---

## 3. Implementation shape

- **New pure sub-check:** `lib/check/off-token-scale.ts`, exporting `checkOffTokenScale(definedSteps, path, content): Finding[]` — mirrors the existing `lib/check/arbitrary-tailwind.ts` pattern (scans string-literals in a file for class tokens). Rule name: **`off-token-scale`**.
- **Defined-steps parsing:** a small helper reads the **`@theme` block** of `app/globals.css` once and returns `{ radius: Set, shadow: Set, text: Set, fontWeight: Set }`. Lives in `off-token-scale.ts` (or a tiny `theme-steps.ts` if cleaner). **Scope the parse to the `@theme` block** (slice from `@theme` to its closing brace) so `:root`/`.dark` declarations can't leak in. Regex per namespace, e.g. `/--(?:radius|shadow|font-weight|text)-([a-z0-9]+)\s*:/g` with the guard that the char ending the step is `:` (not `-`), to **exclude** the `--text-xs--line-height` sub-property form. (Confirmed: those sub-props sit on the same physical lines as `--text-xs:`.)
- **Wiring:** `lib/check/run.ts` already reads `app/globals.css` once (for `both-theme`/`manifest-fresh`) and runs a per-file loop via `walkSource`. Compute `definedSteps` once there, pass it into the per-file scan. **Note:** `checkOffTokenScale(definedSteps, path, content)` has a different arity than the existing `(path, content)` checks — `run.ts` currently spreads fixed-arity checks in one array; the loop must be adjusted (curry `definedSteps` in, or call it explicitly) — small edit, not drop-in. Same file scope (`app` + `components`, excludes `components/ui/**` + token sources) and the same `ds-disable` suppression pass apply automatically.
- **Message** (`lib/check/messages.ts`): e.g.
  `off-token-scale: "rounded-2xl" produces no styles — the radius scale is sm/md/lg/xl. Use a defined step, or extend the scale in @theme (see design-system.md).`
  The defined steps in the message are read from `defined(P)` so the guidance is always current.
- **Severity:** error (non-zero exit) — same as the other checks; this is the whole point. `/* ds-disable: <reason> */` overrides it like any finding.

**Vocab constant:** the 4 `vocab(P)` sets are a small hardcoded const (Tailwind v4's theme-var-based scale steps) with a comment. **Verify each against Tailwind v4's actual default theme keys during implementation** (read `node_modules/tailwindcss` theme or the v4 docs — per AGENTS.md, don't trust training data on this version). **Failure mode is asymmetric and must stay safe:** *omitting* a real Tailwind step only means that step isn't guarded (a missed no-op — acceptable); *including* a step that is actually static/always-valid (e.g. if `full`/`none` were wrongly added) would **false-positive**. So when unsure, leave a step OUT of `vocab`. They change only when Tailwind adds a scale step — rare.

---

## 4. Self-pass (the template passes its own new check)

The new check scans `app/` + `components/` (excl. `components/ui/**`). **The repo currently trips the new
rule in exactly 2 places** (verified — this is the complete blast radius; no `text-8xl/9xl`, `shadow-xl`,
`font-black`, `rounded-3xl/4xl`, or variant-prefixed offenders exist):
- `app/design-system/page.tsx:34` — `… rounded-2xl border p-6 shadow-sm sm:p-8`
- `components/design-system/token-section.tsx:60` — `… rounded-2xl border p-6 shadow-sm sm:p-8`

**These are a real pre-existing latent bug:** `rounded-2xl` has been a **silent no-op since M3** — those
cards have been rendering with **flat corners** all along (nobody noticed; exactly the bug class F3 exists to
surface). **Fix (decide in the plan, with a quick visual check):** change both to **`rounded-xl`** (the
defined max — simplest, no scale change, no new token; RECOMMENDED) **or** extend the scale by adding
`--radius-2xl` to `@theme` + `npm run tokens` (if genuinely rounder cards are wanted — a visual call). Either
way the cards' corners change from their current (flat) render, so **capture a before/after screenshot of
`/design-system` for the human checkpoint.** The existing **dogfood self-pass test**
(`tests/check/self.test.ts` asserts `run()` returns `[]` on the repo) will fail the instant `off-token-scale`
is wired in until these 2 are fixed — so fix them in the same task that wires the check.

---

## 5. Testing (TDD)

Fixture-driven unit tests for `checkOffTokenScale` (mirror `tests/check/*`):
- **Flagged:** `rounded-2xl`, `rounded-3xl`, `rounded-t-2xl`, `shadow-xl`, `shadow-2xs`, `text-8xl`, `text-9xl`, `font-black`, `font-thin`.
- **Not flagged (defined steps):** `rounded-xl`, `rounded-md`, `shadow-md`, `text-7xl`, `text-base`, `font-bold`, `font-medium`.
- **Not flagged (non-scale / static survivors):** `rounded-full`, `rounded-none`, `shadow-none`, `text-center`, `text-balance`, `text-accent`, `font-mono`, `font-sans`, `shadow-brand-500`, bare `rounded`.
- **Self-maintaining:** given a `definedSteps` with `radius` including `2xl`, `rounded-2xl` is **not** flagged (proves keying on `@theme`, not a hardcoded list).
- **Integration:** `npm run check` on a fixture file with `rounded-3xl` exits non-zero with an `off-token-scale` finding; `ds-disable` on the line suppresses it.
- **Defined-steps parser:** parsing the real `@theme` block yields the expected sets (radius `{sm,md,lg,xl}`, etc.).

---

## 6. Done =

`npm run check` flags a named scale-step utility (`rounded-2xl`, `text-8xl`, `shadow-xl`, `font-black`) that
isn't defined in `@theme`, with a clear message naming the valid steps; never flags non-scale utilities or
static survivors; stops flagging a step the moment it's added to `@theme`; the repo passes its own new check;
and the M6 F3 silent-no-op class of bug is now **loud**. Updates the M6 fast-follow ledger (F3 → done) and
AGENTS.md's failure→fix recovery table with the new rule.
