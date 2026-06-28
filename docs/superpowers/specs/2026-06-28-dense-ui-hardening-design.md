# Dense-UI Hardening

**Status:** design (awaiting plan)
**Date:** 2026-06-28
**Milestone:** dense-UI hardening (precedes the 5-theme suite milestone — themes inherit these tokens)

---

## 1. Problem

Building a Linear-style dense product UI on the system (marketing hero + 3-pane issue tracker + floating agent panel) surfaced where the token set + primitive set bend. The page looked **flat** and required hand-rolled workarounds (fake avatar, fake inline-code chip, generic status icons). Eight gaps were catalogued. This milestone closes them — **honestly** (per a 3-agent design review that cut the unsafe/redundant proposals).

The system is a **generic website/SaaS starter for vibe-coders building with an LLM**, not a PM tool. Fixes must generalize and must not ship footguns (un-auditable contrast, color-only meaning) to an audience that won't hand-audit.

## 2. Scope & stance

In scope (this milestone, lands on `main` before the theme suite):
- **Tokens:** one subtle **surface** role pair, a **`2xs`** micro type step (+ its gate fix), and **activating the dormant `--accent`** as the hover surface.
- **Primitives** (`components/ui/*`, token-only): **Avatar/AvatarGroup, Badge, Separator, Code, Kbd**.
- **Docs:** icon convention, `NAMING-CONVENTION.md` updates, `/design-system` showcase additions.

Out of scope: the 5-theme suite (next milestone), a numbered neutral ramp, workflow-state color tokens, Tooltip/Menu/Dialog, scrollbar styling.

## 3. Locked decisions (brainstorm + 3-agent design review)

| # | Decision | Why |
|---|---|---|
| D1 | **Hardening lands before the theme suite** | new tokens must exist in every theme; themes inherit them. |
| D2 | **Surfaces, not a 3rd text tier, fix the flatness** | light mode has `background`/`card`/`popover` all at pure white + `muted`/`secondary`/`accent` at one off-white → every panel renders identically. Depth comes from surfaces. |
| D3 | **Cut `--foreground-subtle` (keep 2 text tiers)** | it escapes the contrast gate (no `-foreground` suffix → never paired → AA unchecked) **and** a tier fainter than `muted-foreground` (already 4.73:1 on white) can only reach ~3.1–4.0:1 → never passes body AA. A footgun in a no-audit starter. |
| D4 | **Cut `--hover`; activate `--accent` instead** | shadcn's hover token (`--accent`/`--accent-foreground`) already ships — in the contract, schema, editor — but **nothing consumes it**; components hand-roll hover off `--muted`. Wire `--accent` (the canonical hover surface), don't mint a 3rd hover concept. Zero new tokens. |
| D5 | **`StatusIndicator` → `Badge`** | shadcn canonical is `Badge` (a cva pill); the showcase already fakes status pills. One pill primitive, not two. Status = Badge + an **always-labeled** dot (never color-only — WCAG 1.4.1). |
| D6 | **Add `Separator`** (swapped in for the cut text tier) | dense layouts are built on rules; a bigger flatness lever than a 3rd gray. |
| D7 | **Semantic tokens, not numbered ramps; status reuses existing semantic colors** | the contract reserves numeric steps for open-ended ramps (`--brand-*`); a surface/text role must be semantic. `success/warning/info/destructive` already exist for status. |

## 4. Architecture — tokens

### 4.1 `--surface` + `--surface-foreground` (new color role pair)

A subtle surface a step off `--background`, for panels/sidebars/wells/zebra rows — the actual fix for flatness (D2).

- Add **`surface`** to `COLOR_ROLES` (`lib/tokens/schema.ts`) so it's a first-class, name-classified role (value-agnostic) + documented in `NAMING-CONVENTION.md`. Pairs as `--surface`/`--surface-foreground` via `partnerOf` → **contrast-gated**.
- **Hand-tuned oklch per theme**, defined in **both** `:root` and `.dark` (like `card`/`muted`): `--surface` = a gentle step off `--background` (e.g. light ~L 0.985; dark ~one step lighter than bg); `--surface-foreground` = the body text color (≈ `--foreground`).
- Auto-wires on `npm run tokens` (`syncThemeMappings` color case → `--color-surface`; `bg-surface`/`text-surface-foreground` compile; manifest + editor handle it as a color group with zero extra wiring — verified in review).
- **Considered + deferred:** deriving `--surface` via `color-mix(in oklch, var(--foreground) 4%, var(--background))` (themes-for-free) — deferred because the contrast gate + validate skip `color-mix` (can't statically verify), so a derived surface would be unchecked. Hand-tuned keeps it gated. Per-theme cost is one L value; revisit if it proves burdensome.

### 4.2 `--fs-2xs` + `--lh-2xs` (~11px micro step) + **required gate fix**

For non-essential glyphs (avatar initials, kbd caps) — scale floors at `--fs-xs` (12px).

- Add `--fs-2xs` (~0.6875rem) + `--lh-2xs` to `:root` of all themes. Auto-wires `--text-2xs` (+ line-height) via the F2 scale sync.
- **BLOCKING gate fix:** add `"2xs"` to `VOCAB.text` in `lib/check/off-token-scale.ts:16` (it's in `VOCAB.shadow` but **not** `VOCAB.text`). Without it, `text-2xs` is an **unguarded silent no-op** — the exact bug that check exists to catch.
- **Guardrail (a11y):** primitives default to `text-xs` (12px); `2xs` is **opt-in for non-essential, non-prose glyphs at full `--foreground` contrast** — never for body text, never combined with a faint color. Document `2xs` + low-contrast as an anti-pattern.

### 4.3 Activate `--accent` as the hover surface (D4)

- `--accent` is currently `== --muted` (both L 0.97 in neutral) and unused. **Tune `--accent` slightly off `--muted`** (a hair darker/lighter) so hover is visible, in all themes (both blocks).
- **Rewire components** (`components/ui/button.tsx`, and any other `hover:bg-muted`) → `hover:bg-accent hover:text-accent-foreground`. This un-overloads `--muted` (the real goal) with no new token.

## 5. Architecture — primitives

All in `components/ui/*` (next to Button/Input/Card; that dir is gate-**excluded** as vendored). **House conventions (match `button.tsx`):** module-scope `cva` export, `data-slot`/`data-variant`/`data-size` attrs, `cn(...)`, `React.ComponentProps<...>`, `Slot` for `asChild` — **no `forwardRef`** (the repo uses function components + `ComponentProps`). Token-only. A **dedicated test** asserts each new primitive carries **no hardcoded color literals** (hex/rgb/hsl/oklch/named) — restoring the dogfood coverage the dir-exclusion drops.

| Primitive | Spec | a11y (required, not optional) |
|---|---|---|
| **Avatar** + **AvatarGroup** | Radix `@radix-ui/react-avatar` (already a dep): `Root`/`Image`/`Fallback`. Sizes sm/md/lg. Initials fallback. Group = stacked overlap + `+N` overflow chip. `bg-secondary`/`text-secondary-foreground`, `ring-background`. | img `alt` = person name; initials marked `aria-hidden` + wrapper `aria-label={name}`; `+N` chip has accessible name (counts/lists hidden). |
| **Badge** | cva variants: `default`/`secondary`/`success`/`warning`/`info`/`destructive`/`outline`. Pill, `text-xs font-medium`. **Replaces the faked status spans** in `component-showcase.tsx:42-55`. | semantic color is **never the sole channel** — the label text carries meaning. |
| **Status dot** (thin) | a small filled/ring dot as a Badge leading element or tiny helper — **always paired with a label**; filled vs ring distinguishes states by shape, not just hue. | label or `aria-label` **required**; no dot-only mode without an accessible name. |
| **Separator** | Radix `@radix-ui/react-separator`: horizontal/vertical, `bg-border`, `role=separator` / decorative. | decorative vs semantic orientation honored. |
| **Code** + **Kbd** | `Code`: inline `<code>` chip — `bg-muted font-mono rounded px-1.5 text-xs`. `Kbd`: keyboard cap — border + `bg-muted` + `text-2xs` (first consumer of `2xs`). | — |

## 6. System surfacing

- **`/design-system`:** new tokens auto-appear (manifest-driven, `data-token`-tagged → editable in the visual editor for free). `ComponentShowcase` gains Avatar / Badge / Separator / Code+Kbd sections and **consumes `Badge`** (deleting the faked status spans).
- **Iconography (gap #8, docs-only):** add an "Icons" note to `design-system.md` preamble + `AGENTS.md` — `@untitled-ui/icons-react` is the bundled set (1173 icons), default `size-4`, color via `text-*` tokens. (`lucide-react` is present but a broken version — do not use; note this.)
- **`NAMING-CONVENTION.md`:** document the `surface` role pair, the `2xs` step, and `--accent`-as-hover.

## 7. Rejected approaches (review-grounded)

- **`--foreground-subtle` (3rd text tier)** — REJECTED (D3): escapes the contrast gate + can't pass body AA on white. The flatness is a surface problem.
- **`--hover` token** — REJECTED (D4): duplicates the dormant `--accent` and the existing `--opacity-hover: 0.08`. Activate `--accent`.
- **Deriving `--surface` via `color-mix`** — DEFERRED (§4.1): contrast/validate skip `color-mix` → would be unchecked. Hand-tune to keep it gated.
- **`StatusIndicator` as its own primitive** — REJECTED (D5): overlaps `Badge` + the faked showcase pills. Build `Badge`.
- **Numbered neutral ramp / workflow-state color tokens** — REJECTED (D7): un-semantic / PM-specific in a generic starter.

## 8. Residuals (accepted, documented)

- `--surface` is within ~1.5% L of `--background`, so `--foreground`-on-`--surface` inherits the (gate-checked) `--foreground`/`--background` contrast — the `--surface`/`--surface-foreground` pair being slightly redundant is acceptable and keeps it a proper gated role.
- `2xs` micro-text remains a small-text caution; the guardrail (non-essential glyphs, full contrast) is doc-enforced, not gate-enforced (the gate has no size awareness).

## 9. Testing (TDD)

- **Token wiring:** `--surface`/`--surface-foreground` classify as `color` (`groupForName`), auto-map (`bg-surface`/`text-surface-foreground` compile), appear in manifest, both-theme requires both blocks, contrast pairs them. `--fs-2xs`→`text-2xs` compiles.
- **Gate fix:** `off-token-scale` no longer treats `text-2xs` as off-token once `--fs-2xs` is defined; **does** flag `text-2xs` when undefined (add a unit test; `2xs` in `VOCAB.text`).
- **Primitives:** render tests (Avatar image/fallback/group `+N`; Badge variants; Separator orientation; Code/Kbd) + a11y assertions (Avatar `aria-label`/`alt`, Badge label present, Separator role) + the **no-hardcoded-color** test over the new `components/ui/*` files.
- **Accent activation:** button hover uses `bg-accent`; `--accent` ≠ `--muted` in every theme (a small test or visual check).
- **Regression:** `both-theme`/`contrast`/`parity` green with the new tokens added to neutral + swiss + brutalist (all three, both blocks).
- **Verification:** `npm run verify` (`check && test && lint && build`) + `npx playwright test`. **Proof:** re-render a clean (token-only, no arbitrary classes) Linear-style verification page using the **real** new primitives/tokens (no hand-rolled workarounds) and screenshot it.

## 10. Files touched

**New:** `components/ui/{avatar,badge,separator,code,kbd}.tsx`, `tests/ui/no-hardcoded-color.test.ts` (+ primitive render/a11y tests), `tests/check/...` (2xs gate test).
**Edited:** `app/globals.css` + `themes/{neutral,swiss,brutalist}.css` (`--surface`/`--surface-foreground`, `--fs-2xs`/`--lh-2xs`, tune `--accent`; both blocks), `lib/tokens/schema.ts` (`surface` in `COLOR_ROLES`), `lib/check/off-token-scale.ts` (`2xs` in `VOCAB.text`), `components/ui/button.tsx` (+ any `hover:bg-muted`) → `hover:bg-accent`, `components/design-system/component-showcase.tsx` (consume Badge + show new primitives), `design-system.{json,md}` (regenerated), `docs/NAMING-CONVENTION.md`, `AGENTS.md` + `design-system.md` preamble (icon note).

## 11. Out of scope (future)

5-theme suite (next milestone), numbered neutral ramp, workflow-state colors, Tooltip/Menu/Dialog/Sheet, scrollbar styling, a 4th text tier, `color-mix`-derived surfaces.
