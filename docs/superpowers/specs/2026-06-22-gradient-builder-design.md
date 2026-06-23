# Gradient builder + named gradient tokens (editor) — design

**Date:** 2026-06-22
**Status:** Design approved (brainstorm, 3-agent reviewed), pre-plan
**Milestone:** M4 editor fast-follow — "gradient builder" (HANDOFF M4 list). This is the *heavier* of the two
remaining builders: unlike the shadow builder (which edits an existing `--elevation-*` text token), no gradient
token group exists yet, so this introduces one.
**Depends on:** M4 (the dev-only editor, `components/editor/*`, `lib/editor/*`), the token write-core
(`lib/tokens/{parse,schema,validate,write,sync,generate,utilities}.ts`), the manifest/sections render
(`lib/design-system/sections.ts`, `components/design-system/*`), the writeback/preview model
(`lib/editor/use-token-writeback.ts`, `editor-provider.tsx`), the draft-field convention
(`lib/editor/use-draft-field.ts`). Mirrors the **bezier editor** (`lib/editor/bezier.ts` ↔
`components/editor/controls/easing-field.tsx`) as the house pure-lib + thin-view pattern.

> **What it does:** makes **gradients first-class design-system tokens.** Introduces a new `gradient` token
> group (`--gradient-*`), seeds it with 4 real gradients, renders them on `/design-system`, exposes them to
> consumers via hand-written `@utility bg-gradient-*` classes, and adds a **visual gradient builder** control to
> the dev-only editor: live preview → type tabs (linear / radial) → geometry (angle for linear; shape + 2D
> position pad for radial) → a stops ramp with draggable swatch handles + precise per-stop rows (token-color +
> alpha + position) → a raw-value escape-hatch. It edits a `--gradient-*` token, emits a normalised
> `linear-gradient(...)` / `radial-gradient(...)` string through the existing `onChange`→`editValue` path, and
> changes nothing in the provider/preview/writeback contract.

3-agent review (correctness / DRY-architecture / UX-a11y-scope) reshaped this design; changes from the first
draft are called out inline as **[R: …]**. The headline review outcomes: the "auto-generate utilities via
`sync.ts`" premise was **false** and is dropped (§3); "reuse the color-oklch swatch picker" was **false** (no
alpha, emits literals not `var()`) and the stop picker is net-new (§4.4); the touch-point set was **under-counted
by 4 files** that hard-break the build or every save (§2); **conic was cut** and **seeds trimmed 5→4** on YAGNI
(§7); every draggable gets a **numeric/keyboard twin** (§4); the dark-block write-error is **pre-empted with a
disabled state** (§5).

**Locked scope decisions (from brainstorm):** named gradient tokens (not an ad-hoc className composer);
**linear + radial only** (no conic); stops are **token-ref color + alpha (0–100) + a `transparent` option**;
**4 seeds** (subtle / brand / glow / fade); ramp handles are **square chips under the ramp**; radial center is a
**draggable 2D pad** (user kept it over the reviewer's preset-positions suggestion — it therefore carries the
full a11y-twin cost, §4.3).

---

## 0. Architecture — pure lib + thin view [R: DRY]

Mirror `lib/editor/bezier.ts` ↔ `easing-field.tsx`: all parse/format/clamp/model math is pure and lives in a new
lib; the control is a thin React/SVG view. **One emit funnel**: `formatGradient(model) → onChange(string)`,
shared by every sub-control (type tabs, angle, pad, stop edits, presets-none), mirroring how `color-oklch` and
`easing-field` route all inputs through a single `format* → onChange`.

- **New `lib/editor/gradient.ts`** (pure, client-safe, no React, no `culori`, no Node — the testable core):
  - Model:
    ```ts
    type GradientType = "linear" | "radial";
    type Stop = { color: string; alpha: number; position: number };
    //   color: a token name "--brand-500" | the literal "transparent"; alpha 0–100; position 0–100
    type Gradient =
      | { type: "linear"; angle: number; stops: Stop[] }
      | { type: "radial"; shape: "circle" | "ellipse"; cx: number; cy: number; stops: Stop[] };
    ```
  - `parseGradient(value: string): Gradient | null` — parses `linear-gradient(<angle>deg, <stops>)` and
    `radial-gradient(<shape> at <cx>% <cy>%, <stops>)` back into the model so the builder hydrates from the
    token's current value. **Splits the stop list at depth-0 commas only** (paren-depth tracked) so a
    `color-mix(in oklch, var(--x) 45%, transparent)` stop is not shattered by its inner commas.
    **[R: correctness — naive `.split(",")` breaks on `color-mix`/`circle at x y`; the variadic stop list means
    the single-anchored-regex trick from `bezier.ts` does not transfer.]** Each stop is parsed as
    `var(--name)` → `{color:"--name", alpha:100}`, `color-mix(in oklch, var(--name) N%, transparent)` →
    `{color:"--name", alpha:N}`, or bare `transparent` → `{color:"transparent", alpha:0}`, with a trailing
    `<position>%`. Returns **`null`** for anything it can't model (conic, raw colors, gradients with non-token
    stops, unparseable) — the control treats `null` as "not visually editable" and falls to the raw row (§4.6),
    exactly as `bezier.ts` returns `null` for `steps()`/`var()`.
  - `formatGradient(g: Gradient): string` — emits canonical CSS. A stop renders `var(--name)` at `alpha===100`,
    `color-mix(in oklch, var(--name) <N>%, transparent)` for `0 < alpha < 100`, and bare `transparent` for the
    `transparent` color (or `alpha===0`). Linear: `linear-gradient(<angle>deg, <stop> <pos>%, …)`. Radial:
    `radial-gradient(<shape> at <cx>% <cy>%, <stop> <pos>%, …)`. The gradient module **never does color math** —
    a stop color stays a string; alpha is encoded only as the `color-mix(...,transparent)` wrapper, a shape the
    gate already understands (`isColorValue`/`checkGroup`/`canonicalize` all accept `color-mix`).
    **[R: DRY — do NOT pull `parseOklch`/`formatOklch` into gradient.ts; that re-implements color logic and is
    the file's real SRP risk, not the 2 variants.]**
  - **Numeric rounding** via `round(n) = Math.round(n * 100) / 100` (2dp, trailing zeros dropped) — copied from
    `oklch.ts`/`bezier.ts`, **NOT** `toFixed`. **[R: correctness — `toFixed` emits `0.20`, differing from the
    file's `0.2`, defeating the `editValue` no-op guard and `manifest-fresh`.]**
  - Clamp helpers: `clampAngle ∈ [0,360]`, `clampPct ∈ [0,100]` (alpha, position, cx, cy). Exported for view +
    tests. **The value validator must not be the only guard** — `validate.ts` accepts any `*-gradient(.+)`
    string, so an out-of-range value would pass the API + `npm run check` and land an invalid gradient; the clamp
    is the guard and is tested. **[R: correctness — same hole bezier flagged at `validate.ts`.]**
  - File stays a single `lib/editor/gradient.ts` (one import surface, matching `bezier.ts`/`oklch.ts` naming),
    **sectioned internally** model → parse → format → clamp; split into files only if it crosses ~250 lines.
    **[R: DRY — bezier is 79 lines for one curve; 2 gradient variants + variadic stops is realistically
    150–250, past bezier but still one cohesive value-type.]**
- **New `components/editor/controls/gradient-builder.tsx`** — the thin view, props
  `{ token: string; value: string; onChange: (v: string) => void; tokens: ManifestToken[] }` (same shape as the
  other controls). New CSS in `components/editor/editor-chrome.css`, `--ed-*` namespace (excluded from
  `npm run check`), prefixed `.ed-gradient-*` per the per-control convention.

**Client-safety / bundle:** the whole tree stays inside the dev-only editor island (`components/editor/**`,
tree-shaken from prod via `EditorMount`). The one DOM read (`getBoundingClientRect()` for the pad/ramp geometry)
stays in the **component**; coordinate helpers are pure and take `geom` as a param (unit-testable without a DOM),
the bezier `toSvg`/`fromSvg` pattern.

---

## 1. Single source of truth + transient drag buffer [R: DRY / correctness]

The control is **stateless about the gradient except during an active drag.** Every render derives from `value`:
`const parsed = parseGradient(value)`. The **one** transient local state is a gesture buffer:

```
const [drag, setDrag] = useState<Gradient | null>(null); // non-null only mid-gesture
const display: Gradient = drag ?? parsed ?? FALLBACK;     // what the UI renders
```

`drag` is committed and cleared on `pointerup` (§2). When not dragging, the control re-derives from `value`, so
undo/redo, reset, and block-switch (all change `value` from outside) move the handles automatically — no re-seed
effect. `FALLBACK` (used only when `parsed === null`) is a minimal valid 2-stop linear gradient rendered
**dimmed** with a "not visually editable" note (§4.6); the raw row shows the real string. **No live CSS read.**

---

## 2. Commit cadence: drag once on release; discrete edits once each [R: P0 — history flooding]

`editValue` pushes **one** undo-history entry per call; the writeback debounce coalesces only the network POST,
not history. So a live-`onChange`-per-pointer-move drag floods undo. Therefore:

- **Drags** (ramp handle position, angle dial, 2D pad): `pointerdown` seeds `drag` from `display` +
  `setPointerCapture`; `pointermove` maps→clamps→`setDrag(next)` with **no `onChange`** (the preview swatch +
  numeric twins re-render from `drag` — in-control feedback only); `pointerup`/`pointercancel`
  `onChange(formatGradient(drag))` **once**, then `setDrag(null)`. One history entry, one debounced write.
  **[R: same single change that fixed bezier's history-flood + preview-strobe + dark-block-error frequency.]**
- **Discrete edits** (numeric input commit on blur/Enter, add/remove stop, type-tab switch, shape switch,
  transparent toggle) each call `onChange` **once** — one history entry each, as today. Unlike a drag, these are
  not coalesced (an add-stop is a discrete intent).

Unlike easing (transitions have no static appearance), a gradient **does** have a meaningful static preview, so
the live page-var preview on commit is genuinely useful here — but still only on commit, not per-move.

---

## 3. Token-group plumbing + utility wiring — the COMPLETE touch-point set [R: correctness/DRY — under-counted by 4]

Adding a `gradient` group is a **bounded but larger** edit than the first draft claimed. Every exhaustive
`Record<TokenGroup, …>` / `switch (group)` site must be updated; the starred ones were **missing from the first
draft** and are functional breakages, not placement nits.

| # | File | Change | If omitted |
|---|---|---|---|
| 1 | `lib/tokens/types.ts` | add `"gradient"` to `TokenGroup` | every map below = TS error |
| 2 | `lib/tokens/schema.ts` `groupForName` | add `if (/^gradient-/.test(bare)) return "gradient";` in the **prefix block** (before the value fallback) | **`parseTokens` THROWS** on the first seed → `npm run tokens`, `npm run check`, AND the editor write route all crash. **[R: B1 — the value fallback only accepts color/`var()`; a `linear-gradient(...)` value is neither → `throw "unknown token"`. The rule is mandatory, not a follow-up.]** Ordering vs other prefixes is safe (no rule is a prefix of `gradient-`). |
| 3 | `lib/tokens/schema.ts` `CONTROL` | `gradient: "text"`-class entry (the strict `ControlType`) | `Record<TokenGroup,ControlType>` TS error |
| 4 | `lib/editor/control-map.ts` | add `"gradient"` to `CONTROL_KINDS` + `MAP.gradient = "gradient"` | `Record<TokenGroup,ControlKind>` TS error |
| 5 | `lib/design-system/sections.ts` | `ORDER` (after `color`) + `TITLES.gradient = "Gradient"` | `Record<TokenGroup,string>` TS error |
| 6 | `lib/tokens/utilities.ts` `utilitiesForToken` | `case "gradient": return { utilities: ["bg-gradient-" + bare.replace(/^gradient-/, "")] }` | **HARD BUILD/RUNTIME THROW** — the switch has a `const _never: never = t.group` guard, so `buildManifest` throws for every gradient token. **[R: M1 — missing from first draft.]** |
| 7 | `lib/tokens/generate.ts` `GROUP_ORDER` | add `"gradient"` (after `color`) | silent: `indexOf` = −1 sorts gradient to the top of the manifest. **[R: missed.]** |
| 8 | `lib/tokens/validate.ts` `checkGroup` | `case "gradient": return v.length > 0;` (like shadow) | **every gradient save REJECTED** — no `default`, a missing case returns `undefined`→falsy→`validateValue` throws "invalid value"; the writeback POST 400s. **[R: missed — functional breakage.]** |
| 9 | `components/editor/controls/control-host.tsx` | `case "gradient": return <GradientBuilder … />` **+ add a `const _never: never = kind` exhaustiveness guard** to the switch | without the case: **silent blank panel** (switch has no default → returns `undefined`). The `never` guard converts future omissions into build errors, matching `utilities.ts`. **[R: DRY — the host switch is the one unguarded exhaustive switch; harden it here.]** |
| 10 | `components/design-system/token-item.tsx` `preview()` | `case "gradient": return box({ background: v })` (a `size-12` swatch backed by `var(--gradient-x)`) | non-fatal: the `default` renders a generic box (no crash), but the swatch is wrong. `data-token` tagging is generic → click-to-edit + e2e tagging come free. |

`components/design-system/token-section.tsx` `SectionBody` needs **no** change — the default `TokenItem` grid is
fine for gradients (no custom body like ColorBody/TypeBody). `resolve-token.ts`/`use-probe-index.ts`
(pick-anywhere reverse-resolution) are `Partial<Record<…>>` → gradient is **opt-in and out of scope** (we do not
make pick-anywhere reverse-match `background-image`).

### Utility wiring — hand-written, NOT sync-generated [R: correctness/DRY — the auto-gen premise was false]

The first draft's "extend `sync.ts` to auto-generate `@utility bg-gradient-*`" is **dropped.** Verified:
`syncThemeMappings` only locates the `@theme inline` at-rule and appends decls **inside it** — it has no concept
of top-level `@utility` blocks, has a hard-closed allowlist with an explicit "DO NOT add a default throw" /
"only the 4 groups below" contract, and **no delete path** (only ever adds). The existing
`@utility border-*/z-*/opacity-*` blocks (`globals.css:271-282`) are **hand-authored**; nothing generates them.

**Decision:** **hand-write the 4 `@utility bg-gradient-*` blocks** in `globals.css` alongside the
border/z/opacity utilities — the exact existing precedent for "not a Tailwind namespace → expose as a utility":

```css
@utility bg-gradient-subtle { background-image: var(--gradient-subtle); }
@utility bg-gradient-brand  { background-image: var(--gradient-brand); }
@utility bg-gradient-glow   { background-image: var(--gradient-glow); }
@utility bg-gradient-fade   { background-image: var(--gradient-fade); }
```

Gradients are **NOT added to `@theme inline`** (background-image is not a Tailwind v4 theme namespace). The
extension procedure for gradients is therefore "add `--gradient-x` to `:root` **and** add one `@utility` line" —
one step more than color, but **identical to how borderWidth/zIndex/opacity already work.** A future fast-follow
could auto-generate these via a *separate* `syncGradientUtilities(css)` module (a managed top-level region
regenerated each `npm run tokens`, which makes delete/rename free) wired into `regenerate.ts` and feeding
`SyncResult.changed` so `manifest-fresh` catches drift — **explicitly out of scope here** to avoid bolting
delete-aware codegen onto `syncThemeMappings`. **[R: B2 / DRY-5.]**

### Seed tokens (`:root` only — themes for free via token-ref stops)

```css
--gradient-subtle: linear-gradient(180deg, var(--brand-50), var(--card));
--gradient-brand:  linear-gradient(135deg, var(--brand-500), var(--brand-600));
--gradient-glow:   radial-gradient(circle at 50% 30%, color-mix(in oklch, var(--brand-500) 45%, transparent), transparent 70%);
--gradient-fade:   linear-gradient(180deg, var(--brand-500), transparent);
```

Stops reference color tokens, so each gradient **themes automatically** in dark mode via its referenced colors —
the gradient value lives only in `:root`, with **no `.dark` counterpart** (and `both-theme` correctly ignores it,
§6). The manifest entry is `{name, group:"gradient", values:{light}, utilities:["bg-gradient-x"]}`.

---

## 4. The control's pieces

The panel renders, top to bottom:

1. **Live preview** — a large swatch (as tall/wide as the 312px panel allows, not a tiny square) backed by the
   **live edited value**. **[R: UX-6 — a small swatch under-sells radial falloff vs the real full-bleed usage; a
   caption notes geometry reads differently at full-bleed.]**
2. **Type tabs** — `role="radiogroup"` with two `role="radio"` options (**Linear / Radial**), arrow-key
   navigable, each with an accessible name; **not plain divs.** **[R: UX-2 — the codebase idiom for a toggle is a
   real control with roles/`aria-pressed`, cf. `panel-toolbar.tsx`.]** Switching type maps the current stops onto
   the new type with sensible geometry defaults (linear `angle:180`; radial `circle`, `cx:50, cy:50`) and emits
   once.
3. **Geometry block** (depends on type):
   - **Linear → angle.** A numeric `angle` input (`type="number"`, `aria-label="{token} angle"`, `0–360`, commit
     on blur/Enter via `useDraftField`) **paired with** a small visual dial that is **`aria-hidden`** and
     pointer-only (drag per §2). The numeric input is the keyboard/a11y path. (A native `<input type="range">`
     is an acceptable simpler substitute for the dial — decide in planning; either way the numeric path exists.)
   - **Radial → shape + center.** A shape `select` (`circle`/`ellipse`, the existing `.ed-row select` idiom) +
     a **2D position pad**: an SVG square the user drags to set `cx`/`cy`. The pad SVG is **`aria-hidden`**; its
     keyboard/a11y twin is **two numeric inputs** `position x` / `position y` (`aria-label="{token} position
     x/y"`, `0–100`, `useDraftField`). **[R: UX-1 — a drag-only control fails the tested a11y contract
     (`easing-field.test.tsx:116`); every draggable needs a labelled numeric twin with the SVG aria-hidden. The
     user kept the pad over preset-positions, so it carries this full cost.]**
4. **Stops.** A horizontal **ramp bar** showing the current gradient with **square swatch-chip handles under it**
   (each chip shows the stop's resolved color; `transparent` = checkerboard). Handles are **`aria-hidden`**,
   pointer-drag sets position (§2). Below the ramp, **precise per-stop rows** (the keyboard/a11y path — each row
   fully operable without the ramp):
   - a **stop color picker** (§4.4) — token swatch + `transparent` chip + an alpha slider,
   - a **position** numeric input (`aria-label="{token} stop {n} position"`, `0–100`, `useDraftField`),
   - a **remove** `<button type="button" aria-label="Remove stop {n}">` (glyph `aria-hidden`); disabled when only
     2 stops remain (§4.7),
   - an **"+ Add stop"** button (inserts a stop at the midpoint of the largest gap, emits once).
5. **Raw-value escape-hatch row** — a single validated text input (`useDraftField` commit on blur/Enter) with a
   `RAW_VALID` regex (`/^(linear|radial|conic)-gradient\(.+\)$/`, plus `var(...)`), the **only** way to author or
   repair a value the builder can't model (a pasted `conic-gradient(...)`, raw-color stops, exotic syntax). A
   broken paste is rejected on Enter, not written. **[R: UX-7 / correctness — this is where cut-conic and the
   long tail live; dropping it would be a capability regression.]**

### 4.4 Stop color picker — net-new, NOT a reuse of color-oklch [R: DRY-2 — the plan's biggest false claim]

`color-oklch.tsx` is **not reusable as-is**: it has **no alpha** (`Lch = {l,c,h}`, `formatOklch` emits no alpha
channel), its "reuse a token" swatch strip is **inline JSX** hard-filtered to `group==="color"` and **emits the
token's resolved literal value, not a `var(--name)` reference** (the wrong output contract for a stop), and it is
entangled with the contrast machinery (`partnerOf`/`nearestPassingL`/`BlockReport`). So the stop picker is
**purpose-built**: a token swatch grid that emits `{color:"--name"}`, a **`transparent`** chip, and an **alpha**
slider (`0–100`, reusing the `opacity-slider` idiom). It must emit the **token name** (→ `var(--name)` /
`color-mix(...,transparent)` at format time), never a resolved literal, so the gradient themes. During planning,
evaluate extracting the **pick-menu swatch grid** (`components/editor/pick-menu.tsx`, from pick-anywhere) as the
shared grid source — it already renders a token swatch grid and is a closer fit than `color-oklch`. **Do not bill
this as free reuse.**

### Reuse that IS real

`useDraftField` (every numeric/raw input — commit-on-blur/Enter, Escape-revert, re-seed, `pinScroll`),
`useTokenWriteback` (group-agnostic live `var()` preview + rollback — gradient gets optimistic preview for free),
the `color-mix(...,transparent)` encoding (the gate already understands it — no new alpha encoding), and the
`.ed-sr-only` + `aria-live="polite"` announcer idiom (`save-state.tsx:31`, `color-oklch.tsx:335`) for any
validity announcement (announce **on transition only**, never per drag-frame). Restore focus rings: `.ed-row
input` is `all: unset`, so the new numeric inputs need the `:focus-visible` outline the bezier inputs re-add
(`editor-chrome.css`).

---

## 5. Dark-block: pre-empt the write error, don't let it fire [R: UX-5 — real UX bug, not just a wart]

Gradient tokens are `:root`-only. Writing a token absent from the active block's selector throws
`token --gradient-x not found in .dark` (`write.ts:36`) → API 400 → writeback `rollback` → a **red developer
error in the aria-live save-state** — *after* the user has dragged and seen the preview move. Least-surprise
fix: when `editingBlock === "dark"` and a `:root`-only gradient is selected, render the builder
**disabled/greyed with an inline message** ("Gradients are theme-independent — switch to the Light block to
edit") **before** the user touches anything, mirroring `color-oklch.tsx:329-331`'s "switch to {theme} to fix"
precedent. The provider already exposes `editingBlock`; the switch chip is in `panel-toolbar.tsx`. **Do not let
the error path be the discovery mechanism.** (The underlying light-only-token limitation is editor-wide and
out of scope to fix; this is just the per-control courtesy.)

---

## 6. Gate safety — verified clean for gradients (no new gate work) [R: correctness/DRY — confirmed against real check code]

- **`both-theme`** filters to `isColorValue(value)`; a gradient string returns `false`, so `:root`-only
  gradients are **excluded from the color-pair set** — no "missing dark counterpart" failure.
- **`contrast`** pairs only via `partnerOf` (base ↔ `-foreground`); a `--gradient-*` has no such partner →
  never paired; `measurable()` also skips `color-mix`/alpha anyway.
- **`hardcoded-color`** scans source `app`/`components`, **excludes `globals.css`**, and matches hex/`rgb(`/named
  keywords — gradient values use `var()`/`color-mix`/`transparent`/`*-gradient(` and aren't scanned regardless.
- **`arbitrary-tailwind` / `off-token-scale`** — `bg-gradient-*` has no `-[…]` bracket and isn't a guarded scale
  family (radius/shadow/text/font-weight only). The native `bg-gradient-to-b from-brand-50 to-card` already
  passes on `/pricing`.
- **write route injection screen** (`validate.ts` `INJECTION = /[;{}]|\/\*|\*\//`) — all 4 seed values (incl.
  nested `color-mix` and `radial-gradient(circle at …)`) pass; `writeToken` (`decl.value = value` via postcss)
  preserves multi-comma values exactly.

The only `validate.ts` change is the **`checkGroup` case** (§3 #8) — that's value-shape validation, not a gate
rule. A `tests/check/` pass asserting the seeds keep `npm run check` green is still added (§7) as a regression
guard. **NB:** the exhaustive-`Record`/`never`-guard breakages (§3 #2,3,4,5,6,8,9) are caught by **`tsc` via
`npm run verify`**, *not* by `npm run check` (which skips type-check) — `npm run verify` is the real safety net,
per the standing pre-merge rule.

---

## 7. Testing

**`tests/editor/gradient.test.ts`** (pure, fast — the testable core):
- `parseGradient`: linear (`angle`, multi-stop), radial (`circle`/`ellipse` + `at x% y%`); a stop with
  `color-mix(in oklch, var(--x) 45%, transparent)` is parsed without comma-shatter (depth-0 split); bare
  `transparent` stop; `conic-gradient(...)`/raw-color stop/garbage → **`null`**.
- `formatGradient`: `alpha===100` → `var(--x)`; `0<alpha<100` → `color-mix(...,transparent)`; transparent → bare;
  `parseGradient(formatGradient(g)) ≈ g` round-trip for both types; the 4 seed values format back to their exact
  globals strings (2dp **numeric** rounding, no `0.20` drift → `manifest-fresh` safe).
- `clampAngle ∈ [0,360]`, `clampPct ∈ [0,100]`; pad/ramp coordinate helpers: known SVG point ↔ known
  cx/cy/position (the validator won't catch an out-of-range regression — §0).

**`tests/editor/gradient-builder.test.tsx`** (`// @vitest-environment jsdom`):
- renders preview, the two type radios, geometry (angle input for linear; shape select + pad + x/y inputs for
  radial), the ramp, ≥2 stop rows, the add/remove buttons, the raw row.
- pointer drag (ramp handle / angle dial / pad, mocking `getBoundingClientRect` + pointer capture): emits **one**
  `onChange` with a normalised, clamped value, and **nothing** mid-move.
- numeric inputs (angle / position / x / y): don't emit while typing; commit a merged value on blur and Enter;
  reject out-of-range; revert on Escape.
- add stop → one `onChange` with an extra stop; remove stop → one `onChange`; remove disabled at 2 stops.
- type switch linear↔radial emits a valid value with default geometry; transparent chip + alpha slider produce
  the `color-mix`/bare-`transparent` encodings.
- a `conic-gradient(...)` / raw-color value: renders the dimmed fallback + the raw string in the raw row, emits
  **nothing** on mount; raw-row commit of a valid value emits it.
- re-seed: changing `value` (block-switch/undo) updates the UI with no stale draft.
- **dark-block disabled state**: with `editingBlock==="dark"` and a `:root`-only gradient, the builder renders
  disabled + the "switch to Light" message and emits nothing on interaction.
- a11y: every numeric/raw input + the remove buttons have accessible names; the dial/pad/ramp SVGs +
  swatch chips are `aria-hidden`; type tabs are a radiogroup.

**`tests/editor/control-host.test.tsx`** — assert the `gradient` kind resolves `GradientBuilder` (+ the new
`never` guard compiles).

**`tests/check/` (or extend the dogfood self-pass)** — the 4 seeds + `@utility` blocks keep `npm run check`
green; `npm run tokens` is idempotent on them (manifest-fresh).

**`tests/tokens/`** — `groupForName("--gradient-x", "linear-gradient(...)")` → `"gradient"`;
`utilitiesForToken` → `["bg-gradient-x"]`; `parseTokens` over the seeded globals doesn't throw; the manifest
carries the 4 gradient tokens with the right group/utilities.

**`e2e/` (real computed gradient — jsdom can't compute `background-image`)** — `/design-system` renders a
`Gradient` section with 4 `data-token` swatches; selecting one opens the builder; a drag/edit updates the
computed `background-image`. Plus a **throwaway shot spec** into `e2e/__shots__/` (gitignored) of the builder
(linear resting, radial, mid-drag if feasible); `Read` the PNGs to self-critique against `docs/DESIGN-BRIEF.md`;
**the user reviews screenshots before this is called done** (function TDD'd; aesthetic human-checkpointed).

---

## 8. Non-goals / documented limitations

- **Conic gradients** — cut on YAGNI (the only seed using it was decorative; can't preview honestly at swatch
  scale; the raw row still accepts a pasted `conic-gradient(...)`, just not visually editable). **[R: UX-3.]**
- **Auto-generated `@utility` blocks** — out of scope; gradients are hand-wired like border/z/opacity (§3). A
  separate managed-region `syncGradientUtilities` module is a possible fast-follow.
- **Dark-block gradient edits** — disabled by design (§5); the underlying light-only-token write limitation is
  editor-wide and unfixed here.
- **pick-anywhere reverse-resolution of `background-image`** — opt-in `Partial<Record>`; not added.
- **Raw-color stops / per-theme gradient values** — not supported by the visual builder (stops are token-ref +
  alpha + transparent, so gradients theme for free and stay on-contract); raw values are editable only via the
  raw row.
- **Per-`(name,theme)` status** — inherited M4 limitation, unaffected.

---

## 9. Out-of-scope (YAGNI)

No conic, no gradient presets library, no import/export, no multi-color-space interpolation control (always
`in oklch`), no per-stop midpoint hints, no eyedropper, no animated gradients. Two types, token-anchored stops,
one control.
