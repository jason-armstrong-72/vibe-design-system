# Design Brief — the aesthetic contract

This brief is read by any agent doing visual work on the starter: the design-system page (M3), the editor
chrome (M4), and especially the **8 theme presets** (M3a). It exists to turn "make it look good" (a
lottery) into "hit *this* target" (convergent). Structure, behaviour, and accessibility are locked in the
plans as tested requirements; **this document governs taste.**

How to use it: build → screenshot the `/design-system` page → grade the screenshot against the relevant
brief below → revise → repeat until it passes. Do not ship a visual that you have not screenshotted and
graded.

---

## Master brief (applies to every theme + the tool's own UI)

**Principles**
- **Coherent, not decorated.** Every visual choice (radius, shadow, border, type) should feel like one
  decision, not a pile of effects. If a token group doesn't serve the theme's signature, keep it quiet.
- **Type carries the design.** A strong type scale and rhythm do more than color. Get hierarchy,
  measure, and vertical rhythm right before reaching for ornament.
- **Restraint scales.** Users build *their* product on this. A starter that screams is hard to live in.
  Distinctive ≠ loud. Even "Brutalist" should be *controlled*.
- **Avoid the generic-AI look.** No default-purple-gradient-on-white, no uniform drop shadows on every
  card, no center-everything. Make deliberate, slightly unexpected choices that read as human-designed.

**Hard requirements (gates — non-negotiable, every theme, light AND dark)**
- All `fg/bg` token pairs meet **WCAG AA** (4.5:1 body, 3:1 large). OKLCH lightness makes this checkable.
- Focus states visible and consistent; keyboard navigation never traps.
- No layout overflow at any breakpoint (sm/md/lg/xl).
- Every token group is exercised somewhere on the `/design-system` page (truthful by construction).
- Nothing left accidentally at the Neutral default — if a theme keeps a Neutral value, it's a choice.

**What "graded against the brief" means**
1. Contrast pass (automated where possible).
2. Coherence — does it read as one intentional system?
3. Distinctiveness — could you tell this theme from the other seven in a thumbnail?
4. Liveability — would a builder be happy starting their product here?

---

## Per-theme mini-briefs

Each theme is a complete token value-set under the fixed names. The fields below are *direction*, not
exact values — the agent authors values to hit the mood and pass the gates.

> **v1 builds 3 of these:** **Neutral** (1), **Swiss** (2), **Brutalist** (5) — chosen for maximum spread.
> The other five are fast-follow on the same machinery. All eight briefs are kept here as the standing
> contract, so whoever builds them later has the target.

### 1. Neutral (default, M0 canonical)
- **Mood:** calm, professional, unobtrusive. The "safe start" you can brand into anything.
- **Color:** true greys (near-zero chroma) + a single restrained accent (cool blue-ish). Status colors
  present but muted.
- **Type:** clean grotesque sans (e.g. Inter/Geist). Modest scale. Mono for code.
- **Geometry/depth:** medium radius (~0.6rem), 1px borders, soft low shadows.
- **Do:** stay quiet and legible. **Don't:** add personality that's hard to remove.

### 2. Swiss / Minimal
- **Mood:** crafted, austere, confident. International Typographic Style.
- **Color:** near-monochrome — black/white/grey, optionally one tiny red or blue signal accent used
  sparingly.
- **Type:** a real grotesque (Helvetica-like / Neue Haas / Inter). Strong scale contrast; generous
  leading; left-aligned, ragged right.
- **Geometry/depth:** **radius 0**. Hairline (1px) borders doing structural work. **No shadows** — depth
  via space and rules, not elevation.
- **Do:** let whitespace and the grid carry it. **Don't:** round anything, add shadows, or center text.

### 3. Editorial
- **Mood:** magazine, expressive, high-contrast hierarchy.
- **Color:** one confident brand hue (e.g. deep ink + a warm or jewel accent), rich neutrals.
- **Type:** **serif/sans pairing** — a display serif for headings, clean sans for body. This is the
  theme's signature; the bundled serif/display face matters most here.
- **Geometry/depth:** small radius, considered rules and dividers, subtle elevation. Big type, dramatic
  size jumps.
- **Do:** make headlines an event. **Don't:** let it become a generic blog.

### 4. Warm / Organic
- **Mood:** approachable, soft, human, a little hand-made.
- **Color:** earthy/warm — terracotta, sand, olive, warm off-white backgrounds (not pure white).
- **Type:** humanist sans (rounded terminals), comfortable size.
- **Geometry/depth:** soft, larger radius; gentle diffuse shadows; warm-tinted borders.
- **Do:** feel cozy and calm. **Don't:** drift into childish/pastel (that's theme 6).

### 5. Brutalist
- **Mood:** raw, structural, high-impact, anti-slick — but controlled.
- **Color:** stark — black/white with one or two loud primaries (electric blue, hot red, acid yellow).
- **Type:** mono or heavy grotesque; big, blunt, tight.
- **Geometry/depth:** **thick borders** (the `--border-width-thick` token earns its place), **hard offset
  shadows** (no blur), radius 0.
- **Do:** commit to the bit; make the structure visible. **Don't:** make it ugly-by-accident — it's
  deliberate, still passes contrast + a11y.

### 6. Soft / Pastel SaaS
- **Mood:** friendly, light, modern product UI.
- **Color:** low-saturation pastels (soft lavender/mint/peach) on near-white; gentle accent. Mind contrast
  — pastels fail AA easily, so darken text and accents enough to pass.
- **Type:** rounded geometric sans, medium weight.
- **Geometry/depth:** generous radius, soft colored shadows (tinted, low opacity).
- **Do:** feel calm and inviting. **Don't:** sacrifice the contrast gate for prettiness.

### 7. Technical / Dark-first
- **Mood:** developer tool, terminal-adjacent, precise.
- **Color:** dark base is primary (design dark first, derive light), near-black surfaces, one bright
  accent (cyan/green/amber). Charts crisp.
- **Type:** grotesque sans + prominent mono; slightly tighter, data-dense.
- **Geometry/depth:** small radius, thin borders, minimal/sharp shadows; subtle accent glows OK.
- **Do:** feel fast and information-dense. **Don't:** neon everything — one accent, used with discipline.

### 8. Corporate / Trust
- **Mood:** enterprise, dependable, conservative.
- **Color:** trustworthy blue primary, conservative neutrals, clear status colors.
- **Type:** safe professional sans; conventional scale; denser spacing for data/forms.
- **Geometry/depth:** small-medium radius, 1px borders, restrained shadows.
- **Do:** look like software a CFO approves. **Don't:** be exciting; that's not the job here.

---

## Bundled fonts (shared set the themes draw from)

A small `next/font` Google-font set covers the needs above without per-theme bloat:
- **Sans (body/UI):** a clean grotesque (Inter or Geist Sans) — used by most themes.
- **Mono:** Geist Mono / JetBrains Mono — Technical, Brutalist, code blocks everywhere.
- **Serif/Display:** one display serif (e.g. Fraunces / Instrument Serif) — Editorial's signature, also
  usable by Warm.
- **Rounded (optional):** if Pastel/Warm want rounder terminals and Inter doesn't suffice, one rounded
  humanist face.

Themes set `--font-sans` / `--font-mono` (and `--font-serif` where relevant) to faces from this shared
set. `lib/fonts.ts` is the single place fonts are declared and exported as CSS variables for the tokens to
reference. Keep the bundled set to ~4 faces — every added face is download weight for every user.
