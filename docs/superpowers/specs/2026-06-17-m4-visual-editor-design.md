# M4 — Visual Token Editor — design

**Date:** 2026-06-17
**Status:** Design approved (brainstorm + 3-reviewer pass), pre-plan
**Milestone:** M4 of the design-system-starter (see `docs/specs/2026-06-16-design-system-starter-design.md` §5).
**Depends on:** M1 (`lib/tokens/parse|write|validate`), M2 (`generate`/`sync`, `lib/tokens/regenerate.ts`), M3 (`/design-system` page, `data-token` tags, `lib/tokens/schema.ts`), M3a (`lib/tokens/contrast.ts`, `culori`).

> Detailed design for the editor milestone. Parent spec §5 is authoritative on intent; this refines it
> into the concrete v1 build with brainstorm + review decisions locked in. The figma sidebar design
> language (`docs/figma-style-sidebar-design-language.md`, **Part A only**) governs look/feel. **Part B
> (scope ladders, specificity boosting, cascade-conflict machinery) is NOT adopted** — we own the source
> of truth, so there is no cascade to fight.

---

## 1. What this is

A **dev-only, point-and-click editor** layered over the `/design-system` page. Click any `data-token`
element → a docked panel opens with a group-appropriate control for that token. Editing live-previews
instantly (set the CSS var on the document) and persists (debounced) by rewriting the matching
declaration in `app/globals.css` through a dev-only API route. Because the unit edited is a **token**, the
change ripples everywhere it's used.

**v1 scope: token editing only.** Pick-anywhere (reverse-resolution) stays cut to fast-follow (parent §5).

### Locked decisions (brainstorm + 3-reviewer pass)

1. **Color control = enhanced OKLCH.** OKLCH L/C/H sliders + an `oklch()`/hex text field + live swatch,
   **plus** (a) an **eyedropper** (feature-detected `window.EyeDropper`, sRGB→OKLCH on the way in), (b)
   **click-to-apply swatches of the other existing color tokens** (reuse-a-token; enumerated from the
   manifest), (c) a **read-only WCAG contrast badge** for the token's fg/bg pair (data via `foregroundFor`
   + `lib/tokens/contrast.ts`). Storage stays OKLCH end-to-end (no lossy round-trip; P3 preserved).
2. **Control set: standard set in v1; rich editors deferred.** v1 ships color, length slider, number,
   opacity slider, dropdown, duration slider, and **validated text** controls. **Easing = preset dropdown +
   validated `cubic-bezier()` text field; shadow = validated text field.** The **draggable cubic-bezier
   curve editor and the layered shadow builder are fast-follow** (§7) — only 3 easing + 3 shadow tokens,
   rarely edited, highest build/test cost. Any easing/shadow value is still fully settable via text in v1.
3. **Panel follows selection (model B).** Panel shows the clicked token's control + that token's group
   siblings — NOT a full catalog. The `/design-system` page is the one browse surface.
4. **Docked-right panel; page content reflows** to the remaining width in edit mode (no overlap). Honest
   boundary: the narrower preview width can trip the *edited page's* own responsive breakpoints — see §8.
5. **Editor chrome: light AND dark, both in v1.** Two toolbar controls, kept in the toolbar with a live
   state caption (see §4): **Panel appearance** (cosmetic ☀/☾) and **Editing block** (functional — which
   DS theme block writes land in). Distinct icon vs labelled-chip styling + the caption disambiguate them.
6. **Edit safety in v1:** per-token **reset-to-original** + a visible **save-state indicator**
   (dirty / saving / saved / error). The live-preview loop must be trustworthy and reversible without git.

---

## 2. Architecture

### Two independent token namespaces (load-bearing)

- **Design-system tokens** — `--primary`, `--radius`, `--fs-lg`, … in `app/globals.css`. *What the editor edits.*
- **Editor chrome tokens** — the figma Part A kit (`--panel`, `--panel-raised`, `--field`, `--eborder`,
  `--etext`, `--emuted`, `--eaccent`, `--accent-soft`, `--warn`). Scoped under the editor root and
  **namespaced so they can never collide with or be repainted by** the DS tokens being mutated. Editing
  `--primary` must not restyle the editor. Light + dark value sets per Part A §A7, switched via
  `[data-editor-theme]` on the editor root, persisted to `localStorage`.

### Client island over a server page

`/design-system/page.tsx` stays a server component. M4 adds a **client island**:

- `components/editor/editor-provider.tsx` — client context: `enabled`, `selectedToken`, `editingBlock`
  (`light`|`dark`), `panelAppearance` (`dark`|`light`), and **per-token edit state** holding
  `{ original, current, status: idle|dirty|saving|saved|error, error? }`. `original` powers reset;
  `status` powers the save-state indicator and failed-write rollback. Persists `panelAppearance` to
  `localStorage`.
- The provider wraps the page content and renders the overlay + panel as fixed-position siblings. Page
  markup + `data-token` attributes untouched (test handles stable — Part A #8).
- **Dev gate:** editor entry (toggle, provider activation, API route) is `NODE_ENV !== 'production'`-guarded
  — inert in prod. The page itself still renders in prod as a static style guide; only the edit layer is
  dev-only. (The route handler may still exist in the prod build but 404s; "absent" is satisfied by the guard.)

### Files (proposed)

```
app/design-system/page.tsx          # + mount <EditorMount/> (dev-only) around existing content
app/api/ds/token/route.ts           # dev-only POST writeback (NODE_ENV-guarded) — WRITE ONLY (see §3)
components/editor/
  editor-mount.tsx                  # dev-only wrapper: renders provider+panel+overlay only when NODE_ENV!=prod
  editor-provider.tsx               # client context: edit state, selection, blocks, per-token status, persistence
  edit-toggle.tsx                   # the "Edit" on/off button (dock corner)
  highlight-overlay.tsx             # thin position:fixed hover/selection box; shows token name on hover
  editor-panel.tsx                  # docked-right panel shell (toolbar + context bar + body + empty state)
  panel-toolbar.tsx                 # edit toggle · panel-appearance(☀/☾) · editing-block chip · regenerate? · close
  save-state.tsx                    # dirty/saving/saved/error indicator (context bar + sibling rows)
  controls/
    color-oklch.tsx                 # L/C/H sliders + oklch/hex field + swatch + eyedropper + token-swatches + contrast badge
    length-slider.tsx               # radius/spacing/border/type/container (+ numeric+unit)
    number-field.tsx                # zIndex
    opacity-slider.tsx
    select-field.tsx                # fontFamily / fontWeight
    duration-slider.tsx
    easing-field.tsx                # preset dropdown + validated cubic-bezier() text (rich curve editor = fast-follow)
    text-field.tsx                  # shadow string / font-stack (validated)
  editor-chrome.css                 # Part A token kit, light+dark, namespaced to the editor root
lib/editor/
  control-map.ts                    # TokenGroup -> control component (disjoint + exhaustive)
  oklch.ts                          # thin wrapper over `culori`: oklch() string <-> {l,c,h}; hex<->oklch w/ gamut clamp
  use-token-writeback.ts            # PER-TOKEN debounced POST + immediate setProperty preview + rollback on failure
```

Reuses unchanged: `lib/tokens/{parse,write,validate,schema,regenerate}.ts`, `lib/tokens/contrast.ts`,
`controlForGroup`/`foregroundFor`, the `data-token` attribute, `culori` (already a dep).

---

## 3. Data flow (edit → preview → persist → ripple)

1. **Select.** In edit mode, hovering a `data-token` element draws the highlight overlay (and shows the
   token name); clicking sets `selectedToken` (read `data-token` directly — no selector derivation).
   Selecting seeds the control from the current value and records `original` for reset.
2. **Live preview (immediate, optimistic).** Each control change calls `setProperty` on the target scope:
   - editing the **light** block → set the var on `document.documentElement` (`:root`);
   - editing the **dark** block → add `.dark` to `document.documentElement` (forcing the page into a
     truthful dark preview) and set the var on that **same element** (inline wins over the zero-specificity
     `&:where(.dark, .dark *)` variant). Toggling back to light removes `.dark` and restores `:root` preview.
   Repaint is instant (utilities resolve through `var()` per `@theme inline`; M3a confirmed). Mark the
   token `dirty`.
3. **Persist (per-token debounced ~250ms).** `use-token-writeback` keeps a **map of timers keyed by token**
   so edits to *different* tokens never coalesce/drop (only repeated edits to the *same* token collapse to
   last-write-wins). On fire: mark `saving`, POST `{ token, value, theme }` to `/api/ds/token`.
4. **Server writeback — the route is WRITE-ONLY (the watcher owns regeneration).**
   - `NODE_ENV !== 'production'` guard.
   - **Validate** via `lib/tokens/validate.ts` (type-correct per group + reject `;`/`}`/`{`/comment
     delimiters). Reject any token not already present: *mechanism* — `groupForName` throws for an unknown
     non-color name; for a color-shaped value the **sole** creation guard is `writeToken` throwing
     `token … not found` when the declaration is absent. The route adds a **defensive allowlist check**
     against the current token set (manifest/parsed `:root`) before writing, so a novel color-shaped name
     is rejected with a clear 4xx rather than relying only on the absent-declaration throw.
   - **Write** via `lib/tokens/write.ts` `writeToken` (re-reads first, updates one declaration in the
     correct block, preserves formatting/comments/order, atomic temp+rename).
   - **The route does NOT regenerate the manifest.** `scripts/watch-tokens.ts` (running under `npm run dev`)
     already watches `globals.css` and runs `syncThemeColorMappings` + manifest regen on change. Having the
     route *also* regenerate caused double/triple regeneration and a write-loop (sync can re-write
     `globals.css`, re-firing the watcher). **One manifest-regen owner: the watcher.** (See §6 for how e2e,
     which runs bare `next dev` without the watcher, handles this.)
   - On success → respond 200; client marks `saved` (transient). On 4xx/5xx → client marks `error`, shows
     the server's reason inline, and **rolls the optimistic preview back** to the last persisted value.
5. **Ripple + reseed.** Next dev hot-reload repaints from the rewritten `globals.css`; every element bound
   to the token updates. On hot-reload the provider **reseeds control values from the regenerated
   manifest**, so if the file changed underneath (LLM/human edit) the panel never shows a stale value.

---

## 4. Panel UX (figma Part A, model B)

Docked right, ~312px, light-or-dark chrome. Page reflows to the remaining width.

- **Toolbar** (icon buttons + tooltips). Two deliberately distinct theme controls + a live state caption:
  | Control | Style | Changes | Persisted |
  |---|---|---|---|
  | **Panel appearance** | icon ☀/☾, tooltip "Panel appearance" | cosmetic light/dark of the **editor UI** (`data-editor-theme`) | yes (localStorage) |
  | **Editing block** | labelled chip "Editing: Light ▾ / Dark" + LED | functional — which DS block (`:root`/`.dark`) writes land in + preview reflects | session |
  A live caption echoes current state ("toolbox dark · editing your site's light theme") to prevent the two
  theme concepts from being conflated. Plus: edit on/off, close.
- **Context bar.** `● --name · group · pairs --x-foreground`, with the **save-state indicator** (dirty /
  saving / saved / error using Part A `--warn`/`--eaccent`) and a **reset-to-original** affordance.
- **Focused control** — chosen by the token's group via `controlForGroup` mapped to a component in
  `lib/editor/control-map.ts`:
  | Group | v1 control |
  |---|---|
  | color | OKLCH L/C/H sliders + oklch/hex field + swatch + eyedropper + existing-token swatches + read-only contrast badge |
  | fontSize / lineHeight / radius / borderWidth / spacing / container | length slider + numeric+unit |
  | fontWeight / fontFamily | dropdown |
  | opacity | slider (0–1) |
  | zIndex | number field |
  | duration | slider (ms) |
  | easing | preset dropdown + validated `cubic-bezier()` text field |
  | shadow | validated text field |
- **Active-group siblings** — compact inline-editable rows (same control type, collapsed) for the other
  tokens in the selected token's group; clicking one promotes it to the focused control. No other groups
  listed in the panel.
- **Empty state** — when edit mode is on but nothing is selected: a centered, instructional message
  ("Edit mode on — click any swatch, type sample, or component to edit its token").

> **`ControlType` vs the UI control-map.** `schema.ts` maps `shadow` → `ControlType: "text"` and `easing`
> → `"easing"` (the value/serialization shape). `lib/editor/control-map.ts` is the *UI* map and may be
> richer or simpler than the bare `ControlType` — in v1 it points `easing` at `easing-field.tsx`
> (preset+text) and `shadow` at `text-field.tsx`. The two maps serve different layers; keep them distinct.

### Control-map completeness (Part A #3, mirrors M3's page test)

`lib/editor/control-map.ts` maps **every** `TokenGroup` to exactly one control component — **disjoint and
exhaustive**, unit-tested so a new token group cannot silently fall out of the editor. Deferring the rich
easing/shadow editors must NOT leave a coverage hole: `easing`/`shadow` map to their v1 fallbacks.

---

## 5. Security & safety (parent §5)

- Writeback exists **only** in dev (`NODE_ENV` guard); **local file writes only** to the user's git-tracked
  `globals.css` (diffable, revertible); ships **nothing to prod**; touches no secrets.
- **Input validation is a security boundary.** `value` flows into a CSS declaration; `validate.ts` rejects
  delimiter/injection (`;`, `}`, `{`, comment markers) and enforces per-group shape. Unknown tokens are
  rejected (route allowlist + `writeToken` absent-declaration throw).
- Atomic temp+rename means the watcher/HMR never reads a half-written file. (The rename onto `globals.css`
  is what fires the watcher; the `.tmp` is never watched.) Pre-write re-read means the editor never
  clobbers an external edit.

---

## 6. Testing (TDD, parent §9)

**Unit (vitest):**
- `lib/editor/control-map.ts` — disjoint + exhaustive over all `TokenGroup`s (missing/duplicate fails);
  spot-check group→control, incl. `easing`→easing-field, `shadow`→text-field.
- `lib/editor/oklch.ts` — `oklch()` ⇄ `{l,c,h}` round-trips; hex⇄oklch within tolerance + gamut clamp
  (via `culori`); malformed input handled.
- API route — `NODE_ENV` guard; good value writes to the correct block; bad value / injection / unknown
  (allowlist) all **rejected** without writing; **route does NOT regenerate** (assert manifest untouched by
  the route alone). Per-token debounce: edits to two tokens both persist (no coalescing).

**e2e (Playwright):** *Harness note —* `playwright.config.ts` runs **bare `next dev`** (no watcher), so the
manifest is not auto-regenerated in CI. Either (a) point the e2e `webServer.command` at `npm run dev` so the
real dev topology (watcher = regen owner) is exercised, or (b) have the test trigger `npm run tokens`
explicitly after the write and assert on that. **Decide in the plan;** prefer (a) so tests match real dev.
Use `expect.poll`/`toPass` to await hot-reload settling — never fixed timeouts (cf. M3a's timing bug).
- Enable Edit → click `--primary` → drag the L slider → assert **live repaint** (computed color changes,
  instant) → assert `globals.css` rewritten → assert a **second element** bound to `--primary` ripples →
  assert the manifest regenerated (under the chosen harness).
- **Editing-block** = Dark → an edit writes to the `.dark` block (a dark-only value differs from light) and
  the forced-`.dark` preview overrides correctly.
- **Panel-appearance** flips `data-editor-theme`, persists across reload; both chrome themes meet Part A
  contrast (muted ≥ 4.5:1 on field).
- **Reset** returns a token to its on-select value (preview + file). **Save-state**: a rejected value shows
  `error` + reason and the preview rolls back (no file change).

---

## 7. Out of scope (fast-follow)

- **Draggable cubic-bezier curve editor** (v1: preset + text).
- **Layered shadow builder** (v1: validated text).
- **Pick-anywhere** (reverse-resolution from any app element to its tokens).
- **Gradient builder** control.
- **Editing app pages other than `/design-system`** (the provider could wrap any dev page later).
- A standalone **contrast-warning** workflow beyond the read-only badge (e.g. blocking/suggesting fixes).

---

## 8. Honest boundaries

- **Reflow preview width.** Docked-right reflow shrinks the page to the remaining width, so the page's own
  responsive breakpoints may trip under that narrower width — the preview is not full-viewport-faithful.
  Surface the current effective preview width in the panel and note this; full-fidelity preview (overlay
  mode / detach) is a possible fast-follow.
- **Dark-block preview** forces the page into `.dark` while the dark block is the edit target — a deliberate
  preview mode, not persisted app state (the shipped app has no dark toggle; see M3a notes).
- **One manifest-regen owner = the watcher.** The editor route writes `globals.css` only; regeneration is
  the watcher's job under `npm run dev`. e2e reconciles per §6. This avoids the double-regen/write-loop the
  review caught.
- **The page is a server component**; the editor is a client island. Edits live-preview via runtime
  `setProperty`; the *persisted* truth is `globals.css`, surfaced on the next hot-reload — consistent with
  the parent architecture (CSS vars are the source of truth; the editor is one of three consumers).
