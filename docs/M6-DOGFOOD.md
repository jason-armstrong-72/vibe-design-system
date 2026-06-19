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

### Run A1 — /pricing
_TBD_

### Run A2 — /pricing
_TBD_

### Run B1 — /settings
_TBD_

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
