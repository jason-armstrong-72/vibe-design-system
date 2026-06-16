# Design System Starter — design

**Date:** 2026-06-16
**Status:** Design approved, pre-implementation
**Code home:** New standalone GitHub repo (not `website-editor`). This spec lives in `website-editor/docs`
for continuity; the implementation plan will target the new repo.

> This is a **new product**, distinct from the QA Restyle Tool (`website-editor`). It shares ideas
> (visual editing, a canonical token model, a write-back seam) and reuses a small amount of code (a
> highlight overlay), but it is greenfield with a different user and a different job.

---

## 1. What this is

A **design-system starter template** — shipped as a GitHub template repo — for people building a website
or SaaS app **with an LLM** (vibe coders). The template gives them, from line one:

1. A complete, opinionated **token set** (the design system) as the single source of truth.
2. A **visual design-system page** — a living style guide that renders every token and component.
3. A **built-in visual editor** (dev-only) to edit tokens point-and-click; edits ripple everywhere.
4. An **LLM contract** (rules + enforcement) so the LLM builds *with* the design system and *extends* it
   correctly instead of hardcoding one-off values.

The design system is the **single source of truth**, and three consumers read/write it: the **app**
(renders from it), the **editor** (writes to it), the **LLM** (reads it to build, respects it to stay
consistent).

### Scope decision: greenfield only

The tool is for **starting clean** — install the template, then build on it (with or without an LLM).
A **retrofit** path (point the tool at an already-built app and adopt tokens into existing, messy,
hardcoded source) is explicitly **out of scope**. Retrofit reintroduces the hardest problem — reliably
rewriting arbitrary third-party source — which greenfield avoids by *owning the template's structure*.
A future LLM-assisted "tokenize my existing styles" pass could be a separate later project; it is not
this one.

### Non-goals (v1)

- No live-site capture / snapshot (that is `website-editor`'s job).
- No source rewriting of arbitrary external codebases.
- No `npx create-*` CLI in v1 (template repo + "Use this template" / `npx degit` only; CLI is a
  fast-follow — see §11).
- No multi-framework support — one stack, done properly (§7).

---

## 2. Architecture — the one idea

CSS custom properties in `app/globals.css` are the **single source of truth**. Everything reads or writes
them. The LLM-facing manifest is **generated** from them (one-directional, never the reverse).

```
                  globals.css  (CSS vars = SOURCE OF TRUTH)
                   ▲      ▲                 │
        edit (write)│      │read         render│
                   │      │                 ▼
   ┌───────────────┘      └──────┐    ┌──────────────────┐
   │  Editor (dev-only)          │    │  The app          │
   │  /design-system route,      │    │  pages +          │
   │  control panels + thin      │    │  components,      │
   │  highlight overlay,         │    │  runtime-themed   │
   │  writeback API              │    │  via CSS vars     │
   └─────────────────────────────┘    └──────────────────┘
                   │ generate (cold path, on save)
                   ▼
       design-system.md  +  design-system.json   (LLM contract, derived)
                   ▲
                   │ read (build) / respect (lint)
              ┌────┴─────┐
              │   LLM    │
              └──────────┘
```

### The three loops

1. **Editor loop** — edit a token on the design-system page → writeback rewrites `globals.css` →
   Next hot-reload repaints. **Runtime, zero build step on the hot path.**
2. **App loop** — every component consumes CSS vars (via Tailwind utilities or `var(--x)`), so a token
   change ripples everywhere it is used, for free.
3. **LLM loop** — reads the generated manifest to build with tokens; a **blocking lint** stops hardcoded
   drift; an **extension procedure** makes it *add* tokens when the system lacks one. Added tokens
   auto-appear on the design-system page → become editable. The loop self-closes.

### Why CSS vars are the source of truth (not a JSON manifest)

The editor needs **runtime** value changes — set a var, repaint *now*, no rebuild. CSS custom properties
give this natively; tokens living only in `tailwind.config` (build-time) would force a rebuild per edit
and kill the live-editing feel. So CSS vars **must** exist at runtime regardless. Making them the
*authored* source keeps the hot path (edit → repaint) zero-step and pushes generation (the LLM doc) onto
the cold path (on save), where latency does not matter. A JSON-as-truth model would insert a
generate-CSS step between every edit and repaint — the wrong tradeoff.

---

## 3. Token set (v1)

Extended-but-curated. Authored as CSS vars under `:root` (light) and `.dark` (dark). Token **names are
the contract** — the stable API the editor, lint, and LLM all key on; v1 fixes a documented naming
convention.

**Color**
- shadcn semantic set: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`,
  `--destructive`, `--border`, `--input`, `--ring`, plus their `*-foreground` pairs.
- **Status (fills shadcn's biggest gap):** `--success`, `--warning`, `--info` + foregrounds. Prevents the
  most common day-one drift (LLM hardcoding a green/amber).
- **Brand ramp:** a small extensible scale for brand color.
- **Chart palette:** `--chart-1 … --chart-5` (shadcn-standard; SaaS dashboards need it).

**Typography**
- Families: `--font-sans`, `--font-mono` (+ `--font-serif` if the template uses one).
- Type scale: `--text-xs … --text-4xl`. Weights. Line-heights.

**Spacing** — `--space-1 … --space-12`.

**Radii** — `--radius` (shadcn keys off this) + `--radius-sm/md/lg`.

**Border widths** — `--border-width-thin/base/thick`.

**Shadows** — `--shadow-sm/md/lg`.

**Transitions** — `--duration-fast/base/slow`, `--ease-standard/in/out`.

**Animation primitives** — durations + easings above drive a small named-animation set (fade, slide,
scale, accordion) shipped via `tailwindcss-animate`. **The keyframe shapes are NOT editable tokens** —
a `@keyframes` rule cannot be stored in a CSS custom property. Only their **timing** (duration/easing)
is token-editable and ripples through all animations. The design-system page shows live animation demos
so they are visible even though their shape is code-only.

**Z-index** — `--z-dropdown/sticky/modal/toast`.

**Opacity** — `--opacity-disabled/muted`.

**Container/layout widths** — `--container-sm/md/lg` + content gutter.

**Breakpoints — documented, NOT runtime-editable.** CSS media queries cannot reliably read CSS vars for
breakpoints, so breakpoints live in `tailwind.config`, are surfaced in the manifest as reference, but are
not editable tokens. Honest boundary — surfaced, not faked.

**fg/bg pairing.** Color tokens that form a foreground/background pair are modeled as pairs in the token
schema now, so a **contrast check** (WCAG) can be added as a fast-follow (§10) without re-modeling.

### Tailwind wiring

`tailwind.config.ts` maps utilities → vars (`colors.primary = 'hsl(var(--primary))'`, `spacing`,
`fontSize`, `boxShadow`, `borderWidth`, `zIndex`, etc.), the shadcn-standard pattern extended to the new
scales. So `bg-primary`, `text-lg`, `p-4`, `shadow-md`, `rounded-lg`, `border-thick` all resolve to vars
at runtime.

---

## 4. The design-system page

A route, `/design-system`, that renders the whole system from the tokens — a living style guide.

- **Token reference sections auto-iterate the token set** (colors, type, spacing, radii, borders,
  shadows, transitions, z-index, opacity, containers). Truthful by construction; never goes stale. When
  a token is added (by the LLM or a human), it **auto-appears** here and becomes editable.
- **Component showcase is hand-authored** — the shadcn component set (buttons, inputs, cards, dialogs,
  alerts, toasts, tabs, badges, forms, …) in their variants, all themed by the tokens above. Component
  demos cannot be meaningfully auto-generated; this section is curated.
- **Every editable element is tagged `data-token="--primary"`** (or maps to a token group). The editor
  reads this attribute directly — **no selector derivation, no guessing** (the fragile core of
  `website-editor`'s picker is unnecessary here and deliberately omitted; see §6/§9).
- **Animation demos** play using the timing tokens.

**Production:** the route is dev/showcase. Gated behind a config flag; default **on in dev**, can be
excluded from the prod build (or kept as internal docs).

---

## 5. The editor (dev-only)

A dev-only edit layer over the design-system page (and, secondarily, any app page in dev). Modeled on the
proven `aws_agent` prototype interaction (panel + live preview + writeback), **rebuilt properly** to
remove that prototype's tech debt.

### Two edit paths

1. **Token editing (primary).** Click a `data-token` element → a control panel for *that token* opens.
   The **control type is derived from the token group**: color picker for colors, slider for
   spacing/radii/border-widths, dropdown for font families, an easing-curve control for transitions,
   etc. Changing a value:
   - sets the CSS var on `document.documentElement` for **instant live preview** (`setProperty`);
   - on commit, **writeback** rewrites the matching declaration in `globals.css`.
   Because the unit edited is a **token**, the change ripples everywhere it is used. No selector
   derivation — the click maps to a known token.

2. **Pick-anywhere (secondary).** On a real app page in dev, hover/click any element. The editor resolves
   which token(s) drive its computed styles and offers to edit those tokens. If the element uses a
   **hardcoded value** (drift), the editor **flags it** ("not tokenized") rather than silently patching —
   surfacing drift instead of hiding it (same philosophy as `website-editor`'s conflict-flagging).

   **Reverse-resolution is the riskiest part of M4** and the v1 bar is deliberately modest. Mapping a
   computed style back to a token is not always 1:1 — a computed `hsl(...)` may match several tokens, or
   match none (e.g. after `color-mix()` / opacity). v1 behaviour: **exact, unambiguous match → offer that
   token; multiple matches → present the candidate list, never guess; no match → flag "not tokenized".**
   Anything richer (fuzzy/derived-value resolution) is fast-follow polish, not v1.

### Token list — single source

The editor's token list (and the design-system page's, and the lint's coverage) is **generated from
`globals.css`**, not hand-maintained. This removes the `aws_agent` prototype's biggest flaw — the token
list duplicated across the showcase page, the tweaker, and the API allowlist, which drifts.

### Writeback mechanism

- A **dev-only Next API route** (e.g. `POST /api/ds/token`), guarded by `NODE_ENV !== 'production'` so it
  never ships to prod.
- Receives `{ token, value, theme }` and rewrites the matching var in the correct theme block (`:root`
  or `.dark`).
- Backed by a **robust, heavily-TDD'd CSS-var read/write module** (`lib/tokens/parse|write`) that:
  - parses `:root` and `.dark` blocks;
  - updates exactly one declaration;
  - **preserves formatting, comments, and ordering**;
  - handles all token value types (hex, hsl, `var()` aliases, `color-mix()`, numeric, string);
  - rejects malformed input.
  This **replaces** the prototype's fragile, hex-only regex patch.
- On save → Next hot-reload → repaint. The **manifest regenerates on the same save** (cold path, §2).
- **Write atomicity / ordering.** The route owns the sequence: write `globals.css` atomically (write to a
  temp file then rename, so the Next watcher never reads a half-written file) → *then* trigger manifest
  regeneration. M1's write module guarantees the atomic single-declaration rewrite; M4's route owns the
  write-then-regenerate ordering. Neither assumes the other handles it.

### Theme-aware

A light/dark toggle selects which theme block the editor writes to. v1 ships both themes and edits the
active one.

### Safety

Writeback exists only in dev (`NODE_ENV` guard), performs **local file writes only** (the user's own
git-tracked files — diffable, revertible), ships **nothing to prod**, touches **no secrets**. The lint
escape hatch (§5 of the LLM contract) is explicit and greppable — never a silent bypass.

### Reuse / drop (code provenance)

- **From `aws_agent`:** the interaction model (control panel + `setProperty` live preview + write-to-
  globals.css). Proves the whole concept end-to-end. Rebuilt: generated token list, robust write module,
  theme-aware, all token groups (not just hex).
- **From `website-editor`:** only the **thin highlight/hover overlay** (the viewport-coordinate
  `position:fixed` highlight box, cross-realm-safe element checks). For pick-anywhere.
- **Dropped from `website-editor`:** **selector derivation**, capture, and verified-export-with-
  specificity-escalation. We tag `data-token`, so there is no selector to derive and no cascade fight to
  win — editing tokens, not competing selectors.

---

## 6. The LLM contract

Three layers: **intent → enforcement → bonus.**

### 6.1 Intent — markdown guide (portable, the foundation)

Root `AGENTS.md` + `CLAUDE.md` + `.cursor/rules` (same content, multiple homes so every coding agent —
Claude Code, Cursor, Copilot, Windsurf, v0, Bolt — auto-reads it). Portable beats powerful: not all vibe
coders use Claude Code. Contains:

- The token table + usage rules: *use Tailwind utilities / CSS vars; never hardcode color / px / font /
  duration.*
- **The extension procedure (the crux):**
  > Need a value the system lacks? **Add a token** to `globals.css` (correct theme block) → run
  > `npm run tokens` (regenerates the manifest) → use it via its Tailwind utility. **Never hardcode.**
  > The new token auto-appears on `/design-system` and becomes editable.
- A pointer to the generated `design-system.md` (the always-current token reference).

### 6.2 Enforcement — blocking lint (the teeth)

Prose reduces drift; it does not eliminate it. The template ships **lint rules** (stylelint + eslint)
that flag hardcoded colors / raw px where a token exists / literal hex / arbitrary Tailwind values
(`bg-[#abc]`, `p-[13px]`). Wired to `npm run check` + a pre-commit hook + CI so it **fails the build**.

**Escape hatch:** an explicit inline disable comment (e.g. `/* ds-disable: <reason> */`) for a deliberate
one-off — a conscious, greppable, reviewable override. **Never silent.**

### 6.3 Bonus — Claude Code skill (additive)

A bundled skill encoding the extension procedure as a richer workflow for Claude Code users. Optional —
the md guide + lint stand alone for non-Claude agents.

### 6.4 The manifest (the read artifact)

`design-system.md` (the LLM brief: token table, usage rules, extension procedure) and
`design-system.json` (machine-clean: every token, value, group, Tailwind utility). Regenerated from
`globals.css` on save. Always current → the LLM never reads stale token info.

---

## 7. Stack & repo layout

**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + `tailwindcss-animate`. Lint:
stylelint + eslint. Tests: Vitest + Playwright. (Same family this project's team already knows.)

```
app/
  globals.css            # SOURCE OF TRUTH (CSS vars, :root + .dark)
  design-system/page.tsx # living style guide (token sections auto-iterate; components hand-authored; data-token tagged)
  api/ds/token/route.ts  # dev-only writeback (NODE_ENV guarded)
components/ui/           # shadcn components (token-themed)
components/editor/       # edit overlay, control panels, thin highlight overlay (dev-only)
lib/tokens/
  parse.ts  write.ts     # CSS-var read/write — heavy TDD, load-bearing correctness core
  generate.ts            # vars -> design-system.{md,json}
  schema.ts              # token groups -> control types; fg/bg pairing
design-system.md         # generated LLM brief
design-system.json       # generated machine manifest
tailwind.config.ts       # utilities -> vars
AGENTS.md  CLAUDE.md      # LLM contract (+ .cursor/rules)
<skill dir>              # optional Claude Code skill
.stylelintrc / eslint     # the blocking lint rules
```

---

## 8. Data flow (end to end)

- **Build (LLM):** LLM reads `design-system.md` → generates components using `bg-primary`, `var(--space-4)`,
  etc. → lint passes. Needs a missing value → follows the extension procedure → adds `--warning` to
  `globals.css` → `npm run tokens` regenerates the manifest → uses `bg-warning`.
- **Edit (human):** opens `/design-system` in dev → enables Edit → clicks a swatch → picks a new value →
  live repaint via `setProperty` → commit → `POST /api/ds/token` → `lib/tokens/write` rewrites
  `globals.css` → hot reload → ripple → manifest regenerates.
- **Render (app):** every component reads CSS vars at runtime → any token change is reflected app-wide
  with no rebuild.

---

## 9. Testing (TDD, per project law)

- **`lib/tokens/parse|write`** — exhaustive unit tests. Parse `:root`/`.dark`; update one var; preserve
  formatting/comments/order; both themes; all value types; malformed input. **The correctness core.**
- **`lib/tokens/generate`** — vars in → manifest md/json out, fixture-defined (the manifest shape is
  defined by its fixtures, the way `website-editor`'s selector-derive was).
- **`lib/tokens/schema`** — token group → control-type mapping; fg/bg pairing.
- **Lint rules** — fixtures: hardcoded hex fails; token use passes; `ds-disable` override passes.
- **Editor e2e (Playwright)** — enable Edit → click token → change → assert live repaint → assert
  `globals.css` rewritten → assert ripple on a second element bound to the same token. (Repaint/layout is
  only provable in a real browser, as in `website-editor`.)
- **Manifest freshness** — edit a token → regenerated manifest matches.
- **Pick-anywhere** — clicking a tokenized element opens the right token; clicking a hardcoded element is
  flagged "not tokenized", never silently patched.

---

## 10. Milestones (build order)

Each milestone is TDD'd and reviewed, and is independently usable.

- **M0 — Template skeleton + naming convention.** Next + TS + Tailwind + shadcn scaffolded. Extended
  `globals.css` (all token groups, light + dark). Tailwind config wired to vars. **Pin the exact token
  naming convention as a written rule** (not just examples): how `*-foreground` pairs, scale suffixes
  (`-sm/md/lg`, `-1..-12`), brand-ramp steps, and status tokens are named. Lint, `generate`, `schema`,
  and the editor all key on names, so the convention must be fixed here to prevent later churn. *Done =
  `npm run dev` shows a themed shadcn app and the naming convention is documented.*
- **M1 — Token write-core (load-bearing).** `lib/tokens/parse|write|schema` with exhaustive TDD. *Done =
  can programmatically change any token in `globals.css` safely, preserving formatting, in either theme.*
- **M2 — Manifest generation.** `generate.ts` → `design-system.{md,json}` + `npm run tokens` + dev watch.
  Fixture tests. *Done = manifest always reflects the vars.*
- **M3 — Design-system page.** `/design-system` rendering auto-iterated token sections + hand-authored
  shadcn component showcase, `data-token`-tagged. *Done = living style guide, truthful by construction.*
- **M4 — Editor.** Edit toggle, per-group control panels, live preview, dev-only writeback API → M1 core,
  thin highlight overlay, pick-anywhere with drift-flagging. Playwright e2e for the full
  edit→repaint→writeback→ripple loop. *Done = visually edit a token; it lands in `globals.css` and
  ripples.*
- **M5 — LLM contract.** `AGENTS.md`/`CLAUDE.md`/`.cursor/rules` + extension procedure + blocking
  stylelint/eslint + `ds-disable` override + optional Claude skill. Lint fixture tests. *Done = a
  hardcoded value fails CI; the extension procedure is documented and works.*

### Fast-follows (post-v1)

- **Contrast check** in the editor (fg/bg already paired in the schema) — warn on WCAG failures.
- **Pick-anywhere** drift-flagging polish.
- **Gradient editing** (gradients shippable as tokens now; a gradient-builder control is later).
- **`npx create-*` CLI** (§11).

---

## 11. Distribution

**v1: GitHub template repo.** "Use this template" / `npx degit`. Ships the entire value with no extra
package to own or publish.

**Fast-follow: `npx create-*` CLI.** Thin scaffolder (~1 day once the template is stable): prompts
(project name, optional seed palette), **`degit`s from the template repo** (so the template stays the
single source — no bundled copy to drift), runs `npm install`, `git init`. Deferred not because it is
hard but because building it while the template still churns is wasteful, and it adds a permanent
maintenance + npm publish/supply-chain surface. The degit approach makes adding it later trivial.

---

## 12. Relationship to existing projects

- **`website-editor` (QA Restyle Tool):** different product (live-site capture + restyle + verified CSS
  export for arbitrary sites). This project **reuses only a thin highlight overlay** and **drops** the
  selector-derivation / capture / verified-export machinery (unneeded with `data-token`).
- **`aws_agent/website`:** contains a **working prototype** of this exact idea — token control panels
  (`ColorTweaker`/`FontTweaker`/`TypeInspector`) with `setProperty` live preview and regex writeback to
  `globals.css`, plus a hand-authored `/design-system` showcase and `save-*` API routes. This project
  adopts its **interaction model** and **rebuilds it properly**: generated (not hardcoded/triplicated)
  token list, robust TDD'd write module (not hex-only regex), theme-aware, all token groups.
