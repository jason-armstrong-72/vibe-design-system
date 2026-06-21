# Bezier curve editor (editor) — design

**Date:** 2026-06-21
**Status:** Design approved (brainstorm, 3-agent reviewed), pre-plan
**Milestone:** M4 editor fast-follow — "draggable cubic-bezier curve editor (replaces the easing preset+text field)" (HANDOFF M4 list).
**Depends on:** M4 (the dev-only editor, `components/editor/*`, `lib/editor/*`), the writeback/preview model (`lib/editor/use-token-writeback.ts`, `editor-provider.tsx`), the draft-field convention (`lib/editor/use-draft-field.ts`).

> **What it does:** replaces the easing token control (a preset `<select>` + a validated `cubic-bezier()` text
> input) with a **draggable curve editor**: an SVG canvas with two draggable control handles, four numeric
> x/y inputs, clickable preset chips (the `--ease-*` tokens + CSS keywords), an animated preview, and a
> small raw-value escape-hatch row. It edits the same easing token, emits a normalised `cubic-bezier(...)`
> string through the existing `onChange`→`editValue` path, and changes nothing in the provider/preview/
> writeback contract.

3-agent review (correctness / DRY-architecture / UX-a11y-scope) reshaped this design; changes from the first
draft are called out inline as **[R: …]**.

---

## 0. Architecture — pure lib + thin view, no second state store [R: DRY]

Mirror the established `lib/editor/oklch.ts` ↔ `components/editor/controls/color-oklch.tsx` split: all
parse/format/clamp/keyword math is pure and lives in a new lib; the control is a thin SVG/React view.

- **New `lib/editor/bezier.ts`** (pure, client-safe, no React; the testable core):
  - `type Cubic = [number, number, number, number]` (`[x1, y1, x2, y2]`).
  - `parseBezier(value: string): Cubic | null` — parses `cubic-bezier(a, b, c, d)` (tolerant of arbitrary
    whitespace) and maps CSS keywords to their **exact spec** curves:
    `linear`→`[0,0,1,1]`, `ease`→`[0.25,0.1,0.25,1]`, `ease-in`→`[0.42,0,1,1]`,
    `ease-out`→`[0,0,0.58,1]`, `ease-in-out`→`[0.42,0,0.58,1]`. Returns `null` for `steps(...)`,
    `var(...)`, or anything unparseable (the control treats `null` as "not drawable" — §4).
  - `formatBezier(c: Cubic): string` → `cubic-bezier(x1, y1, x2, y2)`. **Numeric rounding** via
    `round(n) = Math.round(n * 100) / 100` (2dp, trailing zeros dropped), copied from `oklch.ts`'s
    `round` idiom — **NOT** `toFixed(2)`. **[R: correctness — `toFixed` emits `0.20`, which differs from
    the file's `0.2`, defeating the `editValue` no-op guard and the manifest-fresh check.]**
  - `clampX(n) ∈ [0, 1]` (CSS requires x1,x2 in range); `clampY(n) ∈ [Y_MIN, Y_MAX]` where
    `Y_MIN = -0.75`, `Y_MAX = 1.75` (overshoot/bounce; CSS allows y unbounded — we clamp to the padded
    canvas range, a deliberate UI limit). Constants exported for the view + tests.
- **`components/editor/controls/easing-field.tsx`** is rewritten in place. **The file name, the exported
  `EasingField`, and the `ControlKind` `"easing"` are unchanged** — `control-host.tsx`/`control-map.ts`
  are untouched. **[R: DRY — renaming to "bezier" churns the host for zero benefit and desyncs the
  component name from its kind; "bezier" lives only in the lib.]** Same props
  `{ token: string; value: string; onChange: (v: string) => void; tokens: ManifestToken[] }`.

**Client-safety / imports:** `bezier.ts` imports only types (no `culori`, no Node). `lib/editor → lib/tokens`
for `ManifestToken` is the existing arrow. The whole tree stays inside the dev-only editor island
(`components/editor/**`, tree-shaken from prod via `EditorMount`), so nothing leaks into the production
bundle. New CSS classes go in `components/editor/editor-chrome.css` (the `--ed-*` namespace, excluded from
`npm run check`), prefixed `.ed-bezier-*` to match the per-control `.ed-color-*`/`.ed-contrast-*` convention.

---

## 1. Single source of truth + transient drag buffer [R: DRY / correctness]

The control is **stateless about the curve except during an active drag.** Every render derives the curve from
the `value` prop: `const parsed = parseBezier(value)`. There is exactly **one emit funnel**:
`formatBezier(cubic) → onChange(string)`, shared by drag, numeric inputs, and presets — mirroring how
`color-oklch` routes both sliders and typed fields through `formatOklch → onChange`. **[R: no second curve
store that drag and inputs both write.]**

The **one** piece of local state is a transient gesture buffer:

```
const [drag, setDrag] = useState<Cubic | null>(null); // non-null only mid-gesture
const display: Cubic = drag ?? parsed ?? FALLBACK;     // what the canvas/inputs/preview render
```

`drag` is the curve being dragged; it is **committed and cleared on `pointerup`** (§2). When not dragging,
`drag` is `null` and the control re-derives from `value` — so undo/redo, reset, and block-switch (which all
change `value` from outside) move the handles automatically, no re-seed effect needed. This is the same
"transient buffer committed on release" shape as `use-draft-field`'s `draft` (committed on blur).
`FALLBACK` (used only when `parsed` is `null`, i.e. a `steps()`/`var()`/garbage value) is the
`--ease-standard` token's curve if present, else `[0.25, 0.1, 0.25, 1]` (`ease`).

---

## 2. Drag: commit once on release [R: P0 — history flooding]

`editValue` pushes **one** undo-history entry per call (`editor-provider.tsx:242`); the writeback debounce
coalesces only the network POST, **not** history. So a live-`onChange`-per-pointer-move drag would push dozens
of undo entries for one gesture (the existing live sliders already do this; a 2-axis SVG drag is far worse and
is the headline interaction). **The drag therefore does NOT call `onChange` mid-gesture:**

- `pointerdown` on a handle: `setPointerCapture`, seed `drag` from `display`.
- `pointermove`: map the pointer to curve space (§3), clamp, `setDrag(next)`. **No `onChange`** — the
  SVG curve + numeric inputs + preview re-render from `drag` (in-control feedback only).
- `pointerup` / `pointercancel`: `releasePointerCapture`; `onChange(formatBezier(drag))` **once**, then
  `setDrag(null)`. One history entry, one debounced write.

Consequence — **no live page-var preview during the drag.** That is acceptable and in fact correct here:
easing tokens drive *transitions*, which have no static appearance, so the meaningful preview is the in-control
animated dot (§5), not page elements. The page var + file write land on release via the normal
`onChange`→`editValue`→`queue.edit` path. **[R: this single change resolves history-flooding (R3-B1),
preview strobing (R3-S1), and any dark-block write-error frequency concern (R1-1) at once.]**

**Numeric inputs** (§4) and **preset chips** (§4) are discrete commits — they call `onChange` once each
(inputs on blur/Enter, chips on click), so they each produce one history entry, as today.

---

## 3. SVG coordinate mapping (net-new — no precedent in the editor)

No existing control uses pointer-drag (`highlight-overlay.tsx` is the only `setPointerCapture` user, and it
tracks page hover, not a value). The mapping must be explicit and unit-tested.

Canvas: a `viewBox="0 0 W H"` SVG. A horizontal inset `PAD_X` and vertical inset `PAD_Y` reserve room so the
`[0,1]` time axis maps to `[PAD_X, W-PAD_X]` and the **progress** axis is laid out so `y=0` (start) sits at
`H - PAD_Y_BOTTOM` and `y=1` (end) sits at `PAD_Y_TOP`, with extra space above/below for overshoot
(`Y_MAX`/`Y_MIN`). Pure helpers in `bezier.ts` (so they're testable without a DOM):

- `toSvg(c: Cubic, geom): { p1: {sx,sy}, p2: {sx,sy}, ...anchors }` — curve space → SVG px (y **flipped**).
- `fromSvg(sx, sy, geom): { x, y }` — SVG px → curve space (inverse), then `clampX`/`clampY`.

`geom` is `{ width, height, padX, padTop, padBottom }` derived from the rendered SVG's
`getBoundingClientRect()` (the house pattern, cf. `highlight-overlay.tsx`). The `[0,1]` progress band is drawn
as a reference box inside the taller canvas so overshoot reads correctly. **[R: UX-N2 — without the band the
overshooting dot/curve is unexplained.]** Tests assert known SVG points → known curve tuples, including the
y-flip and the overshoot region, and that `fromSvg` always returns `x ∈ [0,1]`. **[R: the value validator
(`validate.ts:32` `cubic-bezier\(.+\)`) accepts ANY contents, so an out-of-range x would pass the API +
`npm run check` and land an invalid curve that breaks the CSS compile — the clamp is the only guard, so it
must be tested.]**

---

## 4. The control's pieces

The panel renders, top to bottom:

1. **Legend** — a one-line caption: "X = time → · Y = progress ↑ · values past 0–1 overshoot". **[R: UX-N1 —
   "P1x"/"P2y" are jargon; users don't know x=time / y=progress.]** Uses the existing `.ed-label`/caption
   styling.
2. **SVG curve canvas** — the `[0,1]` reference box, the two fixed corner anchors (start `(0,0)`, end `(1,1)`),
   two control-arm lines, the cubic-bezier path, and two draggable handle circles (P1 = start handle, P2 = end
   handle). Handles are **pointer-only and `aria-hidden`**; keyboard users drive the numeric inputs (§ below).
   Drag behaviour per §2.
3. **Four numeric inputs** — `type="number" step="0.01"`, labelled by meaning where possible (e.g. "start x
   (time) / start y (progress)", "end x / end y"), each wired through `useDraftField` (commit on blur/Enter,
   Escape reverts, invalid rejected). x inputs validate to a finite number in `[0,1]`; y inputs to a finite
   number in `[Y_MIN, Y_MAX]`. On commit, the changed axis is merged into the current `display` cubic and the
   whole curve is emitted via `formatBezier → onChange`. `step="0.01"` gives keyboard users incremental
   manipulation — the proportionate a11y path. **[R: UX-B2 — hand-rolling `role="slider"` + 2-axis arrow
   handling on SVG handles is scope creep for a dev tool; `type=number` + `step` is the accepted posture.]**
   The four inputs sit in `.ed-row`s so they inherit the editor's focus-visible outline (`.ed-row input`
   otherwise `all: unset`). **[R: UX-N3.]**
4. **Preset chips** — a labelled strip of buttons, modelled on the **`.ed-reuse-*`** swatch-strip pattern from
   `color-oklch` (a label + a row of click-to-apply buttons), **not** `.ed-chip` (that is the toolbar's
   light/dark **block-switch** chip and is semantically taken). **[R: DRY-2.]** Sources, deduped: the
   `tokens.filter(t => t.group === "easing")` curve values (the same derivation the current control uses) plus
   the CSS keywords (`ease`, `ease-in`, `ease-out`, `ease-in-out`, `linear`). Clicking a chip emits that curve
   via `onChange` (keywords are converted to `cubic-bezier(...)` by `parseBezier`→`formatBezier`, so the
   written value is always a normalised curve).
5. **Animated preview** — a sample dot/bar that runs an animation using the **current committed** curve,
   `replay`ed on every `value` change (i.e. after a commit) and on a click-to-replay button. It does **not**
   retrigger on every drag delta (the curve line moving is the live feedback; the dot replays once the gesture
   settles). **[R: UX-S1 — replay-per-delta with live drag strobes / is a photosensitivity risk.]** Implemented
   with a CSS transition/animation whose timing function is the curve, restarted via a `key` bumped on commit.
6. **Raw-value escape-hatch row** — a single validated text input (the existing "custom" row, relabelled),
   `useDraftField` commit-on-blur/Enter, accepting `cubic-bezier(...)` | keyword | `steps(...)` | `var(...)`
   (the current `VALID` regex, plus `var(...)`). This is the **only** way to author/repair a value the curve
   can't draw (`steps()`, a `var()` reference) or to paste a raw string. **[R: correctness-3 / UX-S2 — dropping
   the text field is a capability regression; `steps()`/`var()` values would otherwise be unrepresentable and
   silently rewritten. NOTE: this re-adds a row the user had earlier agreed to cut — re-added on review.]**

**Never emit on mount or selection.** `parseBezier` is for *display* only. When the selected token's value is
`steps()`/`var()`/garbage (`parsed === null`), the canvas shows `FALLBACK` (visibly, e.g. dimmed) and the raw
row shows the actual string, but **no `onChange` fires** until the user makes an explicit gesture (drag, a
numeric commit, a chip, or a raw-row commit). So selecting such a token never clobbers it. **[R: correctness-3
— the `editValue` no-op guard compares strings, so a silent `steps()`→curve normalisation would NOT be a no-op
and would persist + push undo history.]**

---

## 5. Non-goals / documented limitations

- **Dark-block easing writes error (pre-existing, out of scope).** `--ease-*` exist only in `:root`, never in
  `.dark` (`app/globals.css:101-103`; manifest `values:{light}` only). `applyEdit` requires the token in the
  target block and throws `UnknownTokenError` otherwise (`apply-edit.ts:15-16`); the provider always writes to
  `editingBlock` (`editor-provider.tsx:240`). So editing easing while the **dark** block is active fails the
  write — but this affects **every** light-only (non-color) token, not bezier, and commit-on-release means it
  is no worse than the current control (one error per settle, not a storm). Fixing it (seed dark blocks / route
  light-only writes to `:root`) is an editor-wide architecture change for its own fast-follow. **Documented,
  not fixed here.** The default editing block is light, where easing edits succeed.
- **`role="slider"` + arrow-key handles** — not built (see §4.3). Numeric inputs are the keyboard path.
- **`steps()` curve representation** — `steps()` is a fundamentally different timing function (no smooth curve
  draws it); it is editable only via the raw row, never on the canvas. No token uses it.
- **Per-`(name,theme)` status** — inherited M4 limitation, unaffected by this work.

---

## 6. Testing

**`tests/editor/bezier.test.ts`** (pure, fast — the testable core):
- `parseBezier`: each keyword → its exact spec tuple; `cubic-bezier` with varied whitespace; `steps()` /
  `var()` / garbage → `null`.
- `formatBezier`: 2dp **numeric** rounding (`0.2`, not `0.20`); `parseBezier(formatBezier(c)) === c` round-trip;
  the seeded `--ease-standard` value formats back to its exact globals string (no `0.2`→`0.20` drift).
- `clampX` ∈ [0,1]; `clampY` ∈ [Y_MIN, Y_MAX].
- `toSvg`/`fromSvg`: known SVG point ↔ known curve tuple (incl. y-flip + overshoot region); `fromSvg` always
  returns `x ∈ [0,1]` (the validator won't catch a regression — §3).

**`tests/editor/easing-field.test.tsx`** (rewritten; `// @vitest-environment jsdom`):
- renders the SVG canvas, two handles, four numeric inputs, the preset strip, the preview, the raw row.
- pointer drag (pointerdown→move→up, mocking `getBoundingClientRect` + pointer capture): emits **one**
  `onChange` with a normalised, x-clamped `cubic-bezier`, and emits **nothing** mid-move.
- numeric input: does not emit while typing; commits a merged curve on blur and on Enter; rejects invalid /
  out-of-range; reverts on Escape.
- preset chip click → `onChange` with the converted curve; keyword chip emits `cubic-bezier(...)`.
- a `steps(4, end)` / `var(--ease-in)` value: renders the fallback curve + the raw string in the raw row, emits
  **nothing** on mount; raw-row commit of a valid value emits it.
- re-seed: changing the `value` prop (block-switch/undo) moves the handles/inputs with no stale draft.
- a11y: every numeric input + the raw input has an accessible name; handles are `aria-hidden`.

**`tests/editor/control-host.test.tsx`** — verify the `easing` case still resolves the (rewritten) control;
update only if it asserts removed `<select>`/text specifics.

**Delete** nothing structural — the file/test names stay; their contents are rewritten.

**Visual checkpoint:** a throwaway Playwright spec into `e2e/__shots__/` (gitignored) captures the control on
`/design-system` with an easing token selected (resting + mid-drag if feasible); `Read` the PNGs to
self-critique against `docs/DESIGN-BRIEF.md`; **the user reviews the screenshots before this is called done**
(function is TDD'd; aesthetic is human-checkpointed).

---

## 7. Out-of-scope (YAGNI)

No gradient/spring presets, no curve library import/export, no multi-segment curves, no eyedropper, no
animation-duration coupling. One token, one curve, one control.
