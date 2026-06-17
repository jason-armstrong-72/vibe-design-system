# Figma-style Editor Sidebar — Design Language & Handoff Guide

**Purpose.** A portable spec for building a professional, Figma-inspired **property-editor sidebar**:
dense, dark-first, sectioned, themable.

**How to read this document — it has two clearly separated parts:**

- **Part A — Universal design language.** The look, feel, and UX of the sidebar. Framework- and
  architecture-agnostic. **This is the part to adopt.** Applies to any editor sidebar, including a
  website-builder/design-system tool.
- **Part B — Originating-project context (QA Restyle Tool).** Patterns that exist *because* that tool
  edits **pre-built, captured HTML** by emitting CSS that fights an existing cascade. **These may not
  apply to your tool — and some are actively wrong for a design-system builder.** Read Part B as context,
  not prescription. Each item says when it applies and what to do instead.

> ### ⚠ If your tool edits a DESIGN SYSTEM (not pre-built HTML), read this first
> This guide was distilled from a tool that loads a **finished web page** and restyles it by generating
> CSS selectors that override the page's existing styles. A lot of its machinery — per-edit *scope*,
> "this element vs all look-alikes", CSS *specificity boosting*, cascade-conflict flagging — exists only
> to **win a fight against CSS it doesn't control**.
>
> A **website-builder / design-system tool is the opposite**: you *own* the source of truth. Editing a
> token or a component definition **cascades to everything bound to it by design** — there is no cascade
> to fight, no specificity to escalate, and usually **no need for a per-edit "scope" concept at all**.
> Your "scope" is already expressed by *which layer you edit* (global token → component → instance
> override). So take **Part A wholesale**, and treat **Part B as a list of problems you probably don't
> have.** Don't import scope ladders or specificity logic just because they look powerful here — they'd
> add complexity that your architecture already solves more cleanly.

---

# Part A — Universal design language (adopt this)

## A0. The one rule that matters most

> **A restyle must not change behaviour. Re-skin the surface; leave the model underneath untouched.**

Figma groups properties into categories (Typography / Fill / Stroke / Effects). Those categories are a
**presentation layer** — a *view* over the properties, not a change to what editing them does. Build your
categories the same way: a grouping applied at render time, sitting on top of whatever your real model is
(tokens, components, layers, selectors…). **Never let the visual taxonomy silently rewrite where edits
land or what they affect.**

## A1. Visual language

### A1.1 Density & layout
- **Dense, not sparse.** Tight vertical rhythm. Rows ~28–32px tall. 6px gaps. 12px section padding.
- **Two-up grid** for short controls (size + weight side by side); full-width for long ones (font, colour).
- **Sectioned.** Every group is a collapsible section with a caret + title, divided by a 1px hairline.
- **Right-aligned values.** Labels/icons left, editable value right. Units at the far right, muted.
- **Panel width** ~280–320px. Content scrolls; header/toolbar stays fixed.

### A1.2 Colour tokens
Define **semantic tokens**, theme them once, and have every component consume tokens — never hardcode hex
in components. This is what makes a light/dark toggle a one-line change.

| Token             | Dark            | Light           | Use                                   |
|-------------------|-----------------|-----------------|---------------------------------------|
| `panel`           | `#1e1e1e`       | `#ffffff`       | Sidebar background                    |
| `panel-raised`    | `#252525`       | `#f7f8fa`       | Header/toolbar strip                  |
| `field`           | `#2a2a2a`       | `#f1f3f5`       | Input/field background                |
| `field-hover`     | `#303030`       | `#e9ecef`       | Field hover / segmented active        |
| `border`          | `#333333`       | `#e2e5e9`       | Hairlines, dividers                   |
| `text`            | `#e6e6e6`       | `#1a1a1a`       | Primary text / values                 |
| `text-muted`      | `#8a8a8a`       | `#6b7280`       | Labels, units, captions               |
| `accent`          | `#4f9cf9`       | `#2563eb`       | Selection, focus ring, active state   |
| `accent-soft`     | `#26344a`       | `#dbeafe`       | Accent chip background                 |
| `warn`            | `#f5b454`       | `#b45309`       | "changed / needs attention" markers   |

Swap the accent for your product's brand colour. Keep contrast: muted text ≥ 4.5:1 on `field`.

### A1.3 Type & shape
- System UI stack, 12–13px body, 11px uppercase section labels (letter-spacing ~0.04em), 10px units.
- Monospace for any code-like value (IDs, hex, token names).
- Radius: 6px fields, 5px chips, 10px panel corners. Small and consistent — not pill-round.

## A2. Anatomy of the panel (top → bottom)

```
┌─ Toolbar ───────────────────────────────┐  panel-raised, fixed
│  ◐ theme   ⤓ export   ⊙ ⊙ ⊙ icon-toggles │
├─ Context bar ───────────────────────────┤
│  ● Heading · "Hero title"                │  what's selected (name/type)
├─ Section ───────────────────────────────┤
│  ▾ Typography                            │  collapsible header
│   ┌────────┬────────┐                    │
│   │ Size16 │ Wt 600 │   2-up field grid  │
│   ├────────┴────────┤                    │
│   │ Font: Inter     │   full-width field │
│   └─────────────────┘                    │
│  ▾ Fill                                  │
│  ▾ Stroke …                              │
└──────────────────────────────────────────┘
```

- **Toolbar:** global actions as **icon buttons with tooltips** (theme toggle, export, mode toggles).
  Reserve text buttons for primary/destructive actions only.
- **Context bar:** names the current selection (component name, layer, element type). A small coloured
  dot = type.
- **Sections:** caret + title, optional right-aligned affordance chip. Collapsible; remember open/closed
  state across re-selection (reconcile by position/title, not a key that remounts).

## A3. Control-row patterns (the building blocks)

Every editable property is one **field row**: `[icon/label] [value input] [unit]`.

- **Numeric + unit** — `Size [16] px`. Value editable, unit muted and non-editable. Optional scrub-drag on label.
- **Colour** — inline **swatch** (15px, 4px radius, 1px border) + hex/token input. Swatch opens a picker.
- **Segmented** — for ≤4 mutually-exclusive, iconographic options (alignment L/C/R/J). Active uses `field-hover`.
- **Dropdown** — for many/labelled options (font-weight, border-style). Themed to `field`.
- **Toggle** — boolean (underline on/off). Compact pill switch, right-aligned.
- **Slider** — bounded continuous value; pair with a numeric field showing the exact value.

Rules:
- One interaction per row. Don't stack two editable things except `swatch + value` (they're one value).
- Show the **current/computed value** as the seed so a row is never blank.
- Echo edits live to the preview; debounce persistence (~250ms), apply preview immediately.

## A4. Interaction model

- **Collapsible sections** with persisted open state. Default the most-used sections open.
- **Hover preview / mode toggles** as toolbar icon-toggles with tooltips, not text switches.
- **Theme toggle**: persist to storage, default dark, apply via a class/attribute on the root element so
  all tokens flip at once. Optionally seed the initial default from `prefers-color-scheme`.
- **Empty state**: when nothing is selected, show a centered, muted instruction — not a blank panel.

## A5. Learnings (carry these over)

1. **Tokens over colours.** Theme with semantic variables; components reference tokens only. The toggle
   then costs nothing and stays consistent.
2. **Categories are a view, not a model.** Build a static `propertyId → category` map and group at render
   time. Never reshuffle your underlying data to match the visual buckets.
3. **Disjoint, exhaustive grouping.** Every editable property belongs to exactly one category; categories
   cover the whole catalog. Unit-test this so a new property can't silently fall out of the UI.
4. **Density needs hierarchy.** Dense panels only read well with strong grouping: hairlines, muted section
   labels, consistent 2-up grids. Without hierarchy, dense = cluttered.
5. **Live preview, debounced persist.** Apply edits to the preview instantly; persist on a debounce. Users
   judge a pro tool by latency-to-feedback.
6. **Right-align values, left-align labels.** Scanability. Units muted at the far right.
7. **Icon-toggles need tooltips.** Every icon-only control needs an accessible label + hover tooltip.
8. **Protect your own test handles through a restyle.** If you have UI/e2e tests keyed on structural
   attributes, keep them stable so unchanged passing tests prove the re-skin didn't change behaviour.

## A6. Accessibility

- Icon-only buttons: `aria-label` + visible tooltip on hover/focus.
- Keyboard: sections toggle on Enter/Space; fields tab in DOM order; focus ring uses `accent`.
- Contrast: body and muted text both ≥ 4.5:1 against their background in **both** themes.
- Don't encode meaning in colour alone (chips carry an icon + text, not just a hue).

## A7. Starter token kit (drop-in CSS variables)

```css
:root[data-theme="dark"] {
  --panel:#1e1e1e; --panel-raised:#252525; --field:#2a2a2a; --field-hover:#303030;
  --border:#333; --text:#e6e6e6; --text-muted:#8a8a8a;
  --accent:#4f9cf9; --accent-soft:#26344a; --warn:#f5b454;
}
:root[data-theme="light"] {
  --panel:#fff; --panel-raised:#f7f8fa; --field:#f1f3f5; --field-hover:#e9ecef;
  --border:#e2e5e9; --text:#1a1a1a; --text-muted:#6b7280;
  --accent:#2563eb; --accent-soft:#dbeafe; --warn:#b45309;
}
```

```css
.row{display:flex;align-items:center;gap:6px;background:var(--field);
     border:1px solid transparent;border-radius:6px;padding:4px 8px;font-size:12px}
.row:hover{border-color:var(--border)}
.row .label{color:var(--text-muted);font-size:10px;white-space:nowrap}
.row input{all:unset;flex:1;min-width:0;color:var(--text)}
.row .unit{color:var(--text-muted);font-size:11px}
.swatch{width:15px;height:15px;border-radius:4px;border:1px solid var(--border)}
.section{border-bottom:1px solid var(--border)}
.section > .head{display:flex;align-items:center;gap:6px;padding:8px 12px 5px;
     font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--text)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:2px 12px 11px}
.grid .full{grid-column:1/-1}
.seg{display:flex;background:var(--field);border-radius:6px;padding:2px;gap:2px}
.seg b{flex:1;text-align:center;padding:3px;border-radius:4px;color:var(--text-muted);font-size:12px}
.seg b.on{background:var(--field-hover);color:var(--text)}
```

## A8. Implementer checklist (universal)

- [ ] Semantic tokens for dark + light; components consume tokens only.
- [ ] Theme toggle: persists, defaults dark, flips via root class/attribute.
- [ ] `propertyId → category` map: disjoint + exhaustive (unit-tested).
- [ ] Categories applied at render time — no change to the underlying model.
- [ ] Field rows: numeric+unit, colour swatch+value, segmented, dropdown, toggle, slider — all themed.
- [ ] Collapsible sections with persisted open state.
- [ ] Context bar showing the current selection.
- [ ] Icon-toggles have aria-labels + tooltips.
- [ ] Live preview + debounced persist.
- [ ] Contrast checked in both themes.

---

# Part B — Originating-project context (QA Restyle Tool)

**Read as context, not prescription.** These patterns solve problems specific to editing **pre-built,
captured HTML**. For each, this section states **when it applies** and **what a design-system builder
should do instead**. If you own your design system, expect to **skip most of Part B**.

## B0. The architecture difference (read this before the rest of Part B)

| | QA Restyle Tool (origin) | A design-system / website-builder tool |
|---|---|---|
| Source of truth | A **captured, finished HTML page** it does not own | **Tokens + component definitions** it fully owns |
| How an edit applies | Emits a **CSS selector + rule** that must override the page's existing CSS | Updates a token/component; bindings re-render by design |
| The cascade | An **adversary** to beat (specificity, `!important`, inheritance) | **Yours to define**; no fight |
| "Same look" grouping | **Inferred** from selectors/classes after the fact | **Known** — instances share a component/token by construction |
| Result | Needs scope, specificity-boosting, conflict flagging | Edit once at the right layer; it just propagates |

Everything below flows from the left column. If you're in the right column, the corresponding machinery
is unnecessary.

## B1. Per-edit *scope* and the scope ladder — **probably skip**
- **What it is here:** every edit chooses a *scope* — apply to just this one element, or to every element
  that "looks the same". A "scope ladder" lists reach-ordered selectors (this element → this class → all
  buttons …) with match counts.
- **Why it exists here:** captured HTML has **no reliable component identity**. To change "all buttons"
  you must *infer* a selector that happens to match them, and let the user confirm the reach.
- **Design-system builder instead:** your layers already *are* the scope. Editing the Button component (or
  a `--button-bg` token) changes all buttons **by definition**; editing one instance overrides just it.
  **Don't build a scope ladder** — expose the layer the user is editing (global token / component /
  instance) instead. That's clearer and needs no selector inference.

## B2. CSS specificity boosting & cascade-conflict flagging — **don't port**
- **What it is here:** when an emitted rule loses to the site's existing CSS, the tool escalates
  specificity (a `:not(#_sp)` ladder) until it wins, and flags conflicts it can't safely resolve.
- **Why it exists here:** it's overriding CSS it didn't write and can't edit.
- **Design-system builder instead:** you generate the final CSS/tokens, so **nothing competes with you**.
  Specificity boosting would be solving a problem you don't have. Omit entirely.

## B3. The two-scope split (Text style vs Appearance) — **a product choice built on B1**
- **What it is here:** typography/structural edits default to cascading across the look-alike cluster;
  colour/decorative edits default to *this element only* — so you can recolour one button without dragging
  the whole group.
- **Why it exists here:** it's a usability answer to the scope problem in B1 for users editing shared
  HTML they don't own.
- **Design-system builder instead:** this distinction may be irrelevant. In a token system, "recolour one
  thing" = an instance override; "change the look of all" = edit the token. The *layer* expresses intent,
  so you likely **don't need a two-scope UI** — though you may still group properties visually (Part A).

## B4. Live preview into a captured-HTML iframe + debounced diff-sync — **adapt, don't copy**
- **What it is here:** edits are applied to an `<iframe>` of the captured page via an injected override
  stylesheet for instant feedback, then persisted by diffing against a canonical
  `{selector, property, value}` map.
- **Design-system builder instead:** keep the **principle** (instant preview + debounced persist, A5#5)
  but the mechanism differs — you re-render components from updated tokens/definitions rather than
  injecting override CSS into a foreign document. The canonical-map/selector representation is specific to
  the override approach.

## B5. Preserving e2e/test handles through the restyle — **the principle is universal, the specifics aren't**
- Here the restyle had to keep specific structural handles (`data-section`, scope-ladder toggles, active
  selector markup) stable so the existing behaviour tests kept passing unchanged — proof the re-skin
  changed nothing. **The discipline generalises (A5#8); the exact handles are this project's.**

---

*Origin: distilled from the QA Restyle Tool's editor-sidebar overhaul. Part A is the reusable design
language. Part B documents what made that tool's situation special so a different tool doesn't inherit
machinery it doesn't need.*
