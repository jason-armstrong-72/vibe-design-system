# Portable rules surface — design

**Date:** 2026-06-20
**Status:** Design approved (brainstorm), pre-plan
**Milestone:** v1 fast-follow — the **durable half** of the "multi-model portability" item (HANDOFF). The validation *run* was split off and dropped after a 3-agent review rated it the lowest-leverage remaining fast-follow with blocking validity holes; the run record lives at the bottom of this doc as deferred context.
**Depends on:** the existing contract (`AGENTS.md`, generated `design-system.md`).

> **What this ships:** the template's contract auto-loads for **non-Claude** LLM tools, not just Claude.
> Today only Claude (via `CLAUDE.md → @AGENTS.md`) and Cursor (via `.cursor/rules/design-system.mdc`)
> auto-surface the contract. A vibe coder using Gemini CLI, Copilot, Windsurf, Cline, aider, or web chat
> gets nothing automatic. This adds the missing hooks — as **thin pointers to one canonical source**, so
> there is no duplicated contract text to drift.

---

## 1. Principle (load-bearing)

`AGENTS.md` is the **single canonical contract** — the existing `<!-- BEGIN:design-system -->…<!-- END:design-system -->`
block (lines 7–30), already the source that `CLAUDE.md` includes verbatim via `@AGENTS.md`. Every surface
this spec adds is a **pointer** to `AGENTS.md` + the generated `design-system.md`. **No surface inlines the
contract block.** This is the same DRY stance the repo already takes (CLAUDE.md, the `.cursor` rule) and the
drift-guard test (§3) enforces it mechanically.

Non-goal: per-tool *copies* of the contract. They would drift the moment the token set changes.

---

## 2. Surfaces

| File | Tool | Action | Form |
|---|---|---|---|
| `GEMINI.md` | Gemini CLI | **Create** | `@AGENTS.md` (one line, mirrors `CLAUDE.md`) |
| `.github/copilot-instructions.md` | GitHub Copilot | **Create** | short pointer to `AGENTS.md` + `design-system.md` |
| `README.md` | humans + any other tool | **Modify** | add an "LLM" pointer line + fix the stale Status block |
| `.cursor/rules/design-system.mdc` | Cursor | **Verify only** | already correct (`alwaysApply: true`, points to AGENTS/design-system) — no edit |

### 2.1 `GEMINI.md`
One line: `@AGENTS.md`. Gemini CLI's memory file resolves `@path` imports for `.md` targets, and `AGENTS.md`
is a `.md` file, so the import resolves to the same canonical contract Claude/Cursor see. **Caveat (documented,
not assumed):** Gemini CLI does **not** read `AGENTS.md` by default — the file must be named exactly `GEMINI.md`
for the import to load, and import support is version-dependent. The plan includes a **verification note** in
the file's commit message / a one-line README aside telling a Gemini user to run `/memory show` and confirm the
design-system contract text appears in the concatenated context. We ship the standard hook; we don't claim it's
verified on the user's Gemini version (the orchestrator can't run Gemini).

### 2.2 `.github/copilot-instructions.md`
Copilot's documented repository-instructions path (`.github/` already exists, holds `workflows/`). A short
pointer, e.g.:
> This project styles **only** with its design-system tokens. Before writing UI code, read `AGENTS.md`
> (the contract + failure→fix table) and `design-system.md` (the current token reference + one-step
> extension procedure). Never hardcode a color/size/font/duration; off-token classes fail `npm run check`.

No token values, no rules copied — a pointer plus the one-sentence law. (The one-sentence law is acceptable
duplication of *intent*, not of the *contract data*; the drift-guard test only forbids inlining the token
table / the `BEGIN:design-system` block.)

### 2.3 `README.md`
Two edits:
1. **Add an "LLM" pointer** under the intro (or near the stack line):
   > **Building with an LLM?** Point your assistant at `AGENTS.md` + `design-system.md`. Claude Code, Cursor,
   > Gemini CLI, and GitHub Copilot auto-load it (`CLAUDE.md` / `.cursor/rules` / `GEMINI.md` /
   > `.github/copilot-instructions.md`); for any other tool (Windsurf, Cline, aider, web chat), open or paste
   > those two files.
2. **Fix the stale Status block.** It currently reads "In progress … Build order: … ✅ M4 → M5 LLM contract →
   M6 dogfood" — implying M5/M6 are unbuilt. Replace with the true state: **v1 complete (M0–M6)** + the
   shipped fast-follows (F2 one-step non-color extension, F3 off-token-scale check, F5 honest standalone
   check). Keep it short; point to `docs/HANDOFF.md` for the live status rather than re-listing everything.

---

## 3. Drift-guard test

A small vitest (`tests/surfaces.test.ts`, sibling of the root-level `tests/compile-gate.test.ts`) that enforces
the single-source guarantee:

- **Each pointer surface references the canonical source.** `GEMINI.md` contains `@AGENTS.md`;
  `.github/copilot-instructions.md` and `.cursor/rules/design-system.mdc` each mention `AGENTS.md` and/or
  `design-system.md`.
- **No pointer surface inlines the contract.** None of `GEMINI.md`, `.github/copilot-instructions.md`,
  `.cursor/rules/design-system.mdc` contains the `BEGIN:design-system` marker or a copy of the token table
  header (e.g. the literal `| Token | Group | Value` row) — i.e. the contract data lives only in
  `AGENTS.md`/`design-system.md`.
- **The surfaces exist.** Presence assertions for `GEMINI.md`, `.github/copilot-instructions.md`,
  `.cursor/rules/design-system.mdc`, `CLAUDE.md`.

This makes "we added pointers, not copies" a checked invariant, not a hope — consistent with how the repo gates
everything (`npm run check`, the M3a parity/contrast tests).

---

## 4. Out of scope

- **The multi-model validation run** (drive GPT/Gemini through the M6 briefs). Dropped this iteration —
  reviewers found it the lowest-leverage remaining item and, as scoped, invalid (the M6 solutions +
  `docs/M6-DOGFOOD.md` leak the answers into any checkout; Brief A's color gap is too soft to exercise
  extension; paste-back can't verify "unaided"; auto-surfaced-only tests the easy question). If revisited, it
  needs: a stripped, history-clean checkout; a forcing brief; frozen human script + full transcripts; ≥2
  runs/model; and honest "portability under auto-surfacing" framing. Recorded in §6 below for a future spec.
- **Per-tool contract copies** — DRY violation, see §1.
- **Cursor `.mdc`** content changes — it's already correct.

---

## 5. Done =

`GEMINI.md` + `.github/copilot-instructions.md` exist as thin pointers to the canonical `AGENTS.md` +
`design-system.md`; the README tells any-tool users where the contract is and no longer claims v1 is
unbuilt; the `.cursor` rule is confirmed in place; the drift-guard test passes and would fail if a future edit
inlined the contract or dropped a pointer; `npm run check` + the full suite stay green. Net: a vibe coder on
Gemini/Copilot/Cursor/Claude gets the contract auto-loaded, and on any other tool gets a one-line pointer to it.

---

## 6. Deferred — the multi-model run (context for a future spec)

3-agent review of the original bundled design surfaced these holes the run must fix before it's worth doing:
- **Answer leakage:** `/pricing`, `/settings`, `app/promo-banner.tsx`, and `docs/M6-DOGFOOD.md` (briefs +
  gap-proofs + answers) + narrating git log all leak into any branch off `main`. Need a stripped,
  history-clean checkout (or fresh clone with those removed).
- **Forcing brief:** M6 found Brief A's color gap "too soft" — `brand` is a legit reuse, so organic color
  extension never fired. Reusing it re-imports the dud; need a brief with no honest existing-token fit.
- **Verification under paste-back:** "#2 recovered unaided" / "#1 chose to extend" are gameable without full
  verbatim transcripts + a frozen, pre-registered set of human messages.
- **Honest framing:** auto-surfaced-only tests "builds with an auto-loaded contract," not HANDOFF's open
  "finds the contract when not auto-surfaced." Don't conflate.
- **Restate assertion #3:** the invented-token gate-hole it targeted was closed by F2/F3/F5 — re-baseline
  against the current gate.
- **Confounds:** model vs harness vs human vs N. Identical isolated checkout, fresh Claude baseline on it,
  ≥2 runs/model, log the surfacing mechanism per tool.
- **Isolation mechanics:** fresh clone to a temp dir + remove after (a worktree/branch is easy to pollute when
  a human drives an external GUI).
