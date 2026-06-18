# Handoff — Design System Starter

**You are picking up an in-progress build. Read this first, then the spec.** This file is the fastest path to context.

## What this project is
A **design-system starter template** (a GitHub template repo) for people building a website or SaaS app **with an LLM** ("vibe coders," technical-enough builders working alongside an AI — not fully non-technical). It ships:
1. An opinionated **OKLCH token set** as the single source of truth (`app/globals.css`).
2. A **living design-system page** (`/design-system`) that renders every token + a component showcase.
3. A **visual token editor** (dev-only, point-and-click) — **not built yet (M4)**.
4. An **LLM contract** (rules + blocking lint) so an LLM builds *with* the system and extends it — lint **not built yet (M5)**.
5. A **gallery of themes** (value-sets under fixed names) — Neutral shipped, others **not built yet (M3a)**.

The full design is the spec: **[docs/specs/2026-06-16-design-system-starter-design.md](specs/2026-06-16-design-system-starter-design.md)** — authoritative, read it.

## Where we are (all merged to `main`)
- ✅ **M0** — scaffold (Next 16.2.9 + React 19 + Tailwind v4 + shadcn), OKLCH token system, compile-gate test.
- ✅ **M1** — token write-core: `lib/tokens/{types,schema,parse,validate,write}.ts`. PostCSS AST, atomic writes, injection rejection. Lossless round-trip.
- ✅ **M2** — manifest generation: `lib/tokens/{utilities,generate,sync}.ts` → `design-system.{json,md}` via `npm run tokens` + dev watch.
- ✅ **M2.5** — informal LLM dogfood of the manifest. **Found + fixed** that the extension procedure was broken (see "B-fixes" below).
- ✅ **M3** — `/design-system` page (living style guide). Auto-iterates all tokens, each `data-token`-tagged; reference-guided visual pass.
- ✅ **M3a** — theme preset suite. 3 v1 themes (`themes/{neutral,swiss,brutalist}.css`), each a complete `:root`/`.dark` value-set under the fixed names. `npm run theme <name>` swaps a preset into `globals.css` (atomic write, reuses M1 parse via `lib/tokens/apply-theme.ts`) + regenerates the manifest (`lib/tokens/regenerate.ts`, shared with `npm run tokens`). Gates: WCAG-AA contrast (`lib/tokens/contrast.ts` via `culori`, light+dark, body 4.5 / muted 3:1), theme parity (same name-set as Neutral), no-overflow (`e2e/themes.spec.ts`). README screenshot gallery via `npm run gallery` (`e2e/gallery.spec.ts`, GALLERY=1-guarded). **Neutral status colors (success/info/destructive) were nudged darker to pass AA** — was failing on shadcn defaults.
- ✅ **M4** — dev-only visual token editor over `/design-system`. Click a `data-token` → docked panel edits it; live preview (`setProperty`) + per-token-debounced persist to `globals.css` via a **dev-only, write-only** `POST /api/ds/token` (`NODE_ENV`-guarded; validates + allowlist + `writeToken`; **does NOT regenerate** — the watcher owns regen). Editor is a client island (`components/editor/*`) tree-shaken out of prod (verified). Controls: OKLCH color (L/C/H + hex + eyedropper + reuse-a-token swatches + read-only contrast badge), length/opacity/duration/number/select sliders, easing (preset + `cubic-bezier()` text), shadow/font text. Editor chrome = own namespaced `--ed-*` tokens (light+dark, `@untitled-ui/icons-react` icons). Two toolbar toggles: **panel appearance** (cosmetic) + **editing block** (which DS light/dark block writes land in, forces a truthful dark preview). Reset + save-state + **undo/redo** (buttons + ⌘Z/⌘⇧Z). Typed fields commit on blur/Enter; hover overlay tracks on scroll. Control-map is disjoint+exhaustive over all 14 groups.
- **Status: 290 vitest + 16 Playwright e2e passing (+1 gallery, skipped without GALLERY=1). 94 tokens.** Run `npm test` (vitest) and `npx playwright test` (e2e).

Plans for executed milestones live in `docs/superpowers/plans/` (M0–M4). Specs in `docs/superpowers/specs/` (M4). **M5/M6 are NOT yet planned.**

### M4 fast-follows (deferred, all on the same machinery)
- Draggable **cubic-bezier curve editor** (easing is preset+text now) + **layered shadow builder** (shadow is text now).
- **Pick-anywhere** (reverse-resolution) + **gradient builder**.
- Contrast **warning** workflow beyond the read-only badge.
- 3 review nits (non-blocking): block-switch resets a same-token in-flight save-state to idle (cosmetic; write still lands); writeback debounce keys by token name not `token|theme` (very narrow cross-block race); contrast badge hides for `var()`-indirected colors.
- ⚠️ **Lint debt for M5:** `npm run lint` has a large pre-existing error baseline (mostly test files / react-hooks rules). `next build` passes (its own gate), but **M5 wires blocking lint** — clean this baseline first or it'll fail the new gate.

## Load-bearing decisions & conventions (non-obvious — don't relearn the hard way)
- **Tailwind v4, CSS-first.** Config lives in `app/globals.css` via `@theme`, NOT `tailwind.config.ts`. Two layers: runtime token vars in `:root`/`.dark` (the editable source of truth) + `@theme inline` that **clears default namespaces** (`--color-*: initial` …) and maps tokens through `var()` so runtime edits repaint with no rebuild.
- **Token NAMES are the contract.** Names invariant, values themeable → that's what makes the theme gallery (M3a) nearly free. `lib/tokens/schema.ts` `groupForName` classifies by name; for an **unknown name with a color value it infers `color`** (this is what makes the extension procedure work).
- **One-step extension (the B-fix from M2.5).** Adding a color = add it to BOTH `:root` and `.dark` → run `npm run tokens`. That command runs `syncThemeColorMappings` (`lib/tokens/sync.ts`) which **auto-wires the `@theme inline` mapping** so `bg-<name>` compiles. No hand-editing `@theme`, no allowlist. Proven end-to-end.
- **Single-knob groups:** spacing is one `--spacing-base` multiplier; radius is one `--radius` knob (sm/md/lg/xl derived via `calc()` in `@theme`, clamped `max(0px,…)` for radius-0 themes). The page shows derived steps read-only.
- **Off-token classes NO-OP, they don't error.** `bg-red-500` in a `className` produces no CSS and `next build` still passes — it's silently unstyled. The **real build-failure is the M5 lint** (not built yet). Do NOT tell users "won't compile" — say "produces no styles; lint rejects it."
- **`data-token="--name"`** on the page is the **M4 editor's hook** — every token has exactly one (e2e-enforced). The component showcase intentionally has none.
- **Fonts:** Geist + Geist Mono via `lib/fonts.ts` (Aeonik in the user's reference is paid; Geist is the bundled stand-in). Serif/display faces get added when Editorial theme needs them (fast-follow).
- **v1 themes = 3:** Neutral (shipped, the M0 default), Swiss, Brutalist. Other 5 are fast-follow. Each theme = a complete `:root`/`.dark` value-set under the fixed names.

## Token set (94 tokens, tuned with the user this session)
14 groups. Notable user decisions: brand ramp kept at **11 shades** (50→950, shade-ordered on the page); line-heights kept **per-size**; type scale **extended to 7xl** (5xl/6xl/7xl display tier, top 72px) for hero/website headings; opacity **extended to 4** (disabled/muted/overlay/hover). Naming rules: **[docs/NAMING-CONVENTION.md](NAMING-CONVENTION.md)** (the contract every consumer keys on).

## Workflow conventions (follow these)
- **Caveman mode is active** — terse responses (drop articles/filler/hedging; fragments OK). Code/commits/PRs written normally. A SessionStart hook enforces it.
- **One milestone per branch.** TDD: write failing test → run → implement → run → commit per task. Full suite green before merging `--no-ff` to `main`. Delete the branch after.
- **Plan before building.** Use the `writing-plans` skill; dispatch a `general-purpose` subagent to **review the plan against the real repo** before executing (this caught real bugs every time — Vitest config, missing token groups, etc.). Fix, then execute.
- **Visual work splits function from aesthetic.** Function is TDD'd (renders, tagged, no overflow, a11y). Aesthetic is driven by **[docs/DESIGN-BRIEF.md](DESIGN-BRIEF.md)** + a screenshot→critique→revise loop + a **human checkpoint** (the user reviews screenshots before you declare done). Capture shots with a throwaway Playwright spec into `e2e/__shots__/` (gitignored); `Read` the PNGs to self-critique.
- **The user reviews token sufficiency section-by-section** and has strong design opinions — surface choices via AskUserQuestion, give a recommendation, explain plainly when asked.

## Environment gotchas (already solved — don't rediscover)
- `create-next-app` aborts on existing `README.md`/`.gitignore` and exits 0 (silent) → scaffold in a temp dir, move `docs/`+`README` back.
- shadcn CLI changed: no `--base-color`; it prompts. Use `npx shadcn@latest init -y -d -b radix`. It adds `@import "shadcn/tailwind.css"` (benign keyframes/variants — keep it) and `tw-animate-css` (NOT the deprecated `tailwindcss-animate`).
- `@tailwindcss/node` `compile(css, { base, onDependency: () => {} })` — `onDependency` is REQUIRED or it throws; `build()` is synchronous.
- Vitest v4: `environmentMatchGlobs` was REMOVED. For `.test.tsx` use a top-of-file `// @vitest-environment jsdom` docblock; `test.include` must be `["tests/**/*.test.{ts,tsx}"]`.
- The `@` alias must be set in `vitest.config.ts` `resolve.alias` (Vitest does NOT read tsconfig `paths`).
- VSCode shows "Unknown at rule @theme/@utility/@apply" warnings on `globals.css` — harmless (stock CSS linter doesn't know Tailwind v4).

## Next steps (pick with the user)
1. **M5 — LLM contract + blocking lint (recommended next).** `AGENTS.md`/`CLAUDE.md`/`.cursor/rules` + stylelint/eslint that FAIL the build on hardcoded values / off-token classes / one-theme colors / stale manifest. This is the "real teeth" the page/manifest currently only gesture at. (The both-theme-completeness rule now has natural fixtures — the theme files.) **First clean the lint baseline** (see M4 fast-follows) so the new blocking gate starts green.
2. **M6 — Dogfood gate.** Drive an LLM to build a real feature end-to-end through the finished template.

**Recommended order: M5 → M6.** Each is plan → review → TDD-execute → merge. (M4 spec lives in `docs/superpowers/specs/`; M4 input was `docs/figma-style-sidebar-design-language.md` Part A.)

### M3a follow-ups (fast, deferred)
- **5 more themes** (Editorial, Warm, Pastel, Technical, Corporate) on the same machinery — Editorial needs a serif face added to `lib/fonts.ts` (the only non-value coupling).
- Swiss keeps **status colors functional** (not desaturated) — a deliberate call (badges must communicate); revisit if a stricter monochrome reading is wanted.

## First moves for the next agent
1. Read this file, then the spec (§ for the milestone you're doing).
2. `git log --oneline -15` and `npm test` + `npx playwright test` to confirm a green baseline on `main`.
3. Confirm with the user which milestone to start; write the plan; get it reviewed; execute on a branch.
