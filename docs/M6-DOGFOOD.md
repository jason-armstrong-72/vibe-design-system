# M6 — Dogfood Gate — run record

**Protocol:** [docs/superpowers/specs/2026-06-18-m6-dogfood-gate-design.md](superpowers/specs/2026-06-18-m6-dogfood-gate-design.md)
**Plan:** [docs/superpowers/plans/2026-06-19-m6-dogfood-gate.md](superpowers/plans/2026-06-19-m6-dogfood-gate.md)
**Branch:** `m6-dogfood`
**Verdict:** _PENDING_

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

### Run B2 — /settings
_TBD_

---

## 4. Brownfield observation (§2.3)
_TBD_

---

## 5. Required assertions (§5) — witnessed?
- [ ] #1 extension procedure unaided (color + radius-knob)
- [ ] #2 red-gate self-recovery
- [ ] #3 invented-token gate hole — confirmed?

---

## 6. Findings ledger (§8)
_TBD_

---

## 7. Verdict
_PENDING_
