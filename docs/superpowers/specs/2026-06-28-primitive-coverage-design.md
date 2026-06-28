# Primitive Coverage + Component Catalog

**Status:** design (awaiting plan)
**Date:** 2026-06-28
**Milestone:** primitive coverage (follows dense-UI hardening; precedes / reorders ahead of the 5-theme suite)

---

## 1. Problem

The system ships 8 primitives (Button, Input, Card, Avatar, Badge, Separator, Code, Kbd). That covers a static page. It does **not** cover a real app: the moment you build one you need the pieces that **pop up, fold, switch, and notify** — Dialog, Dropdown, Tooltip, Tabs, Select, Switch, Toast, Table, etc. Building the dense Linear dogfood screen this session, those were all **hand-faked** (fake nav buttons, fake menus). A vibe-coder (or the LLM building for them) hits the same wall and hand-rolls un-systematic, un-tokenized, un-audited markup — exactly the drift the design system exists to prevent.

Two compounding gaps:
1. **No interaction primitives.** ~19 high-frequency components are missing.
2. **The LLM doesn't know what exists.** The contract auto-loads the **token** manifest (`design-system.md`) but **nothing about components**. So even after we add `Dialog`, the LLM has no signal it exists → hand-rolls a `<div>`. The token-drift problem, unsolved for components.

## 2. Scope & stance

The audience is a **generic website/SaaS starter for vibe-coders building with an LLM**. Primitives must be token-only, accessible by default, and unopinionated about app-level libraries.

**In scope (this milestone):** ~19 primitives, one new `--overlay` token, an auto-generated component catalog + freshness gate, `/design-system` live demos, and two permanent token-only reference screens.

**Out of scope (deferred, YAGNI for now):** Menubar, NavigationMenu, HoverCard, ContextMenu, Collapsible, Progress, Slider, Toggle/ToggleGroup, Breadcrumb, Pagination, ScrollArea, Carousel, Calendar/DatePicker, Combobox, InputOTP, Resizable, Drawer; **react-hook-form-coupled Form**; charts; full TypeScript prop-type extraction for the catalog; the 5-theme suite (still its own next milestone).

## 3. The primitive set (~19, in 4 build batches)

| Batch | Primitives | Backing |
|---|---|---|
| **Overlay (6)** | Dialog, AlertDialog, Sheet, Popover, Tooltip, DropdownMenu | `radix-ui` (unified) |
| **Form (7)** | Label, Checkbox, RadioGroup, Switch, Select, Textarea, **Form-layout set** (FormItem/FormLabel/FormDescription/FormMessage) | `radix-ui`; Textarea is a styled `<textarea>`; Form set = **styled wrappers, lib-agnostic** |
| **Nav/structure (3)** | Tabs, Accordion, Table | `radix-ui`; Table is styled `<table>` elements |
| **Feedback (3)** | Toast (**Sonner**), Skeleton, Command palette (**cmdk**) | `sonner`, `cmdk`; Skeleton is a styled `<div>` |

**New dependencies:** `sonner`, `cmdk` only. Everything else uses the already-installed `radix-ui`.

### 3.1 Locked decisions (brainstorm)

| # | Decision | Why |
|---|---|---|
| D1 | **Form is styling-only, NOT react-hook-form-coupled** | shadcn's canonical Form hard-couples react-hook-form (+zod +resolvers). For a generic vibe starter that's lock-in + dead bundle weight. Ship consistent label/control/error-text styling that works with anything; heavy-form users add RHF in 2 minutes. |
| D2 | **Toast = Sonner** | shadcn deprecated its own Radix Toast in favor of Sonner; it's the current canonical (one `<Toaster/>` + `toast()`). |
| D3 | **Command palette IN** (`cmdk`) | ⌘K is increasingly expected in "pro" apps; one extra lib, self-contained. |
| D4 | **One new token: `--overlay`** | scrims need a dark translucent veil; shadcn's `bg-black/50` is a hardcoded color (gate-forbidden) and no existing token fits (`foreground` is white in dark → white veil). |
| D5 | **Catalog is generated + freshness-gated** | a hand-maintained list rots; mirror the token `manifest-fresh` teeth so a primitive without a catalog entry fails the gate. |
| D6 | **Two permanent reference screens** | Settings (primitive-dense) + promote `/preview-app` (app-shell). Token-only → restyle for free on theme/token changes; build+gate over them = tripwire for primitive breakage. |

## 4. Architecture — primitives

All in `components/ui/*` (the gate-**excluded** vendored dir). **House conventions (match `button.tsx`/the dense-UI primitives):** module-scope `cva` export where variants exist, `data-slot`/`data-variant`/`data-size` attrs, `cn(...)`, `React.ComponentProps<...>`, `Slot` for `asChild`, **no `forwardRef`**. **Radix import = the unified package** (`import { Dialog as DialogPrimitive } from "radix-ui"`), never `@radix-ui/react-*`. Token-only. Adapted from shadcn's canonical implementations so behavior + a11y are proven, not invented — but re-tokenized (shadcn ships some hardcoded values we must replace, see §4.1) and de-`forwardRef`'d to house style.

**Animations:** `tw-animate-css` is already a dep; `data-[state=open]:animate-in` etc. are class-only (no color) and pass the gate.

**Per-primitive a11y is required, not optional:** roles/aria wired by Radix, labels associated, `Dialog`/`Sheet` get a title (or `sr-only` requirement documented), `DropdownMenu`/`Select`/`Command` keyboard-navigable (Radix/cmdk default).

### 4.1 The `--overlay` token (the one token-Law touch)

- Add **`overlay`** to `COLOR_ROLES` (`lib/tokens/schema.ts`) — a standalone color role with **no `-foreground` pair** (like `border`/`input`/`ring`; uncheckable by the contrast gate, an accepted residual).
- Value = a **dark translucent veil, defined in both `:root` and `.dark` of all 4 surfaces** (`app/globals.css` + `themes/{neutral,swiss,brutalist}.css`): e.g. `:root --overlay: oklch(0 0 0 / 0.5);` `.dark --overlay: oklch(0 0 0 / 0.7);` (dark needs a heavier veil to read against a dark page; per-theme values finalized in the plan).
- Auto-wires `--color-overlay` on `npm run tokens` → `bg-overlay` compiles. `both-theme` requires it in both blocks (alpha is fine — presence-by-value); contrast skips it (no pair / alpha). Dialog/Sheet/AlertDialog overlays use `bg-overlay`.

## 5. Architecture — the component catalog (D5)

The mechanism that makes the LLM **reach for** the primitives instead of hand-rolling.

- **Registry (authored, one entry per primitive):** a typed registry (`lib/catalog/registry.ts` or co-located per-component metadata — plan picks) carrying, per primitive: `name`, one-line **purpose**, **when-to-use**, the **import line**, a **minimal usage snippet**, and key **props/variants**. Descriptions are hand-written (the high-value part); the *list* is kept honest by the gate, not by hand.
- **Generator:** `scripts/generate-catalog.ts` emits a markdown catalog. **Recommended (these two choices interact — pick them together): a dedicated `npm run catalog` script writing a dedicated `design-system.components.md`** — cleaner for the freshness gate's git-dirty CI check than folding into the `npm run tokens` pipeline + the token manifest. The plan confirms.
- **Freshness gate — `catalog-fresh` sub-check** (`lib/check/catalog-fresh.ts`, wired into `run.ts` alongside `manifest-fresh`): every exported wrapper under `components/ui/*` must have a registry entry, and the generated doc must be current (in-process compare; CI also git-dirty). A new primitive with no entry → **red**, same teeth as `manifest-fresh`. This is what stops the catalog rotting.
  - **The gate keys on exported symbols, NOT files** — several primitives are co-located in one file (Code+Kbd, Avatar+AvatarGroup, the FormItem/FormLabel/FormDescription/FormMessage set). The registry + freshness check must enumerate **exports**, so the plan extracts exported symbols (not filenames) from `components/ui/*`.
- **Contract surfacing:** the `AGENTS.md` `design-system` block + `design-system.md` preamble point the LLM at the catalog ("these components exist — use them, don't hand-roll").

**Considered + rejected:** full TS prop-type extraction (ts-morph) — rich but brittle/heavy; the curated registry is more useful to an LLM (intent + snippet > raw prop signatures) and far cheaper. Deferred indefinitely.

## 6. System surfacing & dogfood (D6)

- **`/design-system`:** `ComponentShowcase` gains a live, interactive section per new primitive (open a real Dialog, toggle a real Switch) — the showcase becomes a pokeable catalog. New token `--overlay` auto-appears (manifest-driven, editable in the visual editor).
- **Permanent reference screen — `/settings`:** token-only, built from the new primitives (Tabs sections + Switch/Select/Checkbox controls + a save Dialog + a "Saved ✓" Toast + a DropdownMenu). Chosen for max primitive coverage and because "build me a settings page" is among the most common asks. Committed; the build+gate run over it (tripwire); restyles for free on theme/token change.
- **Promote `/preview-app` to permanent:** the dense Linear app-shell built this session, currently throwaway, becomes a committed token-only route (a second dogfood, app-shell flavor). Rewire its faked nav/menus to the real DropdownMenu/Tooltip/Tabs now that they exist.

## 7. Testing (TDD)

- **Per primitive:** a render test + an a11y assertion (role/aria/labelling/orientation as applicable). Overlay primitives: opens on trigger, content present, `Escape`/close path. Form controls: checked/unchecked state + label association. Tabs: panel switch. Toast: `toast()` renders via `<Toaster/>`. Command: filter narrows items.
- **No-hardcoded-color:** extend the existing `checkHardcodedColor`-based test (dense-UI Task 9) to cover **all** new `components/ui/*` files — the dir is gate-excluded at the walk level, so the test scans them directly. This is what guarantees the re-tokenization actually happened (catches a stray `bg-black/50`).
- **Token wiring:** `--overlay` classifies as `color` (`groupForName`), `bg-overlay` compiles, present in both blocks of all 4 themes (`both-theme` + theme parity tests).
- **Catalog gate:** `catalog-fresh` flags a primitive with no registry entry and a stale generated doc (unit test on the pure check fn, mirroring `manifest-fresh`'s test).
- **Dogfood screens:** render/no-overflow e2e (like `e2e/themes.spec.ts`) + token-only (`npm run check` scans `app/`).
- **Regression:** `npm run verify` (`check && test && lint && build`) + `npx playwright test`. **Proof:** the two reference screens screenshot clean light+dark across all 3 themes.

## 8. Residuals (accepted, documented)

- `--overlay` has no `-foreground` pair → uncheckable by the contrast gate (same as `border`/`input`/`ring`). Acceptable; it's a scrim, never a text surface.
- The catalog descriptions/snippets are hand-authored → can drift in *quality* (the freshness gate only enforces *presence + sync of the list*, not prose accuracy). Accepted; prose is the high-value human part.
- Sonner/cmdk are third-party; their internal DOM isn't fully token-governed (we restyle the surfaces we expose). Documented.
- Form is styling-only: no validation engine. Documented as a deliberate non-goal (D1) with a one-line "add react-hook-form yourself if you need it."

## 9. Files touched (indicative; plan finalizes)

**New:** `components/ui/{dialog,alert-dialog,sheet,popover,tooltip,dropdown-menu,label,checkbox,radio-group,switch,select,textarea,form,tabs,accordion,table,sonner,skeleton,command}.tsx` (+ a per-primitive test each); `lib/catalog/{registry,generate}.ts`, `scripts/generate-catalog.ts`, `lib/check/catalog-fresh.ts`, `design-system.components.md` (generated); `app/settings/page.tsx`; tests for catalog-fresh + dogfood e2e.
**Edited:** `app/globals.css` + `themes/{neutral,swiss,brutalist}.css` (`--overlay`, both blocks); `lib/tokens/schema.ts` (`overlay` in `COLOR_ROLES`); `lib/check/run.ts` (wire `catalog-fresh`); `package.json` (`sonner`, `cmdk`, `catalog` script); `components/design-system/component-showcase.tsx` (live demos); `app/preview-app/page.tsx` (promote + rewire to real primitives); `tests/ui/no-hardcoded-color.test.ts` (cover all new files); `AGENTS.md` + `design-system.md` preamble + `docs/NAMING-CONVENTION.md` (`--overlay`, catalog pointer); `docs/HANDOFF.md`.

## 10. Plan note — batching

This is a **large** milestone. The plan should sequence it as: (0) `--overlay` token + schema, (1) catalog infra + `catalog-fresh` gate scaffolded against the **existing** 8 primitives first (so the gate is green before adding more), then primitives **batch-by-batch** (overlay → form → nav → feedback), each primitive its own TDD task + registry entry, then (final) `/design-system` demos, the two reference screens, docs, and HANDOFF. One commit per task as usual.

## 11. Out of scope (future)

The deferred primitive list (§2), react-hook-form Form, charts/Chart components, ts-morph prop extraction, the 5-theme suite (still next-after-this), per-theme catalog variance.
