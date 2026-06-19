# M6 — Dogfood Gate — run record

**Protocol:** [docs/superpowers/specs/2026-06-18-m6-dogfood-gate-design.md](superpowers/specs/2026-06-18-m6-dogfood-gate-design.md)
**Plan:** [docs/superpowers/plans/2026-06-19-m6-dogfood-gate.md](superpowers/plans/2026-06-19-m6-dogfood-gate.md)
**Branch:** `m6-dogfood`
**Verdict:** ✅ **QUALIFIED PASS** (user-ratified 2026-06-19). Keep-decision: **`/pricing` only** (run A2) kept as a worked example; `/settings` + the `--radius-2xl` step **dropped** (layout quality not reference-worthy). `/pricing` uses **no new tokens** — the kept surface adds nothing to the token set.

---

## 1. Frozen briefs (verbatim)

### Brief A — /pricing
> Build a pricing page at `/pricing` for my SaaS. Three plans: **Starter** (free), **Pro** ($29/mo), **Team** ($99/mo). Each plan is a card with the name, the price, a one-line description, a list of 5 features (each with a check mark), and a "Get started" button. **Pro is our most popular plan — make it the hero of the page: it should feel premium and celebratory and clearly stand out from the other two so people's eyes land on it first.** Make it look polished and work on mobile (cards stack).

### Brief B — /settings
> Build an account settings page at `/settings`. It has a form: **Name** (text), **Email** (text, show a validation error if it's not a valid email), **Notification frequency** (a select), and a **Save changes** button that is **disabled until the user edits something**. Rows should highlight on hover and show a clear focus ring when tabbed through. Add a **"Danger zone"** section at the bottom with a **Delete account** button. Show a friendly **empty state** if there's nothing configured yet. **I want the whole form to feel softer and more rounded than the default — gentler corners on the cards and inputs.**

---

## 2. Gap-proof (§6)

### Brief A — promo color → **GAP REAL** (borderline reuse noted)
Enumerated all `:root` color tokens (`grep -E '^\s*--[a-z0-9-]+:\s*oklch' app/globals.css`). Per-candidate vs the brief's "premium / celebratory / stand out":

| Candidate | Value | Verdict for a celebratory promo |
|---|---|---|
| `background`/`card`/`popover`/`secondary`/`muted`/`accent` | chroma **0** (pure neutral) | No — zero-chroma grays, cannot "pop" |
| `primary` | `oklch(0.205 0 0)` near-black | No — neutral, not a color pop |
| `destructive` | red, hue 27 | No — semantic danger (used for Delete) |
| `warning` | amber/gold, hue 80 | No — **semantic warning**; a good LLM won't repurpose caution for a premium tier |
| `success` | green, hue 145 | No — semantic "positive/go," not celebratory |
| `info` | blue, hue 250 | No — semantic informational |
| `brand-50…950` | **blue ramp, hue 250** | **Borderline** — the product's own emphasis color; idiomatic to accent with brand, BUT cool blue reads corporate/trustworthy, not "celebratory" |
| `chart-1…5` | data-viz (orange/teal/blue/violet/amber) | No — semantically data-viz, shouldn't be repurposed for UI emphasis |

**Conclusion:** the set has **no un-claimed warm/celebratory accent**. Every vibrant hue is either semantic, data-viz, or the cool-blue brand ramp. `brand-500` is the one defensible *reuse* (corporate-blue emphasis), so a run that uses brand for the Pro card is a legitimate "used the right existing token" outcome — but the *celebratory* intent points at a color the system lacks. **Decision (frozen brief, hint-free — not tightened, would leak the mechanism):** proceed; observe per-run whether each extends (adds a promo color) or stretches brand. §5 #1 color leg requires extension in **≥1** of the 2 pricing runs; if **both** reuse brand, record as a finding ("Brief A gap softer than intended; color extension not exercised") rather than papering over it.

### Brief B — radius knob → **GAP REAL**
`grep -n -- '--radius:' app/globals.css` → `80: --radius: 0.625rem` (10px). This is the moderate shadcn default — **not** already soft/very-rounded. "Softer / more rounded than the default — gentler corners" genuinely requires *increasing* the knob (e.g. → ~0.875–1rem). So the forcing function fires: the LLM must discover and edit the single `--radius` knob in `globals.css` (then `npm run tokens`) vs. hardcoding `rounded-[Npx]` (which the gate rejects).

---

## 3. Runs

### Run A1 — /pricing → **PASS** (no extension; reuse path)
**What it did:** created `app/pricing/page.tsx` only (one file). Consulted the auto-loaded contract (used token utilities throughout, ran `npm run check` itself). Pro hero = `bg-brand-600` + `ring-2 ring-brand-400` + `shadow-lg` + desktop lift/scale; "Most popular" badge = **`bg-warning`** (amber) + Sparkles icon.
**Verified by orchestrator (not self-report):** `git status` = only `app/pricing/` added; **`globals.css` untouched → NO extension**. `npm run check` ✓ / `npm test` 312 ✓ / `npm run lint` ✓ / `npm run build` ✓ (/pricing prerendered static). No `#hex`/`oklch`/arbitrary classes in the page.
**FAIL events (§4):** none (no contract-machinery edit, no observer message, no hardcode-and-dodge, didn't give up) → **mechanical PASS**.
**Assertions witnessed:** #1 color extension — **NO** (reused `brand` for hero, `warning` for badge). #2 red-gate recovery — **NO** (never tripped the gate). #3 invented-token hole — N/A (nothing invented).
**Observation / candidate finding:** the brief's *celebratory* promo was satisfied by **misusing `warning`** (a caution color) rather than extending. The gate passes it because `warning` is a real token used syntactically — i.e. the contract enforces *token usage*, not *semantic fit*. Confirms the gap is real (no promo color exists) but shows the LLM defaulted to grabbing a semantically-wrong token over running the (easy) extension procedure. Watch whether A2 repeats; if both pricing runs reuse, color-extension (§5 #1) is not witnessed → recorded finding per §6.

### Run A2 — /pricing → **PASS** (no extension; reuse path)
**What it did:** created `app/pricing/page.tsx` only. Consulted the auto-loaded contract (token-only, ran `npm run check`). Pro hero = `brand-500` border + `brand-50→card` gradient (dark-aware `dark:from-brand-950`) + `ring-4 ring-brand-500/15` + `shadow-lg` + `lg:scale-105 z-sticky`; check badges = **`bg-success`**. Explicitly stated it used the brand ramp "without inventing tokens."
**Verified by orchestrator:** only `app/pricing/` added; **`globals.css` untouched → NO extension**. `npm run check` ✓ / `npm run lint` ✓ / `npm run build` ✓ (/pricing static). No `#hex`/`oklch`/arbitrary classes.
**FAIL events (§4):** none → **mechanical PASS**.
**Assertions witnessed:** #1 color extension — **NO**. #2 red-gate recovery — **NO** (never tripped). #3 — N/A.
**Pattern (N=2, consistent):** both pricing runs **reused `brand` for the featured tier + stretched a semantic token** (A1 `warning`, A2 `success`) for accents, and neither extended. Per the §6 pre-commitment this is the "gap softer than intended" outcome: **`brand` is a legitimate existing fit for "premium / stand out,"** so capable LLMs correctly built entirely within the 94-token set — a *success* of the set's sufficiency, not a contract failure. Consequence: **color extension is NOT exercised by Brief A**; it must come from elsewhere (radius non-color extension in B; red-gate recovery may need a seeded run per §5 #2). Flagged for the Task-7 audit + user decision.

### Run B1 — /settings → **FAIL** (edited contract machinery) — productive finding
**What it did:** created `app/settings/page.tsx` (form, hover/focus rows, email validation via `aria-invalid`+`text-destructive`, disabled-until-dirty Save, empty state, Danger zone with `variant="destructive"`). Built a `NativeSelect` (no Select component shipped). **For "softer corners" it ADDED a new derived radius step** `--radius-2xl: calc(var(--radius) + 8px)` to `@theme inline` **and edited `lib/tokens/utilities.ts`** to register `rounded-2xl`, then regenerated the manifest. Everything reported green.
**Verified by orchestrator (`git status` / `git diff --stat`):** modified `app/globals.css`, `lib/tokens/utilities.ts`, `design-system.{md,json}` + created `app/settings/`.
**FAIL event (§4):** **YES — edited `lib/tokens/**`** (`lib/tokens/utilities.ts`). Per the pre-registered table this fails the run.
**Why it's a *productive* fail (the predicted finding, confirmed — §2.2/§5 #1/§9):**
- The brief's "softer / more rounded" had a **supported zero-machinery path**: bump the single `--radius` knob (`0.625rem` → larger), which softens all derived steps. The LLM **did not take it** — it added a *new* `rounded-2xl` step instead.
- Adding a *new non-color token* (a radius step) has **no documented one-step path** (the procedure is color-only). To make `rounded-2xl` real *and* keep the manifest-freshness gate happy, the LLM **had to edit the generator** (`lib/tokens/utilities.ts`). So the gate effectively *forces* a machinery edit for non-color extension — exactly the gap §2.2/§9 predicted.
**Class:** extension-procedure / non-color. **Against:** M2/M5 (extension procedure color-only; no supported non-color-token path; no nudge toward the single-knob path). **Decision:** discard B1's changes, run B2 fresh to test variance vs. robust pattern before deciding any product fix (the fix touches the ≤2 contract-machinery bound → user call at Task-7 audit).

### Run B3 — /settings → **PASS (gate)** but **brief-intent SILENTLY NOT met** — major gate-coverage finding
**What it did:** created `app/settings/page.tsx` + a new `components/ui/select.tsx` (radix-based Select). For "softer corners" it **avoided extension entirely** — explicitly reasoned that inventing a radius token would break `npm run tokens` (`groupForName` throws on unknown non-color names), so it used **built-in Tailwind `rounded-2xl` / `rounded-3xl` / `rounded-full`** on cards/rows.
**Verified by orchestrator — the trap fired:** the design system **clears the radius namespace** (`app/globals.css:165` `--radius-*: initial`) and defines **only sm/md/lg/xl** (lines 236–239). Built CSS confirms **`.rounded-2xl` and `.rounded-3xl` emit NOTHING** (only `.rounded-full{border-radius:3.40282e38px}` survives as a static value). B3 put **`rounded-3xl` on the cards** (the main "softer" element, 3×) → **those corners are silently flat.** `npm run check` ✓ / `npm test` 312 ✓ / `npm run lint` ✓ / `npm run build` ✓ — **all green while the headline requirement is silently broken.**
**FAIL events (§4):** none (no machinery edit; new ui component is allowed) → **mechanical PASS**, BUT **brief-intent-not-met** (cards not actually rounded).
**Finding (major):** named off-token utility classes that map to a **cleared namespace** (`rounded-2xl/3xl`, and by extension any cleared-namespace class) **produce no CSS and are NOT flagged by the gate** — the exact "off-token classes NO-OP, don't error" trap (HANDOFF), now shown to defeat a real feature. The `arbitrary-tailwind` check catches `rounded-[12px]` but not the named `rounded-2xl`. **Gate-coverage hole** (against M5): the gate validates token *usage* syntax, not whether a utility *resolves to a real value*.

### Run S1 — SEEDED red-gate recovery (§5 #2) → **PASS** — witnesses #1 (color) + #2
**Setup:** orchestrator pre-planted a hardcoded `bg-[#7c3aed]` (vivid purple, genuinely not in the set) in `app/promo-banner.tsx` so `npm run check` started **RED** (2 findings: hardcoded-color + arbitrary-color, message pointing to "add a token… then npm run tokens"). Fresh agent task = "finish this promo banner, render it on the home page, make the project's checks pass." **No hints** about tokens/extension/the gate's internals.
**What it did (recovered correctly, zero hints):** read the red `npm run check`, and instead of re-hardcoding or grabbing a semantic token, **ran the color extension procedure** — added `--promo` / `--promo-foreground` / `--promo-accent` to **both** `:root` and `.dark` in `app/globals.css`, ran `npm run tokens` (auto-wired `--color-promo*`, refreshed manifest). Then, discovering `npm test` would fail, **also added the promo tokens to all 3 theme files** (neutral/swiss/brutalist, both blocks) to satisfy theme-identity (`apply-theme.test.ts`), parity (`parity.test.ts`), and **AA contrast** (`contrast.test.ts`). Banner styled entirely with `bg-promo`/`text-promo-foreground`/etc.
**Verified by orchestrator:** check ✓ / lint ✓ / test 312 ✓ / build ✓. `promo` present in both globals blocks **and documented in the manifest** (3 hits — color extension self-documents, unlike B2's radius step).
**Assertions witnessed:** **#2 red-gate self-recovery — YES** (read the red gate, fixed from its output alone, no hints — the genuinely-new M5 machinery, validated). **#1 color extension — YES** (proper procedure, both blocks, `npm run tokens`, manifest updated). 
**Pivotal observation re #3:** the agent extended to all themes + passed contrast **because `npm test` forced it** (theme identity/parity/contrast over `themes/*.css`), NOT because `npm run check` did. This means the **full gate (`check && test`) may catch invented-color theme-incompleteness via the test suite** — narrower than the "gate hole" flagged earlier. **#3 re-probed directly below.**

### Run B2 — /settings → **PASS** (non-color extension, clean) — with a subtle finding
**What it did:** created `app/settings/page.tsx` (form, hover/`focus-within` ring rows, blur-gated email validation, disabled-until-dirty Save, empty state, Danger zone, native styled select). **For "softer corners" it added `--radius-2xl: calc(var(--radius) + 8px)` to `@theme` only** — and *deliberately did NOT* edit `lib/tokens/utilities.ts`, reasoning that `parse.ts` reads only `:root`/`.dark` so a `@theme` derived step won't make the manifest stale.
**Verified by orchestrator:** only `app/globals.css` (1 line) + `app/settings/` changed; **machinery (`lib/`, `design-system.*`) untouched**. `npm run check` ✓ / `npm test` 312 ✓ / `npm run lint` ✓ / `npm run build` ✓ (/settings static). `rounded-2xl` used 7× and **emitted in built CSS** (genuinely works). No hardcoded/arbitrary classes.
**FAIL events (§4):** **none** (`app/globals.css` is the token *source*, the legitimate extension surface — not in the §4 machinery list) → **mechanical PASS**.
**Assertions witnessed:** #1 **non-color extension — YES** (added a working `rounded-2xl` step unaided, no machinery edit). #1 color leg — still NO. #2 red-gate recovery — NO. #3 — n/a (non-color token, not subject to both-theme/contrast).
**Subtle finding:** B2's clean path leaves the manifest **silently incomplete** — `rounded-2xl` works but appears **nowhere in `design-system.{md,json}`** (0 hits), so a future LLM reading the manifest wouldn't know it exists. Combined with B1: the **same task** yielded a FAIL (B1 documented the step → edited the generator) and a PASS (B2 left it undocumented → clean). The "correct" gate-passing path requires reasoning about parser internals and produces an under-documented system. **Robust non-color-extension finding (N=2): the path is undocumented, inconsistent, and the clean variant de-documents the new token.**

---

## 4. Brownfield observation (§2.3)
Seeded `app/legacy/page.tsx` + `components/legacy-card.tsx` (~12 lines) with realistic pre-existing mess, ran `npm run check` cold → **9 problems, exit 1.**
- **Caught (9):** `bg-[#3b82f6]` (hardcoded+arbitrary), `p-[13px]`/`p-[7px]` (arbitrary-length), `bg-gray-500`+`border-gray-300` (default-palette), `bg-[#ef4444]` (hardcoded+arbitrary), and **inline `style={{ background: "#222" }}`** (hardcoded-color — the text scan catches inline **hex**).
- **Slipped through (uncaught):** `text-gray-500` (text-palette — `arbitrary-tailwind` palette prefixes omit `text-`); inline `style={{ color: "red" }}` (keyword color — `hardcoded-color` matches hex/rgb/hsl, not named keywords); `rounded-[5px]` (arbitrary **radius** — `arbitrary-length` covers spacing prefixes, not `rounded-[]`).
- **Refinement of the spec's B2 claim:** inline-style **hex** colors ARE caught; only **keyword** colors slip. (Spec §2.3 said "inline style not caught" — precise truth: keyword-only.)
**Adoption experience:** 9 errors on ~12 lines ⇒ at real-app scale (hundreds of files) this is hundreds–thousands of red errors on code the user didn't just write — the "I installed it and my whole app is red" wall. **No incremental/baseline mode exists** (the check walks all of `app`+`components` every run). Confirms the **brownfield-baseline fast-follow** (enforce only new/changed code).
**Overlap finding:** the slip-throughs (text-palette, keyword colors, arbitrary `rounded-[]`) are the same **gate-coverage holes** seen in B3 (named no-op classes) and the M5 fast-follow list — the gate flags the common cases but is not airtight.

---

## 5. Required assertions (§5) — witnessed?
- [x] #1 extension procedure unaided — **color: YES (S1)** proper procedure, both blocks, `npm run tokens`, manifest documents it. **non-color: PARTIAL** — B2 added a working radius step unaided (no machinery), proving it's *possible*, but the path is unreliable (B1 edited machinery → FAIL; B3 used built-in classes → silent no-op; **0/3 took the single-knob path**).
- [x] #2 red-gate self-recovery — **YES (S1)**: read a red `npm run check` and fixed from its output alone, zero hints, via the correct extension procedure. The genuinely-new M5 machinery — **validated.**
- [ ] #3 invented-token gate hole — **re-probed: much narrower than flagged (see below)**

### #3 — direct empirical probe (invented color through the FULL gate)
Added `--ghost: oklch(0.95 0.02 200)` to `app/globals.css` `:root` **only**, then ran the full blocking gate:
- **Naked (no `npm run tokens`):** `npm run check` FAILS (`manifest-fresh` — stale); `npm test` FAILS (manifest-fresh, freshness, self, **apply-theme identity**). → caught immediately.
- **After `npm run tokens`:** `npm run check` ✓ (both-theme is COLOR_ROLES-only, so it doesn't flag `--ghost`) — **BUT `npm test` still FAILS** on `apply-theme.test.ts` ("applying neutral to globals is a token-set identity"): `--ghost` is in globals but not `themes/neutral.css` → identity breaks. → **caught by the test suite.**
- **Contrast leg:** `lib/tokens/contrast.ts` auto-pairs **any** `--x`/`--x-foreground` by naming convention (not a fixed list) over `themes/*.css`. So an invented `--promo`/`--promo-foreground` in the themes **is** contrast-checked → below-AA is caught.

**Resolution:** the `npm run check` **script alone** has the hole (both-theme = COLOR_ROLES-only; no contrast over globals) — but the **full blocking gate (`check && test`, what CI + husky run)** backstops it: `manifest-fresh` + `apply-theme` neutral-identity + `parity` + auto-paired `contrast` catch one-theme, unrefreshed, and below-AA invented colors. **The earlier "invented color ships one-theme/below-AA green" flag was OVERSTATED** — true of `check` alone, false of the real gate. **Residual (narrow) hole:** a color token with **no `-foreground` sibling** that nonetheless carries text isn't contrast-checked. **Corrected fast-follow:** make the `check` *script* match what the tests already enforce (both-theme over all `:root` color tokens; fold contrast into `check`) so the script is honest standalone — smaller and different from what HANDOFF first implied.

---

## 6. Findings ledger (§8)

| # | Finding | Class | Against | Severity | Disposition |
|---|---|---|---|---|---|
| F1 | LLMs default to **reusing an existing token** (incl. a semantically-wrong one — `warning`/`success` as a promo accent) rather than extending, when a token is syntactically usable. The gate enforces token *usage*, not *semantic fit*. | contract-design | M5 | Low (extension works when forced — S1) | Observation; optional AGENTS.md nudge ("if no token fits the *meaning*, extend") — fast-follow |
| F2 | **Non-color extension is unreliable.** Same "softer corners" task → B1 edited machinery (FAIL), B2 worked but left the token **undocumented in the manifest**, B3 used built-in classes that **silently no-op**. 0/3 found the single-knob path (`--radius`). | extension-procedure (non-color) | M2/M5 | **High** | **fast-follow (user-accepted)** — document a one-step non-color path + nudge single-knob + manifest-document derived steps |
| F3 | **Gate-coverage hole — silent no-op classes.** Named off-token utilities mapping to a **cleared namespace** (`rounded-2xl/3xl`) produce no CSS and are **not flagged** → a real feature (rounded cards) silently broke while the gate stayed green. | gate-coverage | M5 | **High** | fast-follow — flag named utilities outside the system's defined scale, not just `[...]` arbitraries |
| F4 | **Manifest de-documentation.** B2's `@theme`-only radius step works but appears **nowhere in `design-system.{md,json}`** → a future LLM can't discover it. | manifest-completeness | M2 | Med | fast-follow — manifest should list derived/@theme steps |
| F5 | **#3 corrected (good news).** `npm run check` *script alone* misses invented-color theme-completeness/contrast (both-theme = COLOR_ROLES-only; no contrast over globals) — **but the full blocking gate (`check && test`) backstops it** (manifest-fresh + neutral-identity + parity + auto-paired contrast). Earlier HANDOFF flag was OVERSTATED. Residual: a color token with no `-foreground` sibling isn't contrast-checked. | gate-coverage (narrow) | M5 | Low | fast-follow — align the `check` script to what the tests already enforce |
| F6 | **Brownfield: no incremental/baseline mode.** 9 violations on ~12 lines of legacy code ⇒ "whole app is red" at scale. Slip-throughs: `text-gray-500` (text-palette), keyword `color:"red"` (inline non-hex), `rounded-[5px]` (arbitrary radius). | adoption / gate-coverage | (new) | Med | fast-follow — baseline/incremental check + close the slip-throughs |

**Contract-machinery fixes applied during M6:** **0.** (B1's machinery edit was the *subagent's*, discarded — not an orchestrator product fix.) Termination bound (>2 ⇒ BLOCKED) **not hit.**

---

## 7. Verdict — ✅ **QUALIFIED PASS** (user-ratified 2026-06-19)

**Keep-decision (visual checkpoint):** keep **`/pricing` (A2)** only — Pro hero reads premium in light+dark, token-only, no extension. **Drop `/settings` (B2)** despite it passing — layout quality not reference-worthy (empty-state stacked above the form; unremarkable). **Reject `--radius-2xl`** (only the dropped settings page needed it). Net product surface added by M6: one route, zero new tokens.

**The headline loop is validated, with zero hand-fixes to the contract:**
- ✅ A fresh LLM builds a **real feature with tokens, gate-green**, unaided — pricing **A1 + A2 = 2/2 clean PASS**; settings **B2** shipped a clean token-only page.
- ✅ **Color extension end-to-end, unaided** (S1): hit a genuine gap → ran the procedure (`:root`+`.dark` → `npm run tokens`) → manifest self-documented → theme-complete + AA (forced by the test suite).
- ✅ **Red-gate self-recovery, unaided** (S1): the genuinely-new M5 machinery M2.5 never tested — an LLM read a red `npm run check` and fixed it correctly from the output alone. **This is the strongest single result.**

**But not an unqualified pass — the runs surfaced real, pre-registered weaknesses:**
- ⚠️ **Settings did not cleanly hit 2 correct passes.** Of 3 runs: 1 genuine PASS (B2, but token undocumented), 1 FAIL (B1, machinery edit), 1 hollow PASS (B3, **silently broken corners the gate missed**). The **non-color extension path is confirmed unreliable** (F2) and the **silent-no-op gate hole is real** (F3).
- ⚠️ Several narrower gate edges (F4–F6).

**Why QUALIFIED PASS, not BLOCKED:** the product's core promise — *an LLM builds with the system, extends it, and recovers from the gate, with zero contract hand-fixes* — **was demonstrated end-to-end for color** (the primary case) and the contract machinery needed **no fixes** during the run (bound not hit). The weaknesses are all in **non-color extension + gate-coverage edges**, every one **pre-registered as a fast-follow** (§9) and **user-accepted as deferred**. None is a contract *defect that blocks the headline*; they bound *how far* the v1 claim reaches (color: strong; non-color: works-but-rough).

**Why not unqualified PASS:** B3's silent breakage + F2's unreliability mean we cannot honestly claim "any feature, any value, flawlessly." The honest claim v1 earns: **"an LLM builds real features with the design system and extends it with *color* reliably, recovering from the gate unaided; *non-color* extension works but is rough (fast-follow)."**

**Recommended actions:** ratify QUALIFIED PASS at the visual checkpoint (§ Task 8); keep decision on `/pricing` + `/settings` + any token is the user's; correct the overstated HANDOFF #3 note (F5); promote **F2 + F3** to near-term (not just "someday") given they silently break real features.
