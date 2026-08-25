# Design System — Manual Testing Guide

Work through this top to bottom. Log every friction point, gap, or "I wish it did X" as a GitHub issue as you go. Don't fix anything inline — capture and keep moving.

---

## 0. Setup

```bash
npm install
npm run dev
```

Open **<http://localhost:3000/design-system>** and **<http://localhost:3000/pricing>** in separate tabs.

Verify `npm run check` passes clean before starting.

---

## 1. Token system

**Goal:** confirm tokens are coherent and the gate catches violations.

- [ ] Open `app/globals.css`. Scan `:root` — do all token names feel intentional and correctly grouped?
- [ ] Open `design-system.md`. Is every token documented? Any obviously missing (e.g. `--font-display`, `--elevation-*`)?
- [ ] **Break the gate on purpose:** add `color: red;` somewhere in a component. Run `npm run check`. Confirm it fails and the error is clear. Revert.
- [ ] **Extend the system:** follow the procedure in `design-system.md` to add a new color token (e.g. `--promo`). Add to both `:root` and `.dark`, run `npm run tokens`. Confirm it appears in `design-system.md` and on `/design-system`. Then remove it.
- [ ] Dark mode: does every token have a sensible dark override? Toggle dark mode on the page (add `class="dark"` to `<html>` in browser devtools) and scan for anything that looks wrong — low contrast, missing color, inverted intent.

---

## 2. Component showcase (`/design-system`)

Walk every section. For each component:

- [ ] Does it render correctly?
- [ ] Does it respond to the active theme?
- [ ] Does it look right in dark mode?
- [ ] Does it work on mobile width (resize to 375px)?

**Components to pay extra attention to:**

| Component | What to check |
| --- | --- |
| Button | All variants + sizes + disabled state |
| Dialog | Width at different viewport sizes; focus trap; close on Escape |
| Select / Combobox | Keyboard nav; dropdown position near viewport edges |
| Calendar / Date picker | Month nav; date selection; disabled dates |
| Toast / Sonner | Stacking; auto-dismiss; positioning |
| Data table | Sort; empty state; overflow on narrow viewports |
| Form inputs | Focus ring; error state; disabled state |
| Badge / Alert | All variants present and semantically distinct |
| Avatar | Fallback initials when no image |
| Carousel | Arrow nav; touch swipe on mobile |

Note: if a component is in `components/ui/` but **not** shown in the showcase, that's a gap.

---

## 3. Theming

- [ ] Switch to **Swiss** theme: do all components re-skin correctly? Anything that still looks "neutral"?
- [ ] Switch to **Brutalist** theme: same check. Bold borders, high contrast intentional?
- [ ] Toggle dark mode on each theme. Any combination that looks broken?
- [ ] Confirm theme switching in the showcase happens without a page reload (if wired up).

---

## 4. Visual editor

Open the editor panel on `/design-system` (Edit button, bottom-right).

- [ ] **Color control:** edit `--primary`. Does the page update live? WCAG badge show correct contrast? Auto-fix button work?
- [ ] **Spacing/radius control:** edit `--radius`. Do corners update across all components simultaneously?
- [ ] **Duration control:** edit `--duration-fast`. Does animation speed visibly change on transitions/modals?
- [ ] **Opacity control:** edit `--muted-foreground` opacity. Live update?
- [ ] **Number field:** stepper buttons increment/decrement correctly?
- [ ] **Undo/redo:** make 3 edits, Cmd+Z back through all 3, Cmd+Shift+Z forward again.
- [ ] **Save:** make a change, wait 250ms, confirm `globals.css` is actually written to on disk.
- [ ] **Light/dark toggle:** switch theme blocks mid-edit. Does the page switch appearance? Does editing one block leave the other untouched?
- [ ] **Reset:** edit a token, hit Reset, confirm it reverts to session-open value.
- [ ] After an editing session: run `npm run tokens`. Does it complete without error?

**Controls not yet implemented (skip, note as known gaps):**

- Easing/cubic-bezier editor
- Shadow builder
- Pick-mode eyedropper / per-element token list

---

## 5. Existing pages

### `/pricing`

- [ ] Three plans render: Starter, Pro, Team
- [ ] Pro card visually dominates — eye lands on it first
- [ ] Cards stack correctly on mobile (375px)
- [ ] "Get started" buttons work (or are plausibly wired)
- [ ] Re-skin under Swiss and Brutalist themes — does it hold up?
- [ ] Dark mode — any contrast issues?

### `/design-system`

- [ ] Page loads without console errors
- [ ] All showcase sections render
- [ ] Container widths feel right at all breakpoints

---

## 6. Build gate

```bash
npm run verify
```

- [ ] Passes clean
- [ ] If it fails, note the failure type — is the error message clear enough to act on?

---

## 7. Real build exercise

Pick a page type you'd actually build for a client. Build it from scratch using only the design system — no hardcoded values.

**Suggested options (pick one):**

- Landing page: hero + features grid + CTA + footer
- Dashboard: sidebar nav + stats cards + data table + chart placeholder
- Auth flow: sign-in form + sign-up form + forgot password
- Marketing email-style page: full-width hero, testimonials, pricing summary

**As you build, log every time you:**

- Can't find a token that fits the semantic need
- Reach for a component that doesn't exist
- Have to fight the system to get a layout to work
- Notice a component behave unexpectedly
- Feel uncertain whether you're using the system correctly

These friction points are the most valuable output of this exercise.

---

## 8. After testing — log findings

For each gap or friction point found:

1. Open a GitHub issue with label `bug` or `enhancement`
2. One issue per finding — don't bundle
3. Include: what you expected, what happened, which component/token/page

Then prioritise the issue list and work from there.
