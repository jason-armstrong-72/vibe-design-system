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
- **Status: 88 vitest + 4 Playwright e2e passing. 94 tokens.** Run `npm test` (vitest) and `npx playwright test` (e2e).

Plans for executed milestones live in `docs/superpowers/plans/` (M0–M3). **M3a/M4/M5/M6 are NOT yet planned.**

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
1. **M3a — Theme preset suite (recommended next).** The `/design-system` page is now camera-ready. Author **Swiss + Brutalist** as `themes/<name>.css` value-sets (per `DESIGN-BRIEF.md` mini-briefs), build `scripts/apply-theme.ts` (`npm run theme <name>` — swap the `:root`/`.dark` block, reusing M1's parse), screenshot the page under each theme → README gallery. Each theme must pass the WCAG-AA + no-overflow gates. **Plan it first, get it reviewed.**
2. **M4 — The editor (biggest milestone).** Dev-only visual token editor over the page. Primary visual input: **[docs/figma-style-sidebar-design-language.md](figma-style-sidebar-design-language.md)** (Part A = adopt; Part B = skip, it's for the QA-Restyle tool). Editor chrome uses its OWN dark UI tokens, separate from the design-system tokens it edits. Token editing only — pick-anywhere is cut to fast-follow. Consumes `data-token` + `lib/tokens/write.ts` behind a dev-only `NODE_ENV`-guarded API route.
3. **M5 — LLM contract + blocking lint.** `AGENTS.md`/`CLAUDE.md`/`.cursor/rules` + stylelint/eslint that FAIL the build on hardcoded values / off-token classes / one-theme colors / stale manifest. This is the "real teeth" the page/manifest currently only gesture at.
4. **M6 — Dogfood gate.** Drive an LLM to build a real feature end-to-end through the finished template.

**Recommended order: M3a → M4 → M5 → M6.** Each is plan → review → TDD-execute → merge.

## First moves for the next agent
1. Read this file, then the spec (§ for the milestone you're doing).
2. `git log --oneline -15` and `npm test` + `npx playwright test` to confirm a green baseline on `main`.
3. Confirm with the user which milestone to start; write the plan; get it reviewed; execute on a branch.
