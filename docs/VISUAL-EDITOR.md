# Visual Token Editor — How-To Guide

> **Status: work in progress.** Core editing controls (color, spacing/radius/font-size, duration, opacity, numbers) are implemented. Remaining controls — easing/cubic-bezier editor, shadow builder, pick-mode eyedropper, per-element token list — are planned for a near-future pass. The editor is usable now for the implemented token types.

The design system ships a built-in visual editor for live token editing. It runs **in development only** and writes directly to `app/globals.css`.

---

## Starting the editor

1. Open **http://localhost:3000/design-system** (dev server must be running).
2. Click the **Edit** button fixed to the bottom-right corner of the page.
3. The editor panel appears docked on the right side.

---

## Selecting a token to edit

**Method 1 — Direct click**
Hover over any element on the page. Elements with design tokens show a thin outline. Click to select; the panel updates to show that token's controls.

**Method 2 — Eyedropper / pick mode**
1. Click the eyedropper icon in the panel toolbar.
2. Cursor becomes a crosshair. Click any element on the page.
3. A menu lists all tokens that apply to that element.
4. Click a token in the menu to start editing it.
5. Press **Escape** to exit pick mode without selecting.

---

## Changing a value

Controls are matched to the token type:

| Token type | Control |
|---|---|
| Colors | OKLCH sliders (Lightness / Chroma / Hue), hex input, screen eyedropper (Chromium only) |
| Spacing / radius / font size | Slider + number field + unit selector (rem / px / em / %) |
| Durations | Millisecond slider |
| Opacity | 0–1 slider |
| Easing | Cubic-bezier editor |

**Sliders and dropdowns:** apply immediately — the page updates live.  
**Text fields:** commit on **blur** or **Enter**.

---

## Light vs. dark theme

The toolbar shows a **Light** or **Dark** chip indicating which theme block you are editing.

- Click the chip to toggle between themes.
- The page switches appearance to match, so your preview is always accurate.
- **Light** edits write to `:root { … }` in `globals.css`.
- **Dark** edits write to `.dark { … }` in `globals.css`.
- The two blocks are independent — editing one does not affect the other.

The color control shows a **WCAG contrast badge** for both blocks simultaneously, with an auto-fix button when contrast falls below AA.

---

## Saving

Changes save automatically — no save button needed.

1. Edit a token → the CSS variable updates on the page instantly.
2. After **250 ms** of inactivity, the editor posts the change to the dev API.
3. The panel header shows status: `dirty` → `saving…` → `saved` (or `error` with a message, which reverts the value).

> **After an editing session:** run `npm run tokens` to resync the generated token manifest. The CSS file is already updated; this step regenerates derived artifacts (design-system.md, component catalog, etc.).

---

## Undo and redo

| Action | Keyboard | Button |
|---|---|---|
| Undo | Cmd+Z (Mac) / Ctrl+Z (Win/Linux) | ← in panel header |
| Redo | Cmd+Shift+Z (Mac) / Ctrl+Shift+Z (Win/Linux) | → in panel header |

Notes:
- Keyboard shortcuts work when focus is **not** inside a text field (to allow native field undo).
- Slider drags coalesce into a single history entry.
- Undoing a change in the opposite theme automatically switches the editing block.
- History is linear — making a new edit discards any redo branch.

---

## Resetting a token

The **Reset** button in the panel header reverts the selected token to its value from when you first opened the editor this session. The reset itself is undoable.
