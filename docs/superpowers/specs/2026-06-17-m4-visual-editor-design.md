# M4 — Visual Token Editor — design

**Date:** 2026-06-17
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** M4 of the design-system-starter (see `docs/specs/2026-06-16-design-system-starter-design.md` §5).
**Depends on:** M1 (`lib/tokens/parse|write|validate`), M2 (`generate`/`sync`, `lib/tokens/regenerate.ts`), M3 (`/design-system` page, `data-token` tags, `lib/tokens/schema.ts`).

> This is the detailed design for the editor milestone. The parent spec §5 is authoritative on intent;
> this refines it into the concrete v1 build, with the decisions made during brainstorming locked in.
> The figma-style sidebar design language (`docs/figma-style-sidebar-design-language.md`, **Part A only**)
> governs the editor's look/feel. **Part B (scope ladders, specificity boosting, cascade-conflict
> machinery) is deliberately NOT adopted** — we own the source of truth, so there is no cascade to fight.

---

## 1. What this is

A **dev-only, point-and-click editor** layered over the `/design-system` page. Click any `data-token`
element → a docked panel opens with a group-appropriate control for that token. Editing live-previews
instantly (set the CSS var on the document) and persists (debounced) by rewriting the matching
declaration in `app/globals.css` through a dev-only API route, then regenerating the manifest. Because the
unit edited is a **token**, the change ripples everywhere it's used.

**v1 scope: token editing only.** Pick-anywhere (reverse-resolution from a computed style back to a token)
stays cut to fast-follow, per parent §5 — everything worth editing on the page is already `data-token`-tagged.

### Locked decisions (from brainstorming)

1. **Color control = custom OKLCH L/C/H sliders** + an `oklch()`/hex text field + a live swatch. Matches
   the storage format end-to-end (no lossy RGB↔OKLCH round-trip, P3 gamut preserved).
2. **Full control set**, including a **draggable cubic-bezier easing editor** and a **layered shadow
   builder** (not just simplified inputs).
3. **Panel follows selection (model B).** The panel shows the clicked token's control + that token's
   group siblings — NOT a full catalog of every group. The `/design-system` page is the one browse
   surface; the panel is the contextual editor. (Rejected model A = panel mirrors the whole page →
   duplicative second browse surface.)
4. **Docked-right panel; page content reflows** to the remaining width in edit mode (no overlap).
5. **Editor chrome supports light AND dark** (both in v1), independent of the design-system theme. Two
   visually-distinct toolbar controls (see §4): **Panel appearance** (cosmetic; ☀/☾) and **Editing block**
   (functional; which DS theme block writes land in).

---

## 2. Architecture

### Two independent token namespaces (load-bearing)

- **Design-system tokens** — `--primary`, `--radius`, `--fs-lg`, … in `app/globals.css`. *What the editor
  edits.*
- **Editor chrome tokens** — the figma Part A kit (`--panel`, `--panel-raised`, `--field`, `--eborder`,
  `--etext`, `--emuted`, `--eaccent`, `--accent-soft`, `--warn`). Scoped under the editor root element and
  **prefixed/namespaced so they can never collide with or be repainted by** the DS tokens the editor is
  mutating. Editing `--primary` must not restyle the editor itself. These live in the editor's own CSS
  (e.g. `components/editor/editor-chrome.css` or a scoped block), with `[data-editor-theme="dark"]` and
  `[data-editor-theme="light"]` value sets straight from Part A §A7.

### Client island over a server page

`/design-system/page.tsx` stays a server component (renders tokens + showcase as today). M4 adds a
**client island**:

- `components/editor/editor-provider.tsx` — a client context holding edit state: `enabled`,
  `selectedToken`, `editingBlock` (`light`|`dark`), `panelAppearance` (`dark`|`light`), per-token dirty/
  pending state. Persists `panelAppearance` (and optionally `enabled`) to `localStorage`.
- The provider wraps the page content and renders the **overlay** + **panel** as fixed-position siblings.
  The page markup and its `data-token` attributes are untouched (test handles stay stable — Part A #8).
- **Dev gate:** the editor entry (toggle button, provider activation, the API route) is guarded so it is
  inert/absent in production (`process.env.NODE_ENV !== 'production'`). The page itself still renders in
  prod as a static style guide; only the *edit* layer is dev-only.

### Files (proposed)

```
app/design-system/page.tsx          # + mount <EditorMount/> (dev-only) around existing content
app/api/ds/token/route.ts           # dev-only POST writeback (NODE_ENV-guarded)
components/editor/
  editor-mount.tsx                  # dev-only wrapper: renders provider+panel+overlay only when NODE_ENV!=prod
  editor-provider.tsx               # client context: edit state, selection, blocks, persistence
  edit-toggle.tsx                   # the "Edit" on/off button (dock corner)
  highlight-overlay.tsx             # thin position:fixed hover/selection box over data-token els
  editor-panel.tsx                  # docked-right panel shell (toolbar + context bar + body)
  panel-toolbar.tsx                 # edit toggle · panel-appearance · editing-block · regenerate · close
  controls/
    color-oklch.tsx                 # L/C/H sliders + oklch/hex field + swatch
    length-slider.tsx               # radius/spacing/border/type/container (+ numeric+unit)
    number-field.tsx                # zIndex
    opacity-slider.tsx
    select-field.tsx                # fontFamily / fontWeight
    duration-slider.tsx
    easing-bezier.tsx               # draggable cubic-bezier curve + preset dropdown
    shadow-builder.tsx              # layered shadow rows (offset/blur/spread/color/inset)
    text-field.tsx                  # shadow string / font-stack (validated)
  editor-chrome.css                 # Part A token kit, light+dark, namespaced to the editor root
lib/editor/
  control-map.ts                    # TokenGroup -> control component (disjoint + exhaustive)
  oklch.ts                          # parse/format oklch() <-> {l,c,h}; hex<->oklch for the hex field
  use-token-writeback.ts            # debounced POST + live setProperty preview
```

Reuses M1–M3 unchanged: `lib/tokens/{parse,write,validate,schema,regenerate}.ts`, the `data-token`
attribute, `controlForGroup`/`foregroundFor`.

---

## 3. Data flow (edit → preview → persist → ripple)

1. **Select.** In edit mode, hovering a `data-token` element draws the highlight overlay; clicking sets
   `selectedToken` (read the `data-token` attribute directly — no selector derivation).
2. **Live preview (immediate).** Each control change calls `setProperty` on the target scope:
   - editing the **light** block → set the var on `document.documentElement` (`:root`);
   - editing the **dark** block → set the var on the `.dark` scope (the page is forced into `.dark` while
     that block is active so the preview is truthful).
   Repaint is instant; no rebuild.
3. **Persist (debounced ~250ms).** `use-token-writeback` POSTs `{ token, value, theme }` to
   `/api/ds/token`. Preview already applied; persistence is the slow path.
4. **Server writeback (the route owns the sequence).**
   - `NODE_ENV !== 'production'` guard (404/no-op in prod).
   - **Validate** with `lib/tokens/validate.ts` (`validateValue(groupForName(name,value), value)`):
     type-correct for the token's group, and reject `;`/`}`/`{`/comment delimiters (CSS injection).
     Reject any `token` not already present in `globals.css` (the editor edits; it does not create —
     creation is the LLM/human extension path). *Mechanism (two layers, both already in M1):*
     `groupForName` throws for an unknown non-color name, and `writeToken` throws `token … not found`
     when the declaration is absent from the target block — so an unknown/absent token can never be
     written. The route surfaces either as a 4xx.
   - **Write** with `lib/tokens/write.ts` `writeToken` (re-reads the file first, updates exactly one
     declaration in the correct block, preserves formatting/comments/order, atomic temp+rename).
   - **Regenerate** the manifest via `lib/tokens/regenerate.ts` `syncAndGenerate`. Write-then-regenerate
     ordering lives in the route.
5. **Ripple.** Next dev hot-reload repaints from the rewritten `globals.css`; every element bound to the
   token updates for free. The committed `globals.css` + manifest are the persisted result (diffable,
   revertible — they're the user's own git-tracked files).

---

## 4. Panel UX (figma Part A, model B)

Docked right, ~312px, dark-or-light chrome. Page reflows to the remaining width.

- **Toolbar** (icon buttons + tooltips; Part A A2). Two deliberately distinct theme controls:
  | Control | Style | Changes | Persisted |
  |---|---|---|---|
  | **Panel appearance** | icon ☀/☾, tooltip "Panel appearance" | cosmetic light/dark of the **editor UI** (`data-editor-theme`) | yes (localStorage) |
  | **Editing block** | labelled chip "Editing: Light ▾ / Dark" + LED | functional — which DS block (`:root`/`.dark`) writes land in + preview reflects | session |
  Plus: edit on/off, regenerate-manifest, close. A live caption echoes current state to prevent the two
  theme concepts from being conflated.
- **Context bar.** `● --name · group · pairs --x-foreground` (the fg/bg partner from `foregroundFor`).
- **Focused control** — chosen by the token's group via `controlForGroup` (`lib/tokens/schema.ts`) mapped
  to a component in `lib/editor/control-map.ts`:
  | Group | Control |
  |---|---|
  | color | OKLCH L/C/H sliders + oklch/hex field + swatch |
  | fontSize / lineHeight / radius / borderWidth / spacing / container | length slider + numeric+unit |
  | fontWeight / fontFamily | dropdown |
  | opacity | slider (0–1) |
  | zIndex | number field |
  | duration | slider (ms) |
  | easing | draggable cubic-bezier curve editor + preset dropdown |
  | shadow | layered shadow builder (offset-x/y, blur, spread, color, inset; add/remove layers) |
- **Active-group siblings** — compact rows for the other tokens in the selected token's group, so related
  values can be nudged without returning to the page. No other groups are listed in the panel.

> **Note on `shadow`:** `schema.ts` maps `shadow` to `ControlType: "text"` (the serialization shape).
> The editor's UI component for it is the richer **`shadow-builder.tsx`** — `control-map.ts` (the UI map)
> is allowed to be richer than the bare `ControlType`. The two maps serve different layers: `ControlType`
> describes the value shape; `control-map.ts` picks the component. Keep them distinct in the plan.
- **Empty state** — when edit mode is on but nothing is selected, a centered muted instruction (Part A A4).

### Control-map completeness (Part A #3, mirrors M3's page test)

`lib/editor/control-map.ts` maps **every** `TokenGroup` to exactly one control component — **disjoint and
exhaustive**, unit-tested so a newly-added token group cannot silently fall out of the editor.

---

## 5. Security & safety (parent §5)

- Writeback exists **only** in dev (`NODE_ENV` guard); performs **local file writes only** to the user's
  own git-tracked `globals.css` (diffable, revertible); ships **nothing to prod**; touches no secrets.
- **Input validation is a security boundary, not hygiene.** `value` flows into a CSS declaration;
  `validate.ts` already rejects delimiter/injection (`;`, `}`, `{`, comment markers) and enforces the
  per-group value shape. Unknown tokens are rejected (no creation via the editor).
- The atomic temp+rename in `write.ts` means the Next watcher never reads a half-written file; the
  pre-write re-read means the editor never clobbers an external edit (LLM/human editing the same file).

---

## 6. Testing (TDD, parent §9)

**Unit (vitest):**
- `lib/editor/control-map.ts` — disjoint + exhaustive over all `TokenGroup`s (a missing/duplicate mapping
  fails); spot-check group→control choices.
- `lib/editor/oklch.ts` — `oklch()` string ⇄ `{l,c,h}` round-trips; hex⇄oklch within tolerance; malformed
  input handled.
- API route — `NODE_ENV` guard (no-op/404 in prod); good value writes to the correct block; bad value
  (wrong type), injection value (`red;}…`), and unknown token are all **rejected** without writing;
  write-then-regenerate ordering (manifest reflects the new value after a successful write).

**e2e (Playwright):**
- Enable Edit → click `--primary` → drag the L slider → assert **live repaint** (computed color changes) →
  assert `globals.css` rewritten (the declaration changed) → assert a **second element** bound to
  `--primary` ripples → assert the manifest regenerated.
- **Editing-block** toggle set to Dark → an edit writes to the `.dark` block (not `:root`).
- **Panel-appearance** toggle flips `data-editor-theme` and persists across reload; both chrome themes
  meet Part A contrast (muted text ≥ 4.5:1 on field).
- Off-token / injection value entered in a control is rejected by the API (no file change).

---

## 7. Out of scope (fast-follow, per parent §5/§10)

- **Pick-anywhere** (reverse-resolution from any app element to its tokens).
- **Gradient builder** control.
- **Contrast warnings in the editor** (the fg/bg pairing + the M3a `lib/tokens/contrast.ts` make this
  cheap later — surface a WCAG warning on a failing edit).
- Editing app pages other than `/design-system` (the provider could wrap any dev page later).

---

## 8. Honest boundaries

- **Dark-block preview** forces the page into `.dark` while the dark block is the edit target — a deliberate
  preview mode, not a persisted app state (the shipped app has no dark toggle; see M3a notes). Toggling
  back to the light block restores `:root` preview.
- **The page is a server component**; the editor is a client island. Edits live-preview via runtime
  `setProperty`; the *persisted* truth is `globals.css`, surfaced on the next hot-reload — consistent with
  the parent architecture (CSS vars are the source of truth; the editor is one of three consumers).
