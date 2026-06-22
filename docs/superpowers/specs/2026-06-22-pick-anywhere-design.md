# Pick-anywhere (reverse token resolution) — design

**Date:** 2026-06-22
**Status:** Design approved (brainstorm, 3-agent reviewed → reworked), pre-plan
**Milestone:** M4 editor fast-follow — "pick-anywhere / reverse-resolution (click any element → resolve which token drives it → open it)" (HANDOFF M4 list).
**Depends on:** M4 (dev-only editor `components/editor/*`, `lib/editor/*`), the manifest (`design-system.json` / `lib/tokens/generate.ts` — the per-token `utilities` field), `culori` (already a dep, used in `lib/tokens/contrast.ts`).

> **What it does:** adds an **eyedropper mode** to the editor. Toggle it on; hovering highlights *any*
> element (not just `[data-token]`-tagged ones); clicking resolves which design token(s) drive that
> element's computed styles and lists them in a popover grouped by CSS property; clicking a row opens
> that token in the existing docked panel for editing. It fills the gap the normal hover can't: the
> component showcase and arbitrary elements carry no `data-token` hook.

A 3-agent review (correctness / DRY-architecture / UX-a11y) returned REWORK on the first draft and
reshaped the resolution mechanism + module boundaries + UX. The changes are marked inline as **[R: …]**.

---

## 0. The resolution mechanism — computed→computed probing ONLY [R: P0, all three reviewers]

From a clicked element you see only the **final, browser-serialized computed value** of each property —
never the `var()` chain. The first draft proposed comparing that to the token's *authored* value (oklch
string / manifest value). **That fails for most of the real page** and is abandoned:

- colours serialize to `rgb`/`oklab`/`oklch` (browser-dependent), never byte-equal to the authored oklch;
- alpha-modified utilities (`bg-muted/40`, `bg-background/80`, dark `--border = oklch(1 0 0 / 0.1)`) compile
  through `color-mix(...)` and bake in alpha — they equal **no** token's authored value;
- elevation tokens serialize with the colour moved to the front and `oklch→rgba` reorder;
- `--font-sans`'s authored value contains `var(--font-bundled-sans)` (next/font's hashed variable), which
  never equals the resolved family stack.

**The mechanism is therefore: match the element's computed value to a token's computed value, both produced
by the same `getComputedStyle` path.** A **probe element** carries each candidate token's value and we read
back the browser's canonical serialization:

1. **Probe build** (per theme, memoized): create one visually-hidden probe element (`position:absolute;
   width:0;height:0;opacity:0;overflow:hidden;pointer-events:none` — **NOT** `display:none`/`visibility:hidden`,
   which yield empty/unresolved computed styles **[R: correctness-S5]**) appended **inside the live theme
   subtree** (`document.body`; `setEditingBlock` toggles `.dark` on `document.documentElement`, so the probe
   inherits the active theme — `editor-provider.tsx:151`). The probe value is sourced **per group** (see the
   probe-source rule below); we read back the group's property → index `{ group → [{ canonicalValue, token }] }`.
2. **Match**: for each of the 6 element-read properties (mapped from groups by `GROUP_PROPERTY` below), read the
   clicked element's computed value, canonicalize it the same way, and look it up in the matching group's index.
   **All** tokens sharing a canonical value are returned (collision list — option A, the user's decision).

**Probe-source rule [R: spec-review — the first draft's "probe with `bg-*` / `utilities[0]`" was wrong:
synthesized `bg-foreground`/`bg-primary-foreground` aren't emitted by Tailwind, and `--border`/`--ring`/
`--input` read the wrong property].** Source the probe value from the **editable runtime token var** for every
group except radius — these vars (`--primary`, `--primary-foreground`, `--fs-sm`, `--elevation-md`,
`--font-sans`, …) are all emitted to `:root`/`.dark`, so `var(<token.name>)` always resolves, with **no
dependency on which Tailwind utility class got emitted** and **no per-token prefix logic**:
- **color** → `probe.style.color = var(<token.name>)`, read `color`. (One resolved colour per token; matched
  against the element's `background-color` **and** `color`.) Works uniformly for base, `-foreground`, `border`,
  `ring`, `input` colour tokens.
- **fontSize** → `probe.style.fontSize = var(<token.name>)` (e.g. `var(--fs-sm)`), read `font-size`.
- **fontFamily** → `probe.style.fontFamily = var(<token.name>)`, read `font-family`.
- **shadow** → `probe.style.boxShadow = var(<token.name>)` (e.g. `var(--elevation-md)`), read `box-shadow`.
- **radius** → the **one** exception. `--radius` is a single knob; elements use the four *derived* steps
  (`rounded-sm/md/lg/xl` → `var(--radius-sm…xl)`, which are `@theme inline` and **not** emitted as standalone
  vars). So radius probes via the token's **manifest `utilities`** (`["rounded-sm","rounded-md","rounded-lg",
  "rounded-xl"]`) — apply each class, read `border-radius`; all four computed px map back to the single
  `--radius` token. (These classes are emitted — `/design-system` renders the radius steps; see the
  compiled-CSS note.)

**Colours** are canonicalized through **culori** (parse → round in a fixed space, e.g. `formatRgb` rounded) so
the two *computed* strings compare reliably across serialization differences. culori is applied to **computed**
values on both sides — **not** to authored tokens **[R: correctness-B2]**.

**Group → element-property source of truth [R: architecture-B1].** Do **not** hardcode a `property →
token-prefix` map. Iterate the manifest tokens (each carries `group` — the generated single source); a small
**closed, exhaustively-guarded `GROUP_PROPERTY` table keyed on `TokenGroup`** (beside `lib/editor/control-map.ts`)
maps the in-scope groups to the **element** properties to read+match: `color → ["background-color","color"]`,
`radius → ["border-radius"]`, `fontSize → ["font-size"]`, `fontFamily → ["font-family"]`,
`shadow → ["box-shadow"]`. Groups absent from the table (spacing, duration, zIndex, borderWidth, …) are not
probed — the scope boundary, in one place. **Note:** `border-color`/`outline-color`/ring are deliberately
**not** read (outside the user's 6 properties); a `--border`/`--ring`/`--input` colour token is still indexed
under `color`, so it surfaces only as an incidental value-collision if its colour equals an element's
background/text — harmless and honest under option A.

**Documented no-match cases (honest; no fuzzy/nearest matching) [R: correctness-B2/S6/S7]:**
- a computed colour with alpha < 1 / `transparent` / `rgba(0,0,0,0)` (the default bg of most elements) →
  skip, no match (don't round zero-alpha into a near-black token);
- `box-shadow: none`, inherited default font where nothing token-backed applies → skip;
- `border-radius`: read the **four per-corner** values (`borderTopLeftRadius`…); only match when all four are
  equal (a single shorthand). `rounded-full` (9999px) and `rounded-none` (0px) are literals, **not**
  `--radius`-backed → no match (note: `radius-sm`/`md` clamp to 0 at small knob values and may collide with
  `none` — collision listing covers it, but a literal 0 with no radius token present is a no-match).

**Compiled-CSS dependency [R: correctness-N3].** A probed utility only styles the probe if Tailwind emitted
it. The editor runs over `/design-system`, which renders **every** token with its utility (M3), so all probed
classes are present. Documented assumption; if pick-anywhere is later used on a sparser dev page, a safelist of
the probed utilities is the fix. Out of scope for v1.

---

## 1. Module boundaries [R: architecture-B2 — pure/DOM split at the right line]

Mirror the established `oklch.ts ↔ color-oklch.tsx` / `bezier.ts ↔ easing-field.tsx` boundary (lib = pure,
framework- and DOM-free):

- **`lib/editor/resolve-token.ts` — PURE.** `resolveMatches(elementValues, tokenIndex): Match[]` where
  `Match = { property: CssProperty; group: TokenGroup; value: string; tokens: string[] }`. Inputs are plain
  data (the element's canonical computed values + the token index). No DOM, no `getComputedStyle`. Also holds
  the `GROUP_PROPERTY` table + a `canonicalize(property, raw)` helper (culori for colours, trim/normalize for
  the rest — pure string/number ops). Unit-testable exactly like `oklch.ts`.
- **`lib/editor/use-probe-index.ts` — the DOM side (a hook, matching `use-draft-field.ts`/
  `use-token-writeback.ts`/`pin-scroll.ts`).** Builds + memoizes the token index by probing (the only
  `getComputedStyle`/DOM code). Re-probes when the editing block changes. Exposes
  `readElementValues(el): elementValues` for the click handler. **[R: a DOM probe named `resolve-token.ts`
  broke the boundary the design claimed to follow.]**
- **`lib/editor/use-hover-rect.ts` — extracted shared hook [R: architecture-S1 / DRY].** The hover/rect/
  scroll-reposition logic in `highlight-overlay.tsx` (the cohesive `useEffect` at lines 33-114, whose comments
  document a real ~10-20px scroll-lag fix) is lifted to `useHoverRect({ active, match, onPick })` returning
  `{ box, boxRef }`, parameterized by the match predicate (`el => el.closest("[data-token]")` vs `el => el`)
  and the click action. **Both** overlays become thin renderers — no 80-line copy. `highlight-overlay.tsx` is
  refactored onto it (guarded by the existing tests; behavior unchanged).

---

## 2. Components & provider

- **`components/editor/pick-overlay.tsx`** — uses `useHoverRect({ active: enabled && pickMode, match: el => el,
  onPick })`. On pick: `readElementValues(el)` → `resolveMatches(...)` → set local popover state
  `{ anchor: {x,y}, matches }`. Renders `<PickMenu>`. The highlight uses a **distinct** treatment (`--ed-warn`
  border + `cursor: crosshair` on the page) so pick mode is visibly different from normal hover
  **[R: ux-S3]**.
- **`components/editor/pick-menu.tsx`** — the popover. `role="menu"`; rows grouped by property
  (human labels: "background", "text colour", "border radius", "font size", "font family", "box shadow"),
  each listing its matching token(s) with a colour **swatch reusing the `.ed-reuse-swatch` markup**
  (`color-oklch.tsx:343-355`) for colour rows **[R: architecture-N1]**. Row = `<button role="menuitem">`;
  click → `select(token)` then close + clear highlight + **exit pick mode** (§3). Empty state names the why:
  "No design token drives this element (hardcoded or off-token value)" **[R: ux-N1]**.
  - **a11y [R: ux-S4]:** focus moves into the menu on open, restores to the eyedropper toggle on close;
    Arrow/Home/End move between items, Enter activates, Escape closes. Pointer-only *entry* (hover-to-pick) is
    the accepted stance (the bezier "pointer handles + keyboard via other controls" precedent); the popover
    itself is fully keyboard-operable.
  - **positioning [R: ux-S5]:** anchored at the click point, **clamped to the viewport** accounting for the
    312px docked panel (`editor-chrome.css` panel width); **closes on scroll** (a momentary disambiguation
    step — pinning at a stale point is worse than dismissing).
- **`components/editor/editor-provider.tsx`** — add `pickMode: boolean` + `togglePickMode()`
  **[R: architecture-S2 / ux-S2]:**
  - `pickMode` **implies `enabled`** and is **mutually exclusive with the normal hover**: the normal
    `HighlightOverlay` runs when `enabled && !pickMode`, `PickOverlay` when `enabled && pickMode`.
  - `disable()` also clears `pickMode` (no stale pick state resurfacing on re-enable).
  - the popover's transient `{ anchor, matches }` lives **in `pick-overlay`, NOT the provider** (keeps the big
    context `useMemo` from churning all consumers on every hover/click).
- **`components/editor/panel-toolbar.tsx`** — add an **eyedropper toggle** as an `.ed-iconbtn`
  (`Dropper` icon from `@untitled-ui/icons-react`), `aria-pressed={pickMode}` / `aria-label="Pick token from
  element"`, beside the existing icon buttons — **not** a second floating `.ed-toggle` **[R: architecture-S3]**.
- **`components/editor/editor-mount.tsx`** — mount `<PickOverlay/>` inside `EditorShell` (beside
  `HighlightOverlay`) so it tree-shakes out of prod with the island. Add **Escape** handling:
  document-level, layered — Escape closes the popover if open, else exits pick mode **[R: ux-S3]**. (Mirrors
  the existing `⌘Z` keydown effect there.)
- **CSS:** `.ed-pick-*` in `editor-chrome.css` (the `--ed-*` namespace, excluded from `npm run check`).

---

## 3. Interaction flow & native-event suppression [R: ux-S1]

Pick mode targets **real interactive elements** (buttons, links, inputs in the showcase). A click must
resolve, never fire the element's native action or steal focus/scroll. The overlay binds **capture-phase**:
- `pointerdown` → `preventDefault()` + `stopPropagation()` (suppresses native activation **and** focus-steal,
  which also avoids the page's scroll-into-view excursion the editor already fights);
- `click` and `submit` → swallowed too (belt-and-suspenders for keyboard/label-driven activation).

Flow: toggle eyedropper → page cursor `crosshair`, normal hover suspended → hover highlights any element
(`--ed-warn`) → click → resolve → popover. Click a row → `select(token)` opens it in the docked panel; popover
closes, highlight clears, **pick mode auto-exits** so the next pointer move doesn't re-arm a highlight over the
element whose live preview you're now watching **[R: ux-S6 — preserves the reason panel-handoff was chosen]**.
Resolution reads the **live-rendered theme**; `select` opens in the current `editingBlock` (consistent —
`editor-provider.tsx:192-206`).

---

## 4. Documented limitations / non-goals

- **Nested children resolve the clicked element only [R: ux-N3].** Clicking a button's inner text/icon span
  resolves *that* node's computed properties — the button's `background-color` won't appear if you clicked the
  span (a span has no bg). This is the eyedropper mental model; a parent-climb affordance (Alt-click /
  breadcrumb) is deferred. Documented, not built.
- **Alpha-modified colours don't exact-match** any token (they're `color-mix` results) → no match, by design.
- **Smart-ranking of collisions (option C)** and **inline-edit-in-popover** — both explicitly deferred (user
  decisions): collisions list all; editing happens in the docked panel.
- **Dark-block write limitation** (light-only tokens error on dark write) is the pre-existing, editor-wide
  seam noted for the bezier work — unrelated to and unaffected by pick-anywhere.
- **No spacing / font-weight** resolution (user-scoped to the 6 properties).

---

## 5. Testing

**`tests/editor/resolve-token.test.ts`** (pure, fast):
- `resolveMatches`: single match; **collision** (one value → multiple tokens, all listed); multiple properties
  on one element grouped correctly; **no-match** → empty; alpha/`transparent`/`none` inputs skipped;
  `border-radius` only matches when the four corners are equal; the `GROUP_PROPERTY` table is exhaustive over
  the in-scope groups (a guard test, cf. the `control-map`/`utilitiesForToken` exhaustiveness guards).
- `canonicalize`: two different computed colour serializations of the same colour canonicalize equal (culori);
  zero-alpha is rejected.
- **Honest scope [R: correctness-S4]:** unit tests cover the **matching algorithm only** with injected value
  indexes. Real value-fidelity (rgb/oklch/alpha/hashed-font/shadow serialization) **cannot** be tested in
  jsdom (no real computed styles / `var()` / `calc()`) and is covered by e2e.

**`tests/editor/use-hover-rect.test.tsx`** — the extracted hook: highlights on hover of a matching element,
clears on leave, calls `onPick` on click; parameterized match predicate works for both `[data-token]` and
`el => el`. (Keeps the refactor of `highlight-overlay` honest — its existing tests must still pass unchanged.)

**`e2e/pick-anywhere.spec.ts`** (the real fidelity gate, Playwright on `/design-system`):
- enable editor → toggle eyedropper → click a showcase **Button** → popover lists `background → --primary` (+
  `text colour → --primary-foreground`); click the row → panel opens `--primary`, pick mode exits.
- click a **Card** surface → the neutral **collision** (several tokens) is listed.
- click an element with a hardcoded/off-token value → "No design token drives this element".
- Escape closes the popover; a second Escape exits pick mode; native button action does **not** fire on a pick
  click (assert no navigation/side-effect).
- restore `app/globals.css` in a `finally` if any test commits an edit (per the editor e2e convention).

**Visual checkpoint:** throwaway Playwright shots into `e2e/__shots__/` (gitignored) — the pick highlight
(crosshair + `--ed-warn`) and the popover (collision list with swatches). `Read` to self-critique vs
`docs/DESIGN-BRIEF.md`; **the user reviews before done**.

---

## 6. Out-of-scope (YAGNI)
No spacing/font-weight/duration/z-index resolution, no parent-climb, no smart-ranking, no inline-edit, no
multi-element/marquee, no "copy token name", no pick history.
