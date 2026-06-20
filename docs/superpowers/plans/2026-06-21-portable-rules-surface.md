# Portable rules surface Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the design-system contract auto-load for non-Claude LLM tools (Gemini CLI, GitHub Copilot) and discoverable by any tool, as thin pointers to the single canonical `AGENTS.md` + `design-system.md` — guarded by a drift test.

**Architecture:** `AGENTS.md` stays the one contract source. Add `GEMINI.md` (`@AGENTS.md` include, mirrors `CLAUDE.md`) and `.github/copilot-instructions.md` (pointer). Fix `README.md` (add an any-tool pointer line; correct the stale Status block). A new `tests/surfaces.test.ts` enforces that every surface exists, points to the canonical source, and never inlines the contract.

**Tech Stack:** Markdown surface files, Vitest (root-level test like `tests/compile-gate.test.ts`).

**Spec:** [docs/superpowers/specs/2026-06-20-portable-rules-surface-design.md](../specs/2026-06-20-portable-rules-surface-design.md)

**Branch:** `portable-surface` (already created).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `GEMINI.md` | Gemini CLI auto-load hook | Create (`@AGENTS.md`) |
| `.github/copilot-instructions.md` | Copilot auto-load hook (pointer) | Create |
| `README.md` | human + any-tool discovery; honest status | Modify |
| `.cursor/rules/design-system.mdc` | Cursor auto-load (already correct) | Verify only |
| `AGENTS.md` | the single canonical contract | Unchanged (source) |
| `tests/surfaces.test.ts` | drift guard: exists / points-to-source / no-inline | Create |

---

## Task 1: Drift-guard test + the two new pointer surfaces

**Files:**
- Create: `tests/surfaces.test.ts`
- Create: `GEMINI.md`
- Create: `.github/copilot-instructions.md`

TDD: write the test (fails — new files missing + README assertion will fail later), then create the two files. The README assertions are added in Task 2; to keep this task green, write the **full** test now but expect the README test to fail until Task 2 — so split: write the non-README assertions here, add the README `it()` in Task 2.

- [ ] **Step 1: Write the failing test** — `tests/surfaces.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const POINTERS = [".cursor/rules/design-system.mdc", ".github/copilot-instructions.md"];
const TABLE_HEADER = "| Token | Group | Value"; // substring of the design-system.md table header
const NO_INLINE = [...POINTERS, "GEMINI.md"];

describe("portable rules surface", () => {
  it("all auto-load surfaces exist", () => {
    for (const f of ["CLAUDE.md", "GEMINI.md", ".cursor/rules/design-system.mdc", ".github/copilot-instructions.md"])
      expect(existsSync(resolve(f)), `${f} missing`).toBe(true);
  });

  it("GEMINI.md imports the canonical AGENTS.md (mirrors CLAUDE.md)", () => {
    expect(read("GEMINI.md")).toContain("@AGENTS.md");
  });

  it("each pointer surface references both AGENTS.md and design-system.md", () => {
    for (const f of POINTERS) {
      const c = read(f);
      expect(c, `${f} should point to AGENTS.md`).toContain("AGENTS.md");
      expect(c, `${f} should point to design-system.md`).toContain("design-system.md");
    }
  });

  it("no pointer surface inlines the contract (single source of truth)", () => {
    for (const f of NO_INLINE) {
      const c = read(f);
      expect(c, `${f} must not inline the token table`).not.toContain(TABLE_HEADER);
      expect(c, `${f} must not inline the design-system block`).not.toContain("BEGIN:design-system");
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/surfaces.test.ts`
Expected: FAIL — `GEMINI.md` and `.github/copilot-instructions.md` don't exist yet.

- [ ] **Step 3: Create `GEMINI.md`**

Exact content (one line + trailing newline), mirroring `CLAUDE.md`:

```
@AGENTS.md
```

- [ ] **Step 4: Create `.github/copilot-instructions.md`**

```markdown
# Copilot instructions

This project styles **only** with its design-system tokens. Before writing any UI code, read:

- `AGENTS.md` — the design-system contract + the failure→fix recovery table.
- `design-system.md` — the current token reference + the one-step extension procedure (`npm run tokens`).

Never hardcode a color, size, font, or duration; off-token classes produce no styles and fail `npm run check`.
To add a value the system lacks, follow the extension procedure in `design-system.md` — don't hardcode.
```

(No token table, no `BEGIN:design-system` block — pointer + the one-sentence law only.)

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run tests/surfaces.test.ts`
Expected: PASS (all 4 `it` blocks).

- [ ] **Step 6: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add tests/surfaces.test.ts GEMINI.md .github/copilot-instructions.md
git commit -m "feat(surface): GEMINI.md + Copilot pointer + drift-guard test"
```

---

## Task 2: README — any-tool pointer + fix stale Status

**Files:**
- Modify: `README.md`
- Modify: `tests/surfaces.test.ts` (append the README assertion)

- [ ] **Step 1: Add the failing README assertion** — append inside the `describe` in `tests/surfaces.test.ts`

```ts
  it("README points any-tool users at the contract and isn't stale", () => {
    const r = read("README.md");
    expect(r).toContain("AGENTS.md");
    expect(r).toContain("design-system.md");
    expect(r, "stale 'In progress' Status block must be replaced").not.toContain("In progress");
    expect(r, "README should point to the live status doc").toContain("docs/HANDOFF.md");
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/surfaces.test.ts`
Expected: FAIL — README lacks the pointer + still says "In progress", no `docs/HANDOFF.md`.

- [ ] **Step 3: Add the LLM pointer line** — `README.md`, immediately after the `**Stack:**` line

```markdown
**Building with an LLM?** Point your assistant at `AGENTS.md` + `design-system.md`. Claude Code, Cursor,
Gemini CLI, and GitHub Copilot auto-load the contract (`CLAUDE.md` / `.cursor/rules` / `GEMINI.md` /
`.github/copilot-instructions.md`); for any other tool (Windsurf, Cline, aider, web chat), open or paste
those two files.
```

- [ ] **Step 4: Replace the stale Status block** — `README.md`, the `## Status` section at the bottom

Replace the entire `## Status` section (the "In progress …" paragraph + the "Build order: … M5 LLM contract → M6 dogfood" line) with:

```markdown
## Status

**v1 complete (M0–M6)** + shipped fast-follows: F2 (one-step non-color extension), F3 (off-token-scale
check), F5 (honest standalone `check`). The token system, living `/design-system` page, visual editor, and
blocking lint are all in place. See [docs/HANDOFF.md](docs/HANDOFF.md) for the live status and remaining
fast-follows.
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx vitest run tests/surfaces.test.ts`
Expected: PASS (all 5 `it` blocks).

- [ ] **Step 6: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add README.md tests/surfaces.test.ts
git commit -m "docs(surface): README any-tool LLM pointer + correct stale Status block"
```

---

## Task 3: Full verification + merge

**Files:** none (verification + integration)

- [ ] **Step 1: Verify the .cursor rule is in place (spec §2: verify-only)**

Run: `cat .cursor/rules/design-system.mdc`
Expected: exists, `alwaysApply: true`, mentions `AGENTS.md` + `design-system.md`. No edit needed (the drift test already asserts this).

- [ ] **Step 2: Full gate**

Run: `npm run check && npm test && npm run lint`
Expected: check ✓ (4 ds-disable); all tests pass incl. the new `tests/surfaces.test.ts`; lint 0. (No `npm run tokens` needed — no token/manifest change in this work.)

- [ ] **Step 3: Verify before claiming done** — @superpowers:verification-before-completion

Confirm the three gate commands above are green and the working tree is clean (`git status`).

- [ ] **Step 4: Merge to main**

Use @superpowers:finishing-a-development-branch. Per project convention: `--no-ff`, full suite green before merge, delete branch after.

```bash
git checkout main && git merge --no-ff portable-surface && git branch -d portable-surface
```

- [ ] **Step 5: Mark the fast-follow done** — after merge, note in `docs/HANDOFF.md` that the portable rules surface shipped (GEMINI.md + Copilot pointer + README; multi-model *run* still deferred per spec §6). (Small follow-up edit on main, or fold into the merge.)

---

## Done =

`GEMINI.md` + `.github/copilot-instructions.md` exist as thin `@AGENTS.md` / pointer surfaces; README points any-tool users at `AGENTS.md` + `design-system.md` and no longer claims v1 is unbuilt; `.cursor` rule confirmed; `tests/surfaces.test.ts` passes and would fail if a surface were dropped or inlined the contract; `npm run check` + full suite + lint green; merged to main.
