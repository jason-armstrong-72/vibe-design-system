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
give this natively; tokens baked in at build time (a JS `tailwind.config`, or a v4 `@theme` block without
`inline` that copies literals) would force a rebuild per edit and kill the live-editing feel. The v4
`@theme inline` pattern (§3) sidesteps this — utilities resolve *through* `var(--token)` to the runtime
`:root` value, so an edit repaints with no rebuild. So CSS vars **must** exist at runtime regardless.
Making them the
*authored* source keeps the hot path (edit → repaint) zero-step and pushes generation (the LLM doc) onto
the cold path (on save), where latency does not matter. A JSON-as-truth model would insert a
generate-CSS step between every edit and repaint — the wrong tradeoff.

---

## 3. Token set (v1)

Extended-but-curated. Authored as CSS vars under `:root` (light) and `.dark` (dark). Token **names are
the contract** — the stable API the editor, lint, and LLM all key on; v1 fixes a documented naming
convention.

**Names are invariant; values are themeable (enables the preset suite — §13).** Because every consumer
(parse, write, generate, editor, lint, the design-system page) keys on token *names*, the entire token
*value*-set can be swapped without touching any of them. A "theme" is therefore just a complete
`:root`/`.dark` value-set under the fixed names — and because the token set spans every visual group
(radius, borders, shadows, type, motion — not just color), one value-set can express a complete aesthetic
(Swiss = radius 0 + hairline borders + no shadow; Brutalist = thick borders + hard shadows). v1 ships a
**gallery of 8 themes** the user picks from at adoption time, then fine-tunes in the editor (§13).

**Color storage format — OKLCH, decided.** Color tokens store a **full `oklch(...)` value**, not bare
channels and not hex. Rationale: (a) OKLCH is perceptually uniform — the brand ramp and the fast-follow
WCAG contrast check (§10) both reason about lightness, which OKLCH gives directly; (b) P3 wide-gamut for
free; (c) it is shadcn's current default, so the template is not born legacy. **Consequence for Tailwind
wiring:** the `@theme inline` map points the utility straight at the var (`--color-primary: var(--primary)`),
storing a full `oklch(...)` — **not** the legacy `hsl(var(--primary))` bare-channel wrapper. The color
picker emits `oklch(...)`; the write module stores it verbatim.
One format end-to-end (picker → write → var → utility) — no per-edit format conversion, no hex/hsl
ambiguity. Aliases (`var()`), `color-mix()`, and numeric/string non-color tokens are still handled by the
write module; only the *color channel* format is fixed to OKLCH.

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

**Spacing — single `--spacing` multiplier (v4-native).** Tailwind v4 generates every numeric spacing
utility (`p-1 … p-12 … p-N`) from one `--spacing` multiplier via `calc()`; there is no discrete
`--space-1..12` scale (that was a v3 model). So spacing is **one editable token** — change `--spacing` and
the whole `p-/m-/gap-/size-` scale ripples proportionally. **Honest boundary:** because `p-13` is computed
on demand, off-scale spacing **cannot fail at compile** the way an off-palette color can — it is caught by
**lint** (§6.2), not the compiler. The design-system page renders the derived steps (p-1..p-12) as
reference; they are derived, not authored.

**Radii** — `--radius` (shadcn keys off this) + `--radius-sm/md/lg`.

**Border widths** — `--border-width-thin/base/thick`.

**Shadows** — `--shadow-sm/md/lg`.

**Transitions** — `--duration-fast/base/slow`, `--ease-standard/in/out`.

**Animation primitives** — durations + easings above drive a small named-animation set (fade, slide,
scale, accordion) shipped via `tw-animate-css` (the Tailwind-v4 successor to the deprecated
`tailwindcss-animate`; imported in `globals.css` via `@import "tw-animate-css"`). **The keyframe shapes
are NOT editable tokens** —
a `@keyframes` rule cannot be stored in a CSS custom property. Only their **timing** (duration/easing)
is token-editable and ripples through all animations. The design-system page shows live animation demos
so they are visible even though their shape is code-only.

**Z-index** — `--z-dropdown/sticky/modal/toast`.

**Opacity** — `--opacity-disabled/muted`.

**Container/layout widths** — `--container-sm/md/lg` + content gutter.

**Breakpoints — documented, NOT runtime-editable.** CSS media queries cannot reliably read CSS vars for
breakpoints, so breakpoints live in the `@theme` block (`--breakpoint-*`), are surfaced in the manifest as
reference, but are not editable tokens. Honest boundary — surfaced, not faked.

**fg/bg pairing.** Color tokens that form a foreground/background pair are modeled as pairs in the token
schema now, so a **contrast check** (WCAG) can be added as a fast-follow (§10) without re-modeling.

### Tailwind wiring (Tailwind v4, CSS-first)

Tailwind v4 configures in CSS, not `tailwind.config.ts`. All wiring lives in `globals.css` — which makes
it *even more* the single source of truth (§2). **Two layers, shadcn-v4 pattern:**

1. **Runtime layer — `:root` / `.dark`** hold the authored, editable token values:
   `--primary: oklch(...)`, etc. **The editor writes here. The manifest generates from here.** This is the
   source of truth. (`--spacing` lives here too, as the single spacing knob.)
2. **Utility layer — `@theme inline`** maps each token into Tailwind's namespace so it generates a
   utility: `@theme inline { --color-primary: var(--primary); --text-lg: var(--fs-lg); … }`. The `inline`
   keyword means the utility resolves *through* `var(--primary)` (not a copied literal), so a runtime
   change to the `:root` var repaints instantly — no rebuild. So `bg-primary`, `text-lg`, `p-4`,
   `shadow-md`, `rounded-lg` all resolve to the runtime vars.

**Defaults are cleared, not extended (load-bearing).** In v4 the default palettes/scales are cleared by
resetting the namespace inside `@theme` (`--color-*: initial; --text-*: initial; --shadow-*: initial;` …)
*before* defining the token-mapped entries. With the defaults gone, off-token utilities in a **cleared
namespace fail to compile** — `bg-red-500`, `text-[10px]`-style off-scale type, etc. become build errors,
not lint warnings. **Caveat (spacing):** the `--spacing` multiplier is *not* a clearable enum, so off-scale
spacing (`p-13`) compiles and is caught by lint instead (§6.2) — the only group where the compile-gate
doesn't apply. Non-token-backed
utilities (layout, flex, grid, etc.) are untouched. **A `tailwind.config.ts` is optional and near-empty**
(content globs / plugin hooks only) — no token mapping lives there.

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

### Edit paths

**v1 ships path 1 only.** Pick-anywhere (path 2) is **cut from v1 to fast-follow** — see the note below.

1. **Token editing (primary, the whole of v1).** Click a `data-token` element → a control panel for *that token* opens.
   The **control type is derived from the token group**: color picker for colors, slider for
   spacing/radii/border-widths, dropdown for font families, an easing-curve control for transitions,
   etc. Changing a value:
   - sets the CSS var on `document.documentElement` for **instant live preview** (`setProperty`);
   - on commit, **writeback** rewrites the matching declaration in `globals.css`.
   Because the unit edited is a **token**, the change ripples everywhere it is used. No selector
   derivation — the click maps to a known token.

2. **Pick-anywhere (CUT FROM v1 → fast-follow).** Hover/click any element on a real app page, resolve
   which token(s) drive its computed styles, offer to edit those. **Why cut:** reverse-resolution (mapping
   a computed color back to a token) is the riskiest, lowest-value path in the whole product. It is *not
   always 1:1* — a computed color may match several tokens or none (after `color-mix()` / opacity) — which
   is precisely the `website-editor` selector-derivation problem this project escaped by tagging
   `data-token`. For a **greenfield template we own**, everything worth editing is already `data-token`-
   tagged, so path 1 covers the real need. Pulling pick-anywhere out of M4 removes its single biggest risk
   and ships a smaller, safer editor. When it returns as a fast-follow, the modest bar holds: **exact
   unambiguous match → offer it; multiple → show candidates, never guess; no match → flag "not
   tokenized".** Drift is surfaced, never silently patched.

### Token list — single source

The editor's token list (and the design-system page's, and the lint's coverage) is **generated from
`globals.css`**, not hand-maintained. This removes the `aws_agent` prototype's biggest flaw — the token
list duplicated across the showcase page, the tweaker, and the API allowlist, which drifts.

### Writeback mechanism

- A **dev-only Next API route** (e.g. `POST /api/ds/token`), guarded by `NODE_ENV !== 'production'` so it
  never ships to prod.
- Receives `{ token, value, theme }` and rewrites the matching var in the correct theme block (`:root`
  or `.dark`).
- **Input validation is a security boundary, not just hygiene.** `value` flows into a CSS declaration; an
  un-validated value (e.g. `red; } body { display:none`) breaks out of the declaration and injects
  arbitrary CSS. The route therefore: (a) rejects any `token` not already present in `globals.css` (no
  creating tokens via the editor — that is the LLM/human extension path); (b) **validates `value` against
  the expected type for that token's group** (color → parses as `oklch()`/`var()`/`color-mix()`; numeric →
  number + allowed unit; etc.) and rejects `;`, `}`, `{`, and comment delimiters outright. Dev-only +
  local-file write keeps severity low, but a malformed/hostile value must never reach the file.
- Backed by a **robust, heavily-TDD'd CSS-var read/write module** (`lib/tokens/parse|write`) that:
  - parses **only** the `:root` and `.dark` blocks (the runtime source of truth) — the v4 `@theme inline`
    utility-mapping block is never written to (editing it would break the namespace, not a value);
  - updates exactly one declaration;
  - **preserves formatting, comments, and ordering**;
  - handles all token value types (`oklch()`, `var()` aliases, `color-mix()`, numeric, string);
  - **re-reads `globals.css` immediately before each write** (it may have changed under the editor — the
    LLM or a human can edit the same file via the extension path while the dev server runs), so the editor
    never writes against a stale snapshot;
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
  > Need a value the system lacks? **Add a token** to `globals.css` — for a **color, add it to BOTH
  > `:root` and `.dark`** (other groups: the relevant block) → run `npm run tokens` (regenerates the
  > manifest) → use it via its Tailwind utility. **Never hardcode.** The new token auto-appears on
  > `/design-system` and becomes editable. *(CI enforces both-theme presence and a fresh manifest — §6.2.)*
- A pointer to the generated `design-system.md` (the always-current token reference).

### 6.2 Enforcement — blocking lint (the teeth)

Prose reduces drift; it does not eliminate it. The template ships **lint rules** (stylelint + eslint)
that flag hardcoded colors / raw px where a token exists / literal hex / arbitrary Tailwind values
(`bg-[#abc]`, `p-[13px]`). Wired to `npm run check` + a pre-commit hook + CI so it **fails the build**.

Three enforcement mechanisms, layered (the first is the strongest):

- **Compile-time (strongest, cleared namespaces only).** Because `@theme` *clears* the default color,
  font-size, shadow, radius (etc.) namespaces (§3), `bg-red-500` and off-scale type don't exist → build
  error, no lint needed. **Exception — spacing:** v4's `--spacing` multiplier can't be cleared to an enum,
  so `p-13` compiles; spacing off-scale falls to lint (next bullet). Lint also catches arbitrary-value
  escapes everywhere (`bg-[#abc]`, `p-[13px]`) and raw values in CSS.
- **Spacing scale (lint, since compile can't).** A rule flags numeric spacing utilities outside the
  curated step list (e.g. `p-13`, `gap-7` if 7 isn't a step) and arbitrary `p-[13px]`. This is spacing's
  only guard — the compile-gate above explicitly does not cover it.
- **Both-theme completeness.** A rule asserts every color token defined in `:root` also exists in `.dark`
  (and vice-versa). Closes a guaranteed bug class: the extension procedure adds a token to one block and
  forgets the other → broken dark mode that nothing else catches.
- **Manifest freshness (CI gate).** CI runs `npm run tokens` and **fails if the working tree is dirty** —
  i.e. the committed `design-system.{md,json}` disagrees with `globals.css`. This is the real enforcement
  of "the LLM ran the regen step": it cannot land a token without a current manifest, whether or not it
  remembered to run the command locally. Standard generated-artifact check.

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

**Stack (versions pinned at M0, 2026-06-16):**

| Dependency | Version | Notes |
|---|---|---|
| Next.js | 16.x (App Router) | 16.2.9 LTS at pin time |
| React | 19.x | shadcn-v4 / Next 16 baseline |
| TypeScript | 5.x | latest stable |
| **Tailwind CSS** | **4.x** | CSS-first `@theme`; config lives in `globals.css` (§3) |
| shadcn/ui | v4-native CLI | OKLCH default, React 19 components |
| Animations | `tw-animate-css` | **replaces** deprecated `tailwindcss-animate` |
| Lint | stylelint + eslint | the blocking rules (§6.2) |
| Tests | Vitest + Playwright | unit + browser e2e (§9) |
| Fonts | `next/font` + bundled Google fonts | a shared font set the themes draw from (§13); `--font-sans`/`--font-mono` are themeable tokens |
| Node | 20 LTS+ | Next 16 floor |

Exact versions are locked in the committed lockfile at M0; the table is the intent. (Same family this
project's team already knows.) **Tailwind v4 is load-bearing on the architecture** — config-in-CSS is what
keeps `globals.css` the single source of truth (§3), not a happenstance version bump.

```
app/
  globals.css            # SOURCE OF TRUTH: :root + .dark token vars, @theme inline mapping, tw-animate-css import
  design-system/page.tsx # living style guide (token sections auto-iterate; components hand-authored; data-token tagged)
  api/ds/token/route.ts  # dev-only writeback (NODE_ENV guarded)
components/ui/           # shadcn components (token-themed)
components/editor/       # edit overlay, control panels, thin highlight overlay (dev-only)
lib/tokens/
  parse.ts  write.ts     # CSS-var read/write (:root/.dark only) — heavy TDD, load-bearing correctness core
  generate.ts            # vars -> design-system.{md,json}
  schema.ts              # token groups -> control types; fg/bg pairing
design-system.md         # generated LLM brief
design-system.json       # generated machine manifest
tailwind.config.ts       # optional, near-empty (content globs / plugins only — NO token mapping; that's in globals.css)
AGENTS.md  CLAUDE.md      # LLM contract (+ .cursor/rules)
<skill dir>              # optional Claude Code skill
.stylelintrc / eslint     # the blocking lint rules
themes/                  # the 8 theme presets — each a complete :root/.dark value-set (§13)
  neutral.css  swiss.css  editorial.css  warm.css  brutalist.css
  pastel.css  technical.css  corporate.css
  screenshots/           # one /design-system capture per theme (README gallery)
lib/fonts.ts             # next/font setup for the bundled shared font set (§13)
scripts/apply-theme.ts   # `npm run theme <name>` — swap a preset into globals.css + regenerate manifest
docs/DESIGN-BRIEF.md     # master aesthetic brief + 8 per-theme mini-briefs (drives the visual loop)
```

---

## 8. Data flow (end to end)

- **Build (LLM):** LLM reads `design-system.md` → generates components using `bg-primary`, `p-4`,
  `text-lg`, etc. → lint passes. Needs a missing value → follows the extension procedure → adds `--warning` to
  `globals.css` → `npm run tokens` regenerates the manifest → uses `bg-warning`.
- **Edit (human):** opens `/design-system` in dev → enables Edit → clicks a swatch → picks a new value →
  live repaint via `setProperty` → commit → `POST /api/ds/token` → `lib/tokens/write` rewrites
  `globals.css` → hot reload → ripple → manifest regenerates.
- **Render (app):** every component reads CSS vars at runtime → any token change is reflected app-wide
  with no rebuild.

---

## 9. Testing (TDD, per project law)

- **`lib/tokens/parse|write`** — exhaustive unit tests. Parse `:root`/`.dark`; update one var; preserve
  formatting/comments/order; both themes; all value types; malformed input; **value-type validation +
  CSS-injection rejection** (`;`/`}`/`{`/comment delimiters refused); **pre-write re-read** picks up an
  external edit. **The correctness core.**
- **`lib/tokens/generate`** — vars in → manifest md/json out, fixture-defined (the manifest shape is
  defined by its fixtures, the way `website-editor`'s selector-derive was).
- **`lib/tokens/schema`** — token group → control-type mapping; fg/bg pairing.
- **Lint rules** — fixtures: hardcoded hex fails; arbitrary Tailwind value fails; `bg-red-500` (stripped
  default) fails to compile; a color in `:root` but not `.dark` fails the both-theme rule; token use
  passes; `ds-disable` override passes.
- **Manifest freshness CI gate** — a token added without rerunning `npm run tokens` leaves a dirty tree →
  CI fails; after regen → passes.
- **Editor e2e (Playwright)** — enable Edit → click token → change → assert live repaint → assert
  `globals.css` rewritten → assert ripple on a second element bound to the same token. (Repaint/layout is
  only provable in a real browser, as in `website-editor`.)
- **Manifest freshness** — edit a token → regenerated manifest matches.
- **Pick-anywhere** — clicking a tokenized element opens the right token; clicking a hardcoded element is
  flagged "not tokenized", never silently patched.

---

## 10. Milestones (build order)

Each milestone is TDD'd and reviewed, and is independently usable.

- **M0 — Template skeleton + naming convention.** Next 16 + TS + Tailwind v4 + shadcn (v4 CLI)
  scaffolded; versions pinned in lockfile (§7). Extended `globals.css` (all token groups, light + dark,
  OKLCH colors) with the v4 two-layer wiring: `:root`/`.dark` runtime vars + `@theme inline` utility
  mapping + namespace clears (`--color-*: initial`) so defaults can't leak (§3). `tw-animate-css`
  imported. **Pin the exact token naming convention as a written rule** (not just examples): how
  `*-foreground` pairs, scale suffixes (`-sm/md/lg`, `-1..-12`), brand-ramp steps, and status tokens are
  named. Lint, `generate`, `schema`, and the editor all key on names, so the convention must be fixed here
  to prevent later churn. M0 ships **one** theme — the **Neutral** preset (§13) — as the canonical default
  all later fixtures key on; the bundled-font setup (`lib/fonts.ts`, §7/§13) lands here too. *Done =
  `npm run dev` shows a themed shadcn app, `bg-red-500` fails to compile, and the naming convention is
  documented.*
- **M1 — Token write-core (load-bearing).** `lib/tokens/parse|write|schema` with exhaustive TDD. *Done =
  can programmatically change any token in `globals.css` safely, preserving formatting, in either theme.*
- **M2 — Manifest generation.** `generate.ts` → `design-system.{md,json}` + `npm run tokens` + dev watch.
  Fixture tests. *Done = manifest always reflects the vars.*
- **M3 — Design-system page.** `/design-system` rendering auto-iterated token sections + hand-authored
  shadcn component showcase, `data-token`-tagged. *Done = living style guide, truthful by construction.*
- **M3a — Theme preset suite (§13).** Depends on M3 (the page is what gets screenshotted). Author the
  other 7 presets as complete `:root`/`.dark` value-sets under the fixed names, via the visual loop
  (per-theme mini-brief → generate value-set → render `/design-system` → screenshot → critique vs brief →
  revise). Ship `scripts/apply-theme.ts` (`npm run theme <name>`), the `themes/` dir, the bundled shared
  fonts, and a README gallery of one screenshot per theme. Runs independently of M4/M5 once M3 exists.
  *Done = `npm run theme swiss` swaps the whole look; 8 themes pass the contrast/coherence bar; the gallery
  renders in the README.*
- **M4 — Editor.** Edit toggle, per-group control panels, live preview, dev-only writeback API → M1 core
  (with value-type/injection validation + pre-write re-read), thin highlight overlay. **Token editing only
  — pick-anywhere is cut to fast-follow (§5).** Playwright e2e for the full edit→repaint→writeback→ripple
  loop. *Done = visually edit a token; it lands in `globals.css` and ripples.*
- **M5 — LLM contract.** `AGENTS.md`/`CLAUDE.md`/`.cursor/rules` + extension procedure + blocking
  stylelint/eslint (stripped-defaults compile gate + both-theme completeness + arbitrary-value rules) +
  `ds-disable` override + manifest-freshness CI gate + optional Claude skill. Lint fixture tests. *Done = a
  hardcoded value fails CI; a one-theme token fails CI; a stale manifest fails CI; the extension procedure
  is documented and works.*
- **M6 — Dogfood gate (validates the headline).** Drive an LLM to build one real sample feature on the
  finished template: it reads the manifest, builds with tokens, hits a missing value, runs the extension
  procedure end-to-end, and passes lint + CI. The product's actual job ("build with an LLM") is the
  acceptance test — not just "lint fails on hardcode." *Done = an LLM ships a feature through the full loop
  with zero hand-fixes to the contract.*

### Fast-follows (post-v1)

- **Contrast check** in the editor (fg/bg already paired in the schema; OKLCH lightness makes it cheap) —
  warn on WCAG failures.
- **Pick-anywhere** (reverse-resolution, cut from v1 M4) — exact/candidate-list/flag behaviour per §5.
- **Gradient editing** (gradients shippable as tokens now; a gradient-builder control is later).
- **`npx create-*` CLI** (§11).

---

## 11. Distribution

**v1: GitHub template repo.** "Use this template" / `npx degit`. Ships the entire value with no extra
package to own or publish. **Theme selection is part of adoption:** the README gallery (§13) shows one
screenshot per theme; the user picks a look and runs `npm run theme <name>` to apply it, then fine-tunes
in the editor. Default is **Neutral** (already applied), so doing nothing is also valid.

**Fast-follow: `npx create-*` CLI.** Thin scaffolder (~1 day once the template is stable): prompts
(project name, **theme choice** from the §13 gallery), **`degit`s from the template repo** (so the
template stays the single source — no bundled copy to drift), applies the chosen theme, runs
`npm install`, `git init`. Deferred not because it is hard but because building it while the template
still churns is wasteful, and it adds a permanent maintenance + npm publish/supply-chain surface. The
degit approach makes adding it later trivial.

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

---

## 13. Theme preset suite

The starter ships a **gallery of 8 themes**. Each is a complete `:root`/`.dark` value-set under the
**fixed token names** (§3) — so swapping a theme touches *only values*, and every consumer (parse, write,
generate, editor, lint, the design-system page) works unchanged. Because the token set spans every visual
group, a preset expresses a **whole aesthetic**, not just a palette: color, type, radius, border width,
shadow, and motion all move together.

### The 8 themes

| # | Theme | Signature |
|---|---|---|
| 1 | **Neutral** (default) | greys + one accent; restrained; the easiest to re-brand; M0's canonical preset |
| 2 | **Swiss / Minimal** | near-monochrome, radius 0, hairline borders, generous whitespace, type does the work |
| 3 | **Editorial** | confident brand hue, expressive serif/sans pairing, magazine hierarchy |
| 4 | **Warm / Organic** | earthy palette, soft radius, gentle elevation, friendly |
| 5 | **Brutalist** | thick borders, hard offset shadows, mono type, high contrast |
| 6 | **Soft / Pastel SaaS** | low-contrast pastels, rounded, approachable product feel |
| 7 | **Technical / Dark-first** | developer-tool aesthetic, dark base, one bright accent |
| 8 | **Corporate / Trust** | enterprise blue, conservative, denser spacing |

### Mechanism

- `themes/<name>.css` — a complete `:root`/`.dark` block (token **values** only; names are fixed).
- `npm run theme <name>` (`scripts/apply-theme.ts`) — swaps the chosen block into `app/globals.css`'s
  `:root`/`.dark` region (reusing M1's write-core parsing so formatting stays clean), then runs
  `npm run tokens`. The `@theme inline` mapping and namespace clears are theme-invariant and untouched.
- **Fonts are bundled and shared.** `lib/fonts.ts` sets up a small set of `next/font` Google fonts (a few
  faces covering sans / serif / mono / display) that the themes draw from via the `--font-sans` /
  `--font-mono` (+ optional `--font-serif`) tokens. Themes reference the shared set; no per-theme font
  download bloat beyond the shared faces.
- **README gallery** — `themes/screenshots/<name>.png`, one capture of `/design-system` per theme,
  generated by Playwright in M3a. The user browses, picks, applies, edits.

### How the 8 are produced (contract + brief + loop)

Token *values* are gradable (WCAG contrast, hue harmony) and screenshot-able, so the high-variance visual
work is made convergent: for each theme, a per-theme **mini-brief** in `docs/DESIGN-BRIEF.md` → generate
the value-set → apply → render `/design-system` → screenshot → critique against the brief (contrast pass,
coherence, distinctiveness) → revise. The 8 run in parallel. **Hard gate every theme must pass:** all
fg/bg pairs meet WCAG AA in both light and dark; no token left at the Neutral default unintentionally; the
design-system page renders without overflow at every breakpoint.

### Non-goals (theme suite, v1)

- No runtime theme-switcher in the shipped app (themes are an *adoption-time* choice + editor tuning, not
  an end-user toggle). A runtime multi-theme switcher is a possible fast-follow.
- No user-contributed theme marketplace.
