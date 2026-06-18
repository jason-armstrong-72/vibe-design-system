# M5 — LLM Contract + Blocking Lint — design

**Date:** 2026-06-18
**Status:** Design approved (brainstorm + 3-reviewer pass), pre-plan
**Milestone:** M5 of the design-system-starter (parent spec §6, §10).
**Depends on:** M1 (`lib/tokens/parse`), M2 (`generate`/`sync`/`regenerate`), M3a (theme files as both-theme fixtures), M4 (editor present — must pass the gate too).

> Implements parent spec §6 (the LLM contract: intent → enforcement → bonus). The *what* is in §6;
> this fixes the *how* with brainstorm + review decisions locked in. The gate's job, stated honestly
> (§6.2): **enforce that the extension procedure was followed** (both-theme + fresh manifest) and provide
> a **backstop** against hardcoded/off-token drift. The strongest layer — cleared `@theme` namespaces
> making off-token *color* classes compile to nothing — already shipped in M0; M5 is the backstop + the
> procedure-enforcement + the portable contract docs.

---

## 1. Decisions (brainstorm + 3-reviewer pass)

1. **Enforcement = a TDD'd `npm run check` script**, not custom eslint/stylelint rules. Rationale: the two
   highest-value checks (both-theme, manifest-fresh) are **whole-repo invariants**, not per-file AST
   visitors — they'd be a script anyway; one paradigm is more maintainable for a fork-and-own template,
   and it reuses M1's PostCSS parser. **Accepted trade-off (state in AGENTS.md):** no live editor squiggles
   — the gate fires on `npm run check` / pre-commit / CI, which is fine for an LLM-driven workflow (the LLM
   reads CI output + the manifest, not IDE squiggles).
2. **CI** ships (`.github/workflows/ci.yml`). The **blocking** gate = `check` + `test` + `build`. Playwright
   **e2e is a separate, non-blocking job** (`continue-on-error`) so browser flake can't red-bar a contract
   change; promote to blocking later once stable.
3. **Husky** pre-commit → `npm run check`.
4. **Bundled Claude skill (§6.3) = fast-follow** (spec marks it optional; "portable beats powerful").
5. **eslint** stays for code quality; fix its accidental scan of nested `.next` dirs.

### Corrections from the review (folded in — the design must be true of the repo's own source)

- **both-theme is COLOR-SEMANTIC-ONLY.** Check only the shadcn semantic roles + their `-foreground`
  partners (`lib/tokens/schema.ts` `COLOR_ROLES`). Non-color tokens (radius/spacing/type/…) and the
  `--brand-*` / `--chart-*` ramps legitimately live in `:root` only — a naive "every token in both blocks"
  rule false-positives on committed `globals.css` (11 `--brand-*` are `:root`-only). Verified.
  - **Implementation notes (from spec review):** `COLOR_ROLES` is currently a **module-private** const in
    `schema.ts` — the plan must **`export`** it (don't duplicate the set). `parseTokens` emits a row per
    `:root`/`.dark` declaration, so a role missing from `.dark` yields *no dark row* — the check keys on
    **presence-of-row** (role ∈ COLOR_ROLES has a light row but no dark row, or vice-versa), not on an
    empty value.
- **arbitrary-tailwind flags by KIND, allows token/layout arbitraries.** Flag: literal-color
  `bg-[#abc]`/`text-[rgb(...)]`, raw type/spacing literals `text-[10px]`/`p-[13px]`, **and off-scale
  numeric spacing `p-13`/`gap-7`** (spacing is the one group with no compile-gate — this is its only
  guard, parent §3/§6.2; do NOT defer it). **Allow:** arbitraries that reference a token
  (`bg-[color-mix(... var(--secondary))]`, `rounded-[min(var(--radius-md),…)]`) and layout arbitraries
  (`grid-cols-[…]`, `w-[…]`, `aspect-[…]`). **Exclude** vendored `components/ui/**` (shadcn) and the editor
  (see exclusions) — both legitimately use arbitraries. Verified the repo has these today (`components/ui/button.tsx`, `components/design-system/*`).
  - **Off-scale spacing — the rule, made concrete (the v4 `--spacing` multiplier has no enum, so we author
    one).** A curated, **adopter-editable** `ALLOWED_SPACING_STEPS` set lives in `lib/check/spacing-steps.ts`
    (the conventional Tailwind scale: `0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14,
    16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96`). Scope the **bare-numeric** off-scale
    check to the **padding/margin/gap/space** prefixes only (`p,px,py,pt,pr,pb,pl,ps,pe, m,mx,my,mt,mr,mb,ml,ms,me,
    gap,gap-x,gap-y, space-x,space-y`) — flag `p-<n>`/`gap-<n>` whose `<n>` ∉ the set. Do **not** bare-numeric-
    check `w/h/size/min-*/max-*/inset` (they share the spacing scale but commonly use large/legit values like
    `max-w-40`, `size-12`, `h-8` → false-positive minefield); those are still covered for **arbitrary literals**
    (`w-[10px]` flagged; `w-[var(--container-md)]` allowed). The dogfood self-pass (§6) constrains the set to
    cover everything the repo uses (`gap-1.5`, `px-2.5`, `py-3`, `gap-4`, …). Arbitrary `p-[13px]` is always
    flagged regardless of the set. Document that adopters tune `ALLOWED_SPACING_STEPS`.
- **hardcoded-color exempts variable-valued inline styles.** `style={{ background: v }}` where `v` is a
  `var(--token)` reference is legitimate (the token previews do this) — flag only **literal** color values
  (`#hex`, `rgb(`, `hsl(`, named). Guard `#` false-positives: ignore `href=`, `url(`, `id=`/anchors.
- **manifest-fresh: git-dirty form is authoritative in CI.** CI runs `npm run tokens` then
  `git diff --exit-code design-system.json design-system.md` (fail if dirty) — the spec's actual guarantee
  (§6.2/§6.4), and it accounts for `syncThemeColorMappings` **rewriting `globals.css`** when a new color
  mapping is needed (verified `regenerate.ts`/`sync.ts`). Local `npm run check` runs a fast in-process
  equivalent (run sync, assert `!changed`; rebuild manifest from synced css; compare) for speed. Covers
  **both** `.json` and `.md`.
- **eslint root cause = nested `.claude/worktrees/*/.next/`** (not top-level `.next`, already ignored).
  Fix: add `**/.next/**` + `.claude/**` to `globalIgnores` (fixes the IDE too) **and** pin
  `"lint": "eslint app components lib scripts tests"` (belt-and-suspenders).
- **Exclusions are tight, not whole-subtree.** Excluded from the source-scanning checks: the token sources
  (`app/globals.css`, `themes/*.css`), vendored `components/ui/**`, and the dev-only `editor-chrome.css`.
  The rest of `components/editor/**` (TSX) **is** subject to the gate (it styles via `--ed-*` vars, so it
  should pass); use a targeted `ds-disable` for any specific line that legitimately needs a literal.
- **Dogfood self-pass is M5:** a test asserts the template's own source passes `npm run check`. The
  LLM-builds-a-feature loop stays M6.

---

## 2. The gate — `scripts/check.ts` (`npm run check`)

A thin runner over **pure, fixture-tested** sub-checks in `lib/check/`. Each sub-check returns
`Finding[]` (`{ file, line, message, fix }`); the runner collects, applies `ds-disable` suppression,
prints actionable messages grouped by file, and exits non-zero if any survive.

```
lib/check/
  types.ts            # Finding, CheckResult
  ds-disable.ts       # parse + apply /* ds-disable: <reason> */ suppression
  hardcoded-color.ts  # literal #hex / rgb( / hsl( / named in app|components (.tsx/.ts/.css), scoped exclusions
  arbitrary-tailwind.ts # by-kind arbitrary + off-scale spacing in className string literals
  both-theme.ts       # semantic color roles present in both :root and .dark (reuse parseTokens + COLOR_ROLES)
  manifest-fresh.ts   # in-process: sync (assert !changed) + rebuild manifest + compare to committed (json+md)
  run.ts              # compose all sub-checks → findings → suppression → report
scripts/check.ts      # CLI entry: calls run(), prints, process.exit(code)
```

- **Sub-check purity:** each takes file contents / parsed tokens in, returns findings — no IO, no
  `process.exit` — so they're unit-testable on fixtures. `scripts/check.ts` + `lib/check/run.ts` own IO
  (glob source files, read globals/manifest) and exit codes.
- **`ds-disable`:** `/* ds-disable: <reason> */` (or `// ds-disable: <reason>`) on the line **before** a
  finding suppresses it; **reason is required** (a bare `ds-disable` is itself a finding). Line-scoped for
  the source-scanning checks (hardcoded-color, arbitrary-tailwind). For whole-repo checks (both-theme,
  manifest-fresh) `ds-disable` does **not** apply (they're not line-scoped) — their fix is to run the
  procedure, not suppress. The runner logs a count of active `ds-disable`s so they can't quietly proliferate.
- **Messages name the fix (parent §6.2 recovery UX — TDD the text):**
  - hardcoded color → `"hardcoded color — use bg-<token>/text-<token> or add a token (see design-system.md), then npm run tokens"`
  - arbitrary/off-token class → `"off-token utility '<cls>' — produces no styles; use a token utility (see design-system.md)"`
  - off-scale spacing → `"off-scale spacing '<cls>' — use a step on the --spacing scale or add a token"`
  - both-theme → `"--<name> is defined in :root but not .dark (or vice-versa) — add it to both blocks, then npm run tokens"`
  - manifest stale → `"design-system.{json,md} is stale — run npm run tokens and commit"`

---

## 3. LLM contract docs (parent §6.1)

- **`AGENTS.md`** — append a managed `<!-- BEGIN:design-system -->`/`<!-- END -->` block (mirrors the
  existing `nextjs-agent-rules` block). It contains **only stable, non-duplicating content**:
  1. **The one-line law:** style with Tailwind token utilities / CSS vars; never hardcode color, size,
     font, or duration; off-token classes produce no styles **and** fail `npm run check`.
  2. **Pointer** to the always-current generated **`design-system.md`** as the authoritative token table +
     usage rules + one-step extension procedure. (Do NOT copy the table or the procedure prose here — the
     generated doc owns them; hand-copies go stale.)
  3. **The loop (one sentence):** a token added via the procedure auto-appears on `/design-system` and
     becomes editable in the visual editor — extending the system beats hardcoding.
  4. **Recovery-command map** (so an LLM self-corrects from a red CI without a human):
     | Failure | Fix |
     |---|---|
     | stale manifest | `npm run tokens && git add design-system.*` |
     | one-theme color | add the token to both `:root` and `.dark` in `globals.css`, then `npm run tokens` |
     | hardcoded color / off-token class | replace with `bg-<token>` (or add a token via the procedure) |
     | deliberate one-off | `/* ds-disable: <reason> */` on the line above |
  5. The IDE-squiggle trade-off note (gate runs on `npm run check`/pre-commit/CI, not as-you-type).
- **`.cursor/rules/design-system.mdc`** — Cursor's current rules format; a **thin mirror/pointer** to the
  same law + `design-system.md`, not a third hand-maintained copy.
- **`CLAUDE.md`** — already `@AGENTS.md`-includes (verified) — covered, no duplication.
- **Portable set = AGENTS.md + CLAUDE.md(include) + `.cursor/rules`.** v0/Bolt have no repo-file convention
  to target — not covered (overreach for v1); the manifest + AGENTS.md travel with the repo.

---

## 4. eslint fix

- `eslint.config.mjs` `globalIgnores`: add `**/.next/**` and `.claude/**` (the 3326 "problems" are eslint
  scanning `.claude/worktrees/*/.next/` build chunks; top-level `.next/**` is already ignored but the glob
  is cwd-anchored so it misses nested worktree dirs). This fixes editor-integrated eslint too.
- `"lint": "eslint app components lib scripts tests"` — explicit source globs (belt-and-suspenders).
- After the fix, real source lints clean (verified: `eslint app components lib scripts` = 0 problems today).

---

## 5. CI + pre-commit

- **`.github/workflows/ci.yml`**, on push + PR:
  - **gate job (blocking):** `npm ci` → `npm run check` → `npm test` → `npm run build`. Plus the
    **manifest git-dirty step**: `npm run tokens` then `git diff --exit-code design-system.json design-system.md`.
  - **e2e job (non-blocking, `continue-on-error: true`):** `npx playwright install --with-deps` →
    `npx playwright test`. Run with `--workers=1` and a `git checkout -- app/globals.css` cleanup step
    (the editor specs write+restore `globals.css`; serialize + guard so a crashed test can't poison a
    re-run). Does NOT set `GALLERY=1` (gallery stays skipped).
- **Husky** `.husky/pre-commit` → `npm run check` (fast token gate before every commit). Adds `husky`
  devDep + a `"prepare": "husky"` script. (No `lint-staged` in v1 — `check` is whole-repo + fast.)
- **`npm run check`** is also runnable on demand and is what the recovery-command map points at.

---

## 6. Testing (parent §9 lint-fixture list)

- **Per sub-check, fixture unit tests** (`tests/check/*`):
  - hardcoded-color: a literal `#abc`/`rgb(...)` in a `.tsx`/`.css` fixture **fails**; a `var(--token)`
    inline style **passes**; an `href="#sec"`/`url(#id)` does **not** false-positive; an excluded path
    (`components/ui/**`, `editor-chrome.css`, `globals.css`) **passes**.
  - arbitrary-tailwind: `bg-[#abc]`, `text-[10px]`, `p-[13px]`, **`p-13`** each **fail**;
    `bg-[color-mix(... var(--x))]`, `rounded-[min(var(--radius-md),…)]`, `grid-cols-[…]`, `w-[…]`, and a
    plain token class (`bg-primary`, `p-4`) **pass**.
  - both-theme: a color role in `:root` missing from `.dark` **fails**; a `:root`-only `--brand-*` /
    non-color token **passes** (scoped to `COLOR_ROLES`).
  - manifest-fresh: a hand-edited token without regen **fails**; after regen **passes**; covers `.json`+`.md`.
  - ds-disable: a `/* ds-disable: reason */` suppresses the next-line finding; a **bare** `ds-disable`
    (no reason) **fails**; suppression is reported/counted.
  - **Message text** is asserted (the recovery UX is load-bearing — §6.2). The §2 message strings are the
    single source — export them as constants and have tests import them (don't re-type literals → no drift).
- **Dogfood self-pass** (`tests/check/self.test.ts` or an e2e-style node test): the template's **own**
  source passes `npm run check` with zero findings. (This is the gate's own correctness proof and forces
  the exclusions/exemptions to be right.)
- Existing 290 vitest + 16 e2e stay green; eslint fix doesn't change source behavior.

---

## 7. Out of scope (fast-follow)

- **Bundled Claude Code skill** (§6.3) — optional; the md guide + lint stand alone.
- **stylelint** — the script's hardcoded-color check already scans `.css`; a dedicated stylelint setup is
  unneeded for v1 (template convention: style via Tailwind utilities, not hand-written component `.css`).
- **Editor-integrated squiggles** (would need custom eslint/stylelint rules) — deferred deliberately.
- **Promoting e2e to a blocking CI job** — after it's proven stable.
- **Broader agent coverage** (v0/Bolt-specific files).

## 8. Honest boundaries (parent §6.2 — don't over-promise)

- **Layered model:** cleared `@theme` namespaces (M0) make off-token **color** classes compile to nothing
  — strongest, but a **silent no-op** in `className` (the element renders unstyled; `next build` does not
  error on its own). `npm run check` is the **build-failing backstop** that turns that silent no-op into a
  named failure. The both-theme + manifest-fresh checks are the **procedure-enforcement** teeth (they prove
  the LLM ran the extension procedure correctly — the headline). So M5's honest claim is **"enforces the
  procedure was followed + backstops drift,"** not "prevents all hardcoding."
- **`ds-disable` is a real bypass** — by design (a conscious, greppable, reason-carrying override). The
  runner counts them so proliferation is visible in review/CI logs.
- **Spacing** has no compile-gate (the `--spacing` multiplier isn't a clearable enum); the
  arbitrary-tailwind off-scale check is its **only** guard — hence it's in v1, not deferred.
- **The gate scans `className` string literals + inline styles + `.css`**, not values composed at runtime
  (`'#'+code`) — an accepted limitation (state it); the realistic drift vectors are literals, which are caught.
