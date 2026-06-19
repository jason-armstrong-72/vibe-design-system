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
- ✅ **M5** — LLM contract + blocking lint. `npm run check` (`scripts/check.ts` → pure sub-checks in `lib/check/`): **hardcoded-color**, **arbitrary-tailwind + off-scale-spacing**, **both-theme** (semantic `COLOR_ROLES` only — ramps/non-color exempt), **manifest-fresh** (in-process; CI also git-dirty), **off-token-scale** (F3 fast-follow — named scale steps not defined in `@theme`). `/* ds-disable: <reason> */` escape hatch (reason required, counted). Scans `app`+`components` only; excludes `components/ui/**` (vendored), `editor-chrome.css`, token sources. `AGENTS.md` has a `design-system` contract block (pointer to generated `design-system.md` + failure→fix recovery table); `.cursor/rules/design-system.mdc` mirrors it; `CLAUDE.md` `@AGENTS.md`-includes. **Husky** pre-commit runs `npm run check`. **CI** (`.github/workflows/ci.yml`): blocking gate (check+lint+test+build+manifest-git-dirty) + non-blocking e2e job. eslint `.next`/`.claude` scan fixed; `lint` pinned to source. Dogfood self-pass test: the template passes its own gate (4 justified `ds-disable`s on sub-12px labels). Honest scope: M5 **enforces the procedure was followed + backstops drift** (the M0 cleared-namespace compile-gate is the strongest layer; this makes drift loud).
- ✅ **M6 — Dogfood gate (the last v1 milestone). QUALIFIED PASS (2026-06-19).** A pre-registered run protocol (spec + plan + 2 review rounds each), executed: 4 blind building runs (`/pricing` ×2, `/settings` ×3 incl. one re-run) + a **seeded red-gate recovery run** + a brownfield observation + a direct gate-hole probe. **Validated the headline loop with zero contract hand-fixes:** a fresh LLM builds a real feature with tokens gate-green, **color-extends end-to-end unaided** (`:root`+`.dark`→`npm run tokens`→manifest+AA), and **recovers from a red `npm run check` unaided** (the genuinely-new M5 machinery, never tested before — works). **Findings (full ledger in [docs/M6-DOGFOOD.md](M6-DOGFOOD.md)):** non-color extension is unreliable (F2); a silent-no-op gate blind-spot (F3); the earlier "invented-color ships green" flag was **overstated** — the full `check && test` gate catches it (F5); brownfield has no baseline mode (F6). **Kept:** `/pricing` worked-example route (token-only). See the M6 fast-follows block below.
- **Status: 312 vitest + 16 Playwright e2e passing (+1 gallery, skipped without GALLERY=1). 94 tokens. `/pricing` + `/design-system` routes.** Run `npm test`, `npm run check`, `npm run lint`, `npx playwright test`.

**v1 is COMPLETE (M0–M6).** Plans for executed milestones live in `docs/superpowers/plans/` (M0–M6). Specs in `docs/superpowers/specs/` (M4, M5, M6). Next work = the fast-follow lists per milestone (M6 fast-follows below are the freshest; F2 + F3 promoted to near-term).

### M5 fast-follows (deferred)
- Bundled **Claude Code skill** (§6.3 bonus — md guide + lint stand alone without it).
- **stylelint** (the check script scans `.css` already); **promote the e2e CI job to blocking** once proven stable.
- Off-scale checks on `w/h/size`; off-token palette detection beyond the curated family list.
- Lint nit: arbitrary-color catches `#/rgb(a)/hsl(a)/oklch/oklab` brackets but not `bg-[red]` named colors (no named-color list yet).

### M6 fast-follows (ran 2026-06-19 — QUALIFIED PASS; findings ledger in [docs/M6-DOGFOOD.md](M6-DOGFOOD.md))
M6 validated the headline loop (LLM builds with tokens + **color-extends** + **recovers from a red gate**, all unaided, zero contract hand-fixes — see the seeded run S1). It surfaced these, ordered by severity:
- **🔴 F2 — non-color extension is unreliable (PROMOTE — near-term, not "someday").** Same "softer corners" task, 3 blind runs, 3 outcomes: one **edited contract machinery** (`lib/tokens/utilities.ts`) → would fail CI; one worked but left the token **undocumented in the manifest**; one used built-in classes that **silently no-op**. **0/3 found the single-knob `--radius` path.** Fix: document a one-step non-color path + nudge the single-knob + have the manifest list derived/@theme steps.
- ✅ **F3 — gate blind-spot: silent no-op classes. DONE 2026-06-19.** New `off-token-scale` sub-check (`lib/check/off-token-scale.ts`) flags named scale-step utilities (`rounded-2xl`, `text-8xl`, `shadow-xl`, `font-black`) whose step isn't defined in `@theme` — across 4 families (radius/shadow/text-size/font-weight). Keyed on `@theme` (self-maintaining), vocab-gated (no false positives on `text-center`/`rounded-full`), variant-aware (`md:rounded-2xl`). Found + fixed 2 latent `rounded-2xl` no-ops in `/design-system` (silently flat since M3). Spec+plan under `docs/superpowers/`.
- **🟡 F5 — invented-color gate hole is NARROW (earlier note was OVERSTATED).** Correction: the `npm run check` **script alone** misses invented-color theme-completeness/contrast (both-theme = COLOR_ROLES-only; no contrast over globals) — **BUT the full blocking gate (`check && test`, what CI + husky run) catches it** via `manifest-fresh` + `apply-theme` neutral-identity + `parity` + auto-paired `contrast` (`lib/tokens/contrast.ts` pairs ANY `--x`/`--x-foreground`). Empirically verified (S1 + a direct probe). **It does NOT ship one-theme/below-AA green** through the real gate. Residual: a color token with no `-foreground` sibling isn't contrast-checked. Fix: align the `check` *script* to what the tests already enforce so it's honest standalone.
- **🟡 F6 — brownfield: no incremental/baseline mode.** 9 violations on ~12 lines of seeded legacy code ⇒ "whole app is red" at scale. Slip-throughs: `text-gray-500` (text-palette), keyword `color:"red"` (inline non-hex), `rounded-[5px]` (arbitrary radius). Fix: baseline/incremental check + close the slip-throughs. (Audience clones the template = greenfield, so lower priority.)
- **🟢 F1 — LLMs reuse over extend.** Default to grabbing an existing (even semantically-wrong, e.g. `warning`-as-promo) token rather than extending, when one is syntactically usable. Optional `AGENTS.md` nudge ("if no token fits the *meaning*, extend").
- **Multi-model portability + self-discovery.** v1 M6 proves the loop for **Claude only**, with the contract **auto-loaded** (the real Claude delivery). Re-run with non-Claude (Cursor+GPT / Gemini) + a portable rules surface; that's where "does the LLM find the contract when it's not auto-surfaced" gets tested.
- **Kept from M6:** `/pricing` worked-example route (token-only, no new tokens). `/settings` + a `--radius-2xl` step were built+validated but dropped (layout not reference-worthy / token only needed by the dropped page).

### M4 fast-follows (deferred, all on the same machinery)
- Draggable **cubic-bezier curve editor** (easing is preset+text now) + **layered shadow builder** (shadow is text now).
- **Pick-anywhere** (reverse-resolution) + **gradient builder**.
- Contrast **warning** workflow beyond the read-only badge.
- 3 review nits (non-blocking): block-switch resets a same-token in-flight save-state to idle (cosmetic; write still lands); writeback debounce keys by token name not `token|theme` (very narrow cross-block race); contrast badge hides for `var()`-indirected colors.
- ✅ **Lint debt — RESOLVED in M5.** The "158 errors" were eslint scanning nested `.claude/worktrees/*/.next/` build chunks; fixed via `globalIgnores` (`**/.next/**` + `.claude/**`) + pinning `lint` to source globs. `npm run lint` = 0.

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
**v1 (M0–M6) is COMPLETE.** Remaining work is fast-follows. Recommended near-term, in priority order:
1. **M6 F2 + F3 (promoted — they silently break real features).** F2: a documented one-step **non-color** extension path + nudge toward the single `--radius` knob + manifest lists derived/@theme steps. F3: the `check` flags named off-token utilities outside the system's scale (`rounded-2xl`), not just `[...]` arbitraries. (M6 fast-follows block above.)
2. **Align the `check` script to the test suite (F5)** so it's honest standalone (both-theme over all `:root` colors; fold `contrast` in).
3. **Multi-model run** (Cursor+GPT / Gemini) + portable rules surface — proves "point your LLM at it" beyond Claude.
4. Other per-milestone fast-follows: 5 more themes, bezier/shadow editors, pick-anywhere, Claude skill, stylelint, brownfield baseline (F6). Plan → review → execute as always.

### M3a follow-ups (fast, deferred)
- **5 more themes** (Editorial, Warm, Pastel, Technical, Corporate) on the same machinery — Editorial needs a serif face added to `lib/fonts.ts` (the only non-value coupling).
- Swiss keeps **status colors functional** (not desaturated) — a deliberate call (badges must communicate); revisit if a stricter monochrome reading is wanted.

## First moves for the next agent
1. Read this file, then the spec (§ for the milestone you're doing).
2. `git log --oneline -15` and `npm test` + `npx playwright test` to confirm a green baseline on `main`.
3. Confirm with the user which milestone to start; write the plan; get it reviewed; execute on a branch.
