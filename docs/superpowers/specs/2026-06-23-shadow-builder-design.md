# Layered shadow builder (editor) — design

**Date:** 2026-06-23
**Status:** Design approved (brainstorm + 3-agent review), pre-plan
**Milestone:** M4 editor fast-follow — "layered shadow builder" (HANDOFF M4 list). **The last remaining M4
builder.** Lighter than the gradient builder: it edits an **existing** token group (`--elevation-*`, group
`shadow`), so there is **no new `TokenGroup`** and none of the 9-site group plumbing — every exhaustive
`Record<TokenGroup>` / `switch (group)` site already carries `shadow` (verified, §3).
**Depends on:** M4 (the dev-only editor, `components/editor/*`, `lib/editor/*`), the writeback/preview model
(`lib/editor/use-token-writeback.ts`, `editor-provider.tsx`), the draft-field convention
(`lib/editor/use-draft-field.ts`), and the gradient builder as the closest worked example
(`lib/editor/gradient.ts` ↔ `components/editor/controls/gradient-builder.tsx` +
`gradient-stop-picker.tsx`). Mirrors the house **pure-lib + thin-view** pattern (also `bezier.ts` ↔
`easing-field.tsx`).

> **What it does:** replaces the shadow control — currently a plain validated text field
> (`control-map.ts` maps `shadow → "text"`) — with a **layered shadow builder**: add / remove shadow layers,
> each with `x` / `y` / `blur` / `spread` / color (neutral black **or** a color token) + alpha + an `inset`
> toggle, composing a multi-layer `box-shadow` string. Live preview → stacked per-layer cards (accordion;
> one expanded at a time) → each card a 2D offset pad (drag = x/y) **plus** visible numeric inputs for every
> value → a color picker (black default + token grid + alpha) → a raw-value escape-hatch. It edits an
> `--elevation-*` token, emits a normalised `box-shadow` string through the existing `onChange`→`editValue`
> path, and changes nothing in the provider/preview/writeback contract.

3-agent review (correctness / DRY-architecture / UX-a11y-scope) reshaped this design; changes from the
brainstorm draft are tagged **[R: …]**. Headline outcomes: the touch-point set is **verified minimal** (group
plumbing already complete — the gradient builder's biggest cost is absent here); `splitTopLevel` is **private**
and a **second** paren-aware splitter already exists (`resolve-token.ts`), so a shared util is extracted
(§0); the per-file `round`/`clamp` and per-control drag loop are **kept** (house style — no `num.ts`, no shared
drag hook); the color picker is a **purpose-built sibling** of `GradientStopPicker` (no shared-grid
extraction); the **decimal-vs-percent alpha** conversion is pinned (§2); per-layer **aria-labels**, **focus
rings**, **inset-as-toggle**, an **accordion**, and a **sticky preview** are added for the multi-layer a11y +
density reality (§4); the dark-block write error is pre-empted with a disabled state (§5).

**Locked scope decisions (from brainstorm):** edits the existing named `--elevation-*` tokens (not an ad-hoc
shadow composer); **outer + inset** layers; layer color is **neutral-black sentinel (default) OR a color-token
ref**, each + alpha 0–100, so **tinted glows are first-class** (the user explicitly wanted these); **every
value has a visible numeric input** (readable / copyable / testable — the user insisted) with a 2D offset pad
as the tactile extra for x/y; **no extra sliders** for blur/spread/alpha (numeric only); **no layer reorder**.

---

## 0. Architecture — pure lib + thin view + one shared splitter [R: DRY]

Mirror `gradient.ts` ↔ `gradient-builder.tsx`: all parse/format/clamp/model math is pure and lives in a new
lib; the control is a thin React/SVG view. **One emit funnel**: `formatShadow(model) → onChange(string)`,
shared by every sub-control (pad, numeric inputs, color pick, inset toggle, add/remove), mirroring how
`gradient-builder` routes all inputs through `formatGradient → onChange`.

- **New `lib/editor/shadow.ts`** (pure, client-safe — no React, no DOM, no culori, no Node — the testable
  core). Model:
  ```ts
  // color: the literal "black" sentinel (renders oklch(0 0 0 / a)) | a color-token name "--brand-500"
  interface Layer { inset: boolean; x: number; y: number; blur: number; spread: number;
                    color: string; alpha: number }
  type Shadow = Layer[]; // ≥ 1 layer
  ```
  `"black"` is an **internal sentinel**, NOT the CSS keyword `black`: parse maps `oklch(0 0 0 / a)` →
  `{color:"black", alpha}`, format reverses it. So all three real seeds (literal `oklch(0 0 0 / …)`) parse and
  round-trip — the builder is **not** dead-on-arrival. **[R: DRY-agent flagged "color model wrong, dead on
  arrival"; that was a misread — the sentinel handles the literal seeds, confirmed by the correctness agent.
  Kept. Acknowledged residue: a non-black, non-token literal color (e.g. `oklch(.2 0 0 / .3)`, a raw gray)
  is not modellable → raw row (§8). Full per-layer L/C/H would be scope creep all three agents warned
  against.]**

- **New `lib/editor/css-list.ts`** — a tiny pure util exporting `splitTopLevel(s: string): string[]`
  (paren-aware, depth-0 comma split). **[R: correctness P0-1 / DRY P1 — the gradient `splitTopLevel`
  (`gradient.ts:51`) is **module-private** (not exported), and a **second** paren-aware splitter already
  exists for box-shadow layers (`resolve-token.ts:44` `splitLayers`, comment "box-shadow layers may contain
  `rgb(0, 0, 0)`"). That's three would-be consumers (gradient, resolve-token, shadow) — rule-of-three.
  Extract once.]** `shadow.ts` and `gradient.ts` both import it; `resolve-token.ts` `splitLayers` is
  refactored to delegate to it (behaviour-equivalent — guarded by the existing `resolve-token`/`probe` tests,
  which must stay green). This is the **only** generic, non-domain helper extracted. `round`,
  `clampPct`/`clampBlur` etc. stay **per-file** in `shadow.ts` — the house style (`gradient.ts:9`,
  `bezier.ts:27-30`, `oklch.ts:9` each declare their own; a shared `num.ts` would fight a clear, intentional
  convention). **[R: DRY P1 — `num.ts` rejected.]**

  `shadow.ts` keeps the **color as an opaque string** it pattern-matches (`oklch(0 0 0 / a)` / `var(--name)` /
  `color-mix(…)`) and never does color math — the exact SRP boundary `gradient.ts` holds vs `oklch.ts`.
  **[R: DRY P2 — keep culori/oklch math out of `shadow.ts`; the view's color picker owns any literal-color
  rendering.]**

- **New `components/editor/controls/shadow-builder.tsx`** — the thin view, props
  `{ token: string; value: string; onChange: (v: string) => void; tokens: ManifestToken[]; disabled?: boolean }`
  (same shape as `GradientBuilder`). New CSS in `editor-chrome.css`, `--ed-*` namespace (excluded from
  `npm run check`), prefixed `.ed-shadow-*`.
- **New `components/editor/controls/shadow-color-picker.tsx`** — a purpose-built sibling of
  `GradientStopPicker` (§4.4).

**Client-safety / bundle:** the whole tree stays inside the dev-only editor island (`components/editor/**`,
tree-shaken from prod). The one DOM read (`getBoundingClientRect()` for the pad geometry) stays in the
**component**; coordinate helpers are pure and take `rect` as a param (unit-testable without a DOM), the
`gradient.ts` `centerFromPointer` pattern.

---

## 1. parse / format — the pure core (`lib/editor/shadow.ts`)

### parseShadow(value: string): Layer[] | null
1. `splitTopLevel(value)` → one string per layer (paren-aware; `oklch(0 0 0 / .1)` inner slash/spaces and
   `color-mix(in oklch, …, transparent)` inner commas survive).
2. Per layer, a **paren-aware space tokenizer** splits into space-separated tokens but keeps `oklch(…)`,
   `color-mix(…)`, `var(…)` each as a single token. **[R: correctness P1-3 — a naive `.split(" ")` shatters
   `oklch(0 0 0 / 0.1)`.]**
3. Optional leading `inset` keyword → `inset:true`.
4. Then **2–4 length tokens** = `x y [blur [spread]]` (blur/spread default `0`). Lengths parse `-?\d*\.?\d+`
   with optional `px` (`0` is unit-less in the seeds). **x / y / spread may be negative; blur is clamped ≥ 0**
   (CSS forbids negative blur — `parseShadow` clamps rather than emit invalid CSS). **[R: correctness P2-4.]**
5. The remaining token = the **color**, mapped:
   - `oklch(0 0 0 / a)` → `{color:"black", alpha: round(a*100)}` (decimal→percent, e.g. `0.05`→`5`),
   - `oklch(0 0 0)` (no alpha) → `{color:"black", alpha:100}`,
   - `var(--name)` → `{color:"--name", alpha:100}`,
   - `color-mix(in oklch, var(--name) N%, transparent)` → `{color:"--name", alpha:N}`.
6. **Returns `null`** for any layer it can't model — a non-black literal `oklch`/`rgb`/`hsl`/hex/keyword color,
   a `%` length, the leading-color grammar (`<color> x y …`), `none`, or unparseable. `null` → the control
   dims the builder and the raw row is authoritative (§4.6), exactly as `gradient.ts` / `bezier.ts` return
   `null` for what they can't model. **[R: correctness P1-3 — document these as non-goals (§8), not bugs.]**

### formatShadow(layers: Layer[]): string
Per layer: `${inset ? "inset " : ""}${len(x)} ${len(y)} ${len(blur)} ${len(spread)} ${color(l)}`, joined by
`, `. Always emits all four lengths (matches the seeds, which carry an explicit `0` spread).
- `len(n) = n === 0 ? "0" : ` `${round(n)}px` ` ` — **zero is bare `0`** (matches seed `0 1px 2px 0 …`).
- `color(l)`: **black** → `alpha >= 100 ? "oklch(0 0 0)" : ` `oklch(0 0 0 / ${round(alpha/100)})` ` ` (percent→
  decimal: `10`→`0.1`, `5`→`0.05`); **token** → `alpha >= 100 ? ` `var(${color})` ` : `
  `color-mix(in oklch, var(${color}) ${round(alpha)}%, transparent)` ` ` (percent stays percent). Two distinct
  alpha branches. **[R: correctness P0-2 / P1-1 / P1-2 — the decimal(black, `/0.1`) vs percent(token,
  `color-mix N%`) split is the subtlest correctness point; the terse brainstorm spec glossed it.]**
- `round(n) = Math.round(n * 100) / 100` — 2dp, **NOT `toFixed`** (`toFixed(2)` emits `0.10`/`0.20`, differing
  from the seed `0.1` and from the `editValue` no-op guard → breaks `manifest-fresh`). Copied from
  `gradient.ts:9`. **[R: correctness P1-2.]**

**Round-trip guarantee:** `formatShadow(parseShadow(seed)) === seed` for all three real seeds (exact strings,
incl. `0` zeros and `0.05`/`0.1` alpha) — pinned by a test (§7). This is what keeps `manifest-fresh` green if
a token is opened and saved unchanged through the editor's value path.

### clamps + coord helper (exported for view + tests)
`clampPct ∈ [0,100]` (alpha), `clampBlur = max(0, n)`; x/y/spread unclamped (signed). Pad coordinate helper
`offsetFromPointer(clientX, clientY, rect, range) → {x, y}` maps a pointer within a square pad to ±`range` px
with **centre = origin** and **y down-positive** (matches CSS box-shadow y). Pure (takes `rect`), unit-tested.
`dotPercent(x, y, range) → {left, top}` maps a model x/y back to a clamped `[0,100]%` dot position so a numeric
value beyond the pad range **pins the dot to the edge** without clamping the value. **[R: UX P1-3 — the value
is authoritative; the dot clamps, not the value (the `gradient-builder.tsx:212` `clampPct(display.cx)`
precedent).]** **The clamp is the guard, not `validate.ts`** (which accepts any `v.length > 0` shadow) — so an
out-of-range model would otherwise pass the API + `npm run check`; clamp + the seed/round-trip tests are the
real guard. **[R: correctness — same hole flagged at `validate.ts` for bezier/gradient.]**

---

## 2. Single source of truth + transient drag buffer; commit cadence [R: P0 — history flooding]

`editValue` pushes **one** undo-history entry per call; the writeback debounce coalesces only the network POST,
not history. So:

- The control is **stateless about the shadow except during an active pad drag.** Every render derives from
  `value`: `const parsed = parseShadow(value)`. One transient local state — the gesture buffer
  `const [drag, setDrag] = useState<Shadow | null>(null)`; `const display = drag ?? parsed ?? FALLBACK`. When
  not dragging, the control re-derives from `value`, so undo/redo, reset, and block-switch move the UI
  automatically — no re-seed effect. `FALLBACK` (only when `parsed === null`) is a minimal valid 1-layer
  shadow rendered **dimmed** with a "not visually editable" note (§4.6); the raw row shows the real string.
- **Pad drag** (x/y offset): `pointerdown` seeds `drag` from `display` + `setPointerCapture`; `pointermove`
  maps→clamps→`setDrag(next)` with **no `onChange`** (preview + numeric twins re-render from `drag`);
  `pointerup`/`pointercancel` `onChange(formatShadow(drag))` **once**, then `setDrag(null)`. One history entry,
  one debounced write. Implemented with `mode`/`working` refs in a window-level `useEffect` keyed on
  `[value]`, copying `gradient-builder.tsx:124-161` **including the
  `// eslint-disable-next-line react-hooks/exhaustive-deps`** — the hazard is the exhaustive-deps lint on the
  effect (refs read in handlers are fine), and `startDrag` is called at `onPointerDown` event time, never
  during render. **[R: correctness P2-2 — the "refs during render" eslint trap; the proven shape avoids it.]**
- **Discrete edits** (numeric commit on blur/Enter, add/remove layer, inset toggle, color pick, accordion
  expand) each call `onChange` **once** — one history entry each. **Never emits on mount** (an unparseable
  value shows the dimmed fallback + raw string, never clobbered).

A shadow has a meaningful static preview, so the live page-var preview on commit is useful — but only on
commit, not per pad-move.

---

## 3. Token-group plumbing — VERIFIED already complete (the gradient builder's big cost is absent) [R]

Unlike the gradient builder, **no new `TokenGroup`** is introduced. All three agents independently verified
that every exhaustive site already carries `shadow`:

| Site | State | Verified |
|---|---|---|
| `lib/tokens/types.ts` `TokenGroup` | has `"shadow"` | ✓ (`types.ts:11`) |
| `lib/tokens/schema.ts` `groupForName` | `/^elevation-/ → "shadow"` | ✓ (`schema.ts:39`) — `parseTokens` does NOT throw (the gradient B1 crash does not apply) |
| `lib/tokens/schema.ts` `CONTROL` | `shadow: "text"` (the strict `ControlType`) | ✓ (`schema.ts:69`) — **stays `"text"`**; only the editor `ControlKind` changes |
| `lib/design-system/sections.ts` | `ORDER` + `TITLES.shadow` | ✓ (`sections.ts:12,19`) |
| `lib/tokens/utilities.ts` `utilitiesForToken` | `case "shadow"` (before the `_never` guard) | ✓ (`utilities.ts:30`) |
| `lib/tokens/generate.ts` `GROUP_ORDER` | has `"shadow"` | ✓ (`generate.ts:18`) |
| `lib/tokens/validate.ts` `checkGroup` | `case "shadow": return v.length > 0` | ✓ (`validate.ts:27-29`) — **saves do NOT 400**; a richer composed string still passes |
| `lib/tokens/sync.ts` | `case "shadow"` | ✓ (`sync.ts:58`) |
| `components/design-system/token-item.tsx` `preview()` | `case "shadow"` | ✓ (`token-item.tsx:52`) |
| `lib/editor/resolve-token.ts` / `use-probe-index.ts` | `box-shadow → "shadow"` | ✓ (already maps; pick-anywhere already reverse-resolves box-shadow) |

### The ONLY plumbing edits
| # | File | Change | If omitted |
|---|---|---|---|
| 1 | `lib/editor/control-map.ts` | add `"shadow"` to `CONTROL_KINDS`; flip `MAP.shadow` `"text"` → `"shadow"` | the control stays the plain text field |
| 2 | `components/editor/controls/control-host.tsx` | add `case "shadow": return <ShadowBuilder … disabled={editingBlock==="dark" && token.values.dark===undefined} />` | silent blank panel (no `default`) |

**Atomicity note:** the `_never: never = kind` guard at `control-host.tsx:122` **already exists**. The moment
`"shadow"` is added to `CONTROL_KINDS`, that guard becomes a **compile error** until the `case "shadow"` is
also added — so #1 and #2 are a single atomic change. `npm run check` will NOT catch a half-edit (it skips
tsc); **`npm run verify` (`next build`) is the safety net**, per the standing pre-merge rule. **[R: correctness
P1-5.]**

No change to `sections.ts` `SectionBody`, `token-item.tsx` (preview already renders a shadow swatch),
`utilities.ts`, `generate.ts`, `validate.ts`, `globals.css` `@theme`/`@utility`, or any seed. **No new tokens.**

---

## 4. The control's pieces

The panel renders, top to bottom:

1. **Live preview (sticky)** — a filled card with real margin, floating on a neutral mid-tone surface, backed
   by the **live edited value** (`boxShadow: value`). **Sticky** at the top of the scroll region so it stays
   visible while editing lower layers. A **light/dark preview-surface toggle** (independent of the editing
   block) — a black drop shadow and a colored glow read differently per background, and a glow vanishes on a
   same-hue surface. The filled card lets **inset** read (inner shadows read against the element's own fill). A
   caption notes a soft large-blur shadow reads differently at full-bleed. **[R: UX P2-4 — preview honesty.]**
2. **Layer list — an accordion.** Layers stack in source order; **one expanded at a time**, the rest collapse
   to a one-line **summary row** (resolved-color swatch + `"{x} {y} · blur {b}{ · inset}"` + expand + remove).
   **[R: UX P1-1 — the 312px panel (`editor-chrome.css:92`, single column, `overflow-y:auto`) cannot hold N
   fully-expanded layers (pad + 4 inputs + color popover + alpha + inset + remove each); without the accordion
   the control is unusable past ~2 layers, and the seeds already have 2.]** The **expanded** layer card holds:
   - a **2D offset pad** — an SVG/div square the user drags to set `x`/`y` (centre origin, ±32px range to match
     `.ed-gradient-pad`'s 64px; y down-positive). The pad is **`aria-hidden`** + pointer-only (drag per §2);
     a live `x · y` badge follows the dot during drag. **[R: UX P1-3 — range + edge-pin mapping per §1.]**
   - **visible numeric inputs** `x` / `y` / `blur` / `spread` (signed, `useDraftField` commit-on-blur/Enter,
     Escape-revert) — the canonical readable values **and** the keyboard/a11y path (the pad is aria-hidden).
     `x`/`y` are the pad's twins, ticking live during drag. Each has a **layer-disambiguated accessible name**:
     `aria-label="{token} layer {n} x offset"` / `… y offset` / `… blur` / `… spread`. **[R: UX P0-1 — N
     identical `aria-label="x"` spinbuttons is a screen-reader failure.]**
   - a **color picker** (§4.4) — black chip (default) + token grid + alpha.
   - an **inset toggle** — a real toggle button (`aria-pressed`, `aria-label="{token} layer {n} inset"`), NOT
     a bare `<input type="checkbox">`: `.ed-row input { all: unset }` (`editor-chrome.css:399`) removes native
     checkbox rendering entirely. Mirrors the `panel-toolbar.tsx:51-61` chip idiom. **[R: UX P0-3.]**
   - a **remove** `<button aria-label="Remove layer {n}">` (glyph `aria-hidden`); disabled when only **1 layer**
     remains (a `box-shadow` needs ≥ 1 layer; cf. gradient's ≥ 2 stops).
3. **"+ Add layer"** — inserts a **visible** default layer `0 2px 4px 0 black@15%`
   (= `0 2px 4px 0 oklch(0 0 0 / 0.15)`, parseable + round-trips), expands it, emits once. **[R: UX P1-2 — a
   `0 0 0 0 transparent` default would add an invisible layer.]**
4. **aria-live announcer** — `.ed-sr-only` + `aria-live="polite"` (the `color-oklch.tsx:335` idiom) announcing
   layer add/remove ("Layer 3 added" / "Layer 2 removed, 2 remain") on transition only. **[R: UX P1-4 — a
   structural change a SR user can't otherwise perceive.]**
5. **Raw-value escape-hatch row** — a single `useDraftField` text input, the **only** way to author/repair a
   value the builder can't model (raw-color layers, `%`, leading-color grammar, `none`). **Shaped-but-lenient**
   validation (a `box-shadow` has no wrapping function, so the gradient `RAW_VALID` regex does not transfer):
   reject empty, reject the injection set `/[;{}]|\/\*|\*\//` (the server screen, `validate.ts`), and require it
   look shadow-ish (`inset`/a length/`none`/a color token). Rejected on blur/Enter, **not** silently written.
   **[R: UX P2-3 / correctness P1-3 — "permissive" as first drafted is a footgun.]**

### 4.1 Focus rings — not automatic [R: UX P0-2]
`.ed-row input { all: unset }` (`editor-chrome.css:399-404`) strips the focus ring; the bezier control had to
re-add it (`editor-chrome.css:614-618`). The shadow numeric inputs **are** the keyboard path (pad aria-hidden),
so a `.ed-shadow … input:focus-visible` outline is **required** — and the new inputs must actually be covered
(gradient's `.ed-gradient-pos` sits outside `.ed-row` and silently missed the bezier rule — do not repeat).

### 4.4 Shadow color picker — purpose-built sibling of GradientStopPicker [R: DRY/UX converge]
A purpose-built `shadow-color-picker.tsx` **mirroring `GradientStopPicker`'s idiom** (a current-color chip
opening a popover `role="menu"` with a token-swatch grid `menuitemradio` + an alpha `<input type=range
aria-label="{label} alpha">`), with the **`black` sentinel** replacing gradient's `transparent` chip as the
first/default option. It emits `{color:"black"|"--name", alpha}` — the **token name**, never a resolved literal,
so a tinted glow themes. **Do NOT** extract a shared grid component: both agents converged — the gradient grid
emits a token *name* on a `Stop` shape, `color-oklch` has no alpha and emits resolved literals
(`gradient-stop-picker.tsx:18-21` is the documented "NOT a reuse of color-oklch" precedent), and `pick-menu.tsx`
is a read-only disambiguation menu — there is **no clean shared seam**; a parameterised "grid that does
everything" is the textbook wrong abstraction. Copy the lean idiom, as bezier/gradient copy small idioms.
**[R: DRY P1 + UX P2-1/P2-2 — purpose-built, black chip distinct from the token grid; no shared-grid
extraction.]**

### Reuse that IS real
`splitTopLevel` (the new shared `css-list.ts`, §0), `useDraftField` (every numeric/raw input —
commit-on-blur/Enter, Escape-revert, re-seed, `pinScroll`), `useTokenWriteback` (group-agnostic live `var()`
preview + rollback — shadow gets optimistic preview free), the `color-mix(…, transparent)` alpha encoding (the
gate already understands it), the `gradient-builder` drag-buffer **shape** (copied, not shared — §0/§2), the
`GradientStopPicker` popover/alpha **idiom** (copied — §4.4), and the `.ed-sr-only` + `aria-live` announcer
idiom. A shared `num.ts` and a shared drag hook are **explicitly not** created (house style — §0).

---

## 5. Dark-block: pre-empt the write error [R: UX P1-5]

`--elevation-*` are **`:root`-only** (verified: `globals.css:93-95`; no `.dark` counterpart; the `--shadow-*`
aliases at 253-255 live in `@theme`). Writing one while the dark block is active throws
`token --elevation-x not found in .dark` (`write.ts:36`) → API 400 → writeback `rollback` → a red error in the
aria-live save-state, *after* the user dragged and saw the preview move. Mirror gradient: when
`editingBlock === "dark"` and the `:root`-only token is selected, render the builder **disabled/greyed with an
inline `role="status"` message** ("Shadows are theme-independent — switch to the Light block to edit") **before**
the user touches anything (`control-host.tsx` passes `disabled={editingBlock==="dark" &&
token.values.dark===undefined}`, the gradient gate at `control-host.tsx:118`). **The `if (disabled) return`
early-return must sit AFTER all hooks** (`useState`/`useRef`/`useEffect`/`useDraftField`) — the
`gradient-builder.tsx:165-174` precedent — or it trips rules-of-hooks. The underlying light-only-token
limitation is editor-wide and out of scope to fix here.

---

## 6. Gate safety — verified clean (no new gate work) [R: confirmed against real check code]

- **`hardcoded-color`** scans source `app`/`components`, **excludes `globals.css`**, and matches
  hex/`rgb(`/named keywords — shadow values use `oklch`/`var()`/`color-mix`/`transparent` and the token source
  isn't scanned regardless.
- **`both-theme`** filters to `isColorValue` — a `box-shadow` string returns `false`, so `:root`-only
  `--elevation-*` are excluded (no "missing dark counterpart"); already true today.
- **`off-token-scale` / `arbitrary-tailwind`** — shadow is a token *value*; the off-scale-spacing check scans
  Tailwind utility classes in source, not token values, so the `-1px`/`15px` offsets are not scanned
  (`lib/check/spacing-steps.ts`). `shadow-{sm,md,lg}` utilities are defined scale steps.
- **write-route injection screen** (`validate.ts` `INJECTION = /[;{}]|\/\*|\*\//`) — all three seeds (incl.
  multi-layer + `oklch(0 0 0 / a)`) and a `color-mix` tinted glow pass; `writeToken` preserves multi-comma
  values exactly.

No `validate.ts` change (the `checkGroup` case already exists, §3). The exhaustive-`Record`/`never` atomicity
(§3) is caught by **`tsc` via `npm run verify`**, not `npm run check`. A `tests/check`/`tokens` regression pass
asserts the seeds keep `npm run check` green and `npm run tokens` idempotent (§7).

---

## 7. Testing

**`tests/editor/shadow.test.ts`** (pure, fast — the testable core):
- `parseShadow`: single-layer (`sm`), **multi-layer** (`md`/`lg`, 2 layers — depth-0 split, no shatter on
  `oklch(0 0 0 / .1)`); `inset` leading keyword; a `var(--x)` token layer; a `color-mix(in oklch, var(--x) N%,
  transparent)` token layer; 2/3/4 length forms (blur/spread default 0); negative x/y/spread; negative blur
  clamped ≥ 0; **`null`** for a raw `rgb`/hex/keyword color, a `%` length, the leading-color grammar, `none`,
  garbage.
- `formatShadow`: black `alpha<100` → `oklch(0 0 0 / dec)` (decimal: `10`→`0.1`, `5`→`0.05`); black
  `alpha===100` → `oklch(0 0 0)`; token `alpha<100` → `color-mix(…, N%, transparent)`; token `alpha===100` →
  `var(--x)`; zero length → bare `0`; **the 3 seeds round-trip to their exact `globals.css` strings** (no
  `0.10`/`0px` drift → `manifest-fresh` safe); `parseShadow(formatShadow(s)) ≈ s`. A unit-less `0` and a `0px`
  input parse equivalently but **format back to bare `0`** (pin `"0px 1px …"` input → `"0 1px …"` output).
- `clampPct`/`clampBlur`; `offsetFromPointer` known point ↔ known x/y (centre origin, y down-positive);
  `dotPercent` pins to `[0,100]%` when the value exceeds range (the validator won't catch an out-of-range
  regression — §1).

**`tests/editor/shadow-builder.test.tsx`** (`// @vitest-environment jsdom`):
- renders the sticky preview, the layer accordion (≥ 1 card), an expanded card's pad + x/y/blur/spread inputs +
  color picker + inset toggle + remove, the add-layer button, the raw row.
- pad drag (mock `getBoundingClientRect` + pointer capture): emits **one** `onChange` with a normalised,
  clamped value, **nothing** mid-move; the x/y twins update live from `drag`.
- numeric inputs (x/y/blur/spread): don't emit while typing; commit a merged value on blur and Enter; revert
  on Escape; blur clamps negative to 0.
- add layer → one `onChange` with an extra (visible-default) layer; remove → one `onChange`; remove disabled at
  1 layer; add/remove announce via aria-live.
- inset toggle flips `aria-pressed` and emits once with `inset`; color picker black↔token + alpha produce the
  `oklch(0 0 0 / dec)` / `var()` / `color-mix` encodings.
- a raw/un-modellable value (`rgb(...)` layer): renders the dimmed fallback + the raw string in the raw row,
  emits **nothing** on mount; raw-row commit of a valid shadow emits it; raw-row rejects an injection/garbage
  paste on Enter.
- re-seed: changing `value` (block-switch/undo) updates the UI with no stale drag.
- **dark-block disabled state**: with `editingBlock==="dark"` and the `:root`-only token, renders disabled +
  the "switch to Light" message and emits nothing on interaction.
- a11y: every numeric/raw input + the inset toggle + remove buttons have **layer-disambiguated** accessible
  names; the pad SVG + dot are `aria-hidden`; the color grid is a `menu` with `menuitemradio` swatches.

**`tests/editor/control-host.test.tsx`** — assert the `shadow` kind resolves `ShadowBuilder` (and the existing
`never` guard still compiles with `"shadow"` added).

**`tests/editor/control-map.test.ts`** (or existing) — `controlKindForGroup("shadow") === "shadow"`.

**Shared-util regression** — the `resolve-token`/`use-probe-index` suites (which exercise `splitLayers` →
`splitTopLevel`) stay green after the refactor; a focused `css-list.test.ts` covers paren-aware depth-0 split
(inner commas, slashes, nested parens, trailing/empty segments).

**`tests/check` / `tests/tokens`** — the 3 seeds keep `npm run check` green; `npm run tokens` is idempotent on
them (manifest-fresh); the manifest still carries the 3 shadow tokens with group `shadow` + `shadow-*`
utilities.

**`e2e/` (real computed `box-shadow` — jsdom can't compute it)** — `/design-system` Shadow section renders the
`data-token` swatches; selecting one opens the builder; a drag/edit updates the computed `box-shadow`. Plus a
**throwaway shot spec** into `e2e/__shots__/` (gitignored) of the builder (single-layer resting, multi-layer
accordion, a tinted glow, an inset layer, mid-drag if feasible); `Read` the PNGs to self-critique against
`docs/DESIGN-BRIEF.md`; **the user reviews screenshots before this is called done** (function TDD'd; aesthetic
human-checkpointed).

---

## 8. Non-goals / documented limitations

- **Non-black, non-token literal colors** (a raw `oklch(.2 0 0 / .3)` gray, `rgb`/hex/keyword, `currentColor`)
  — not modellable by the black-sentinel + token-ref picker → raw row only (dimmed fallback). Full per-layer
  L/C/H would be scope creep.
- **Leading-color grammar** (`<color> x y blur …`), **`none`**, and `%`/non-px lengths — parse → `null` → raw
  row. The builder emits the canonical `[inset] x y blur spread color` form.
- **Layer reorder** — cut (YAGNI; shadows composite, order rarely changes the read). Add/remove + source order.
- **Extra blur/spread/alpha sliders** — cut; numeric only (the user's call — readable/testable values).
- **Dark-block shadow edits** — disabled by design (§5); the editor-wide light-only-token write limitation is
  unfixed here.
- **`syncGradientUtilities`-style auto-gen** — N/A (shadow needs no `@utility`; `shadow-*` already maps via
  `@theme` from `--elevation-*`).
- **Per-`(name,theme)` status** — inherited M4 limitation, unaffected.

---

## 9. Out-of-scope (YAGNI)

No reorder, no shadow presets library, no import/export, no eyedropper, no per-layer color-space control
(always `in oklch`), no spread/blur curve, no animated shadows, no multi-select of layers. One control, N
layers, black-or-token color, the raw row for the long tail.
