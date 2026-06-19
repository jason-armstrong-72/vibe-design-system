# M6 — Dogfood Gate Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NOTE — this is a VALIDATION milestone, not TDD code.** There is no production feature to red-green. The "implementation" is *executing the pre-registered run protocol* in the spec: [docs/superpowers/specs/2026-06-18-m6-dogfood-gate-design.md](../specs/2026-06-18-m6-dogfood-gate-design.md). Tasks are bite-sized **setup → dispatch-a-blind-building-run → observe → record → verdict** steps. The building runs are dispatched as **fresh contract-blind subagents** (spec §3); the orchestrator does setup/observation/grading (spec §3 forbids the orchestrator helping a run mid-flight).

**Goal:** Prove a fresh LLM ships two real features (`/pricing`, `/settings`) through the finished template's contract — discover the rulebook itself, build with tokens, hit a genuine gap, run the extension procedure, recover from a red `npm run check` unaided, pass check/test/lint/build — with zero hand-fixes to the contract; and record the confirmed contract holes.

**Architecture:** A throwaway branch `m6-dogfood`. Per spec: prove-the-gap → 4 blind building runs (2 briefs × 2) → 1 brownfield observation → assertion audit → findings ledger → verdict in `docs/M6-DOGFOOD.md` → human visual checkpoint gates whether any product surface is kept. Pass/fail is read off each run against the pre-registered table (spec §4).

**Tech Stack:** Existing repo only — `npm run check` (`scripts/check.ts` → `lib/check/`), `npm run tokens`, `npm test` (vitest), `npm run lint` (eslint), `npm run build` (next), Playwright for the visual checkpoint. No new code dependencies.

---

## Pre-flight (read before any task)

- **The orchestrator NEVER messages a building run beyond the frozen brief** (spec §4 — doing so FAILS that run). Setup, observation, recording, fixing-the-product-between-runs all happen *outside* a run.
- **Frozen briefs** live in spec §2.1 (A — pricing) and §2.2 (B — settings). Copy them **verbatim**; do not paraphrase or add hints.
- **Building-run subagent task = ONLY the verbatim brief.** Do NOT pass HANDOFF / this plan / the spec / any gap hint / any coaching toward the contract or the fix. **The contract (`AGENTS.md` via root `CLAUDE.md`) auto-loads into the subagent via the harness — this is INTENTIONAL and realistic** (spec §3, user decision "test the real first day"): it is how a real Claude Code user receives the contract. So a run starting with the contract available is correct; M6 tests whether it *builds with it*, not whether it *finds it*. **Do not** try to hide/blind the contract. (Self-discovery is a multi-model fast-follow, §9.)
- **PASS/FAIL table** = spec §4. **Required assertions** = spec §5. **Findings + termination bound** = spec §8.
- **Minimum PASS verdict** = 4/4 building runs green (2 per brief) + brownfield observation recorded + all 3 §5 assertions witnessed/recorded.
- **Termination bound:** >2 fixes to contract machinery (`lib/check`/`lib/tokens`/`AGENTS.md`/manifest) ⇒ M6 **BLOCKED**, stop and surface to user.

---

## On a FAIL event (any building run) — the fix→re-run loop (spec §8)

A building run can FAIL (a FAIL event in spec §4, or the 4 commands not green). When it does, **do NOT hand-fix the run's output and do NOT message the running subagent.** Follow this loop — it is the most consequential part of the protocol:

1. **Classify the cause** (record in the findings ledger §6): is it a **product/contract** cause (contract-discovery, extension-procedure, manifest-legibility, gate-error-message, both-theme/contrast, brownfield) or a **subagent-coding** cause (bad JSX/React/layout the contract had nothing to do with)?
2. **Subagent-coding cause** → that run is a wash; discard its output, **re-dispatch a fresh subagent** with the same verbatim brief. It does not count against the termination bound. (A model that simply codes badly is noise, not a contract finding.)
3. **Product/contract cause** → log it against the milestone that should have caught it (M2/M2.5/M5) with a one-line "why missed", then **fix the PRODUCT** (docs/manifest/check) *outside* a run, **increment the contract-machinery fix counter** if the fix touched `lib/check`/`lib/tokens`/`AGENTS.md`/manifest, commit the fix, then **re-dispatch a fresh subagent** on the same brief.
4. **Check the bound after every contract-machinery fix:** if the counter exceeds **2**, STOP → verdict **BLOCKED** → surface to user (see end of plan). Do not keep polishing.
5. A fresh re-run **replaces** the failed run. The **2-green-per-brief** minimum (spec §4) must still be met by passing runs after any fix.

---

## Task 0: Branch + report skeleton

**Files:**
- Create: `docs/M6-DOGFOOD.md`
- Branch: `m6-dogfood`

- [ ] **Step 1: Confirm green baseline on main**

Run: `npm run check && npm test && npm run lint`
Expected: all green — check ✓ (4 ds-disable), vitest all passing (~312), lint 0 errors. (Counts are sanity checks, not load-bearing; "all green" is the gate.)

- [ ] **Step 2: Create throwaway branch**

Run: `git checkout -b m6-dogfood`
Expected: `Switched to a new branch 'm6-dogfood'`.

- [ ] **Step 3: Create the report skeleton**

Create `docs/M6-DOGFOOD.md` with these headings (filled as we go):

```markdown
# M6 — Dogfood Gate — run record

**Protocol:** docs/superpowers/specs/2026-06-18-m6-dogfood-gate-design.md
**Verdict:** _PENDING_

## 1. Frozen briefs (verbatim)
### Brief A — /pricing
### Brief B — /settings

## 2. Gap-proof (§6)
### Brief A — promo color
### Brief B — radius knob

## 3. Runs
### Run A1 / A2 / B1 / B2 — summary, FAIL events, assertions witnessed, final evidence

## 4. Brownfield observation (§2.3)

## 5. Required assertions (§5) — witnessed?
- [ ] #1 extension procedure unaided (color + radius-knob)
- [ ] #2 red-gate self-recovery
- [ ] #3 invented-token gate hole — confirmed?

## 6. Findings ledger (§8)

## 7. Verdict
```

- [ ] **Step 4: Paste both briefs verbatim into §1** from spec §2.1 / §2.2.

- [ ] **Step 5: Commit**

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(m6): dogfood run record skeleton + frozen briefs"
```

---

## Task 1: Prove the gap (spec §6) — BEFORE any building run

If an existing token satisfies a brief's need, that brief's forcing function never fires. Prove it's real, record proof in the report §2.

**Files:**
- Modify: `docs/M6-DOGFOOD.md` (§2)

- [ ] **Step 1: Enumerate color tokens (Brief A)**

Run: `grep -E '^\s*--[a-z0-9-]+:\s*oklch' app/globals.css`
Confirm none reads as a premium/celebratory **promo** color: `accent` is near-zero chroma; `brand-*` is the product UI ramp; `chart-*` are data-viz; `success/info/warning/destructive` carry fixed semantic meaning. Record the per-candidate one-line reasoning in §2.

- [ ] **Step 2: Decide Brief A gap outcome**

If a token *does* plausibly fit (e.g. a vivid `chart-*` a model could justify as "celebratory"), per spec §6 either (a) tighten Brief A's look to a hue family the set lacks, OR (b) accept the brief tests "use the right existing token" — and **write which, in §2, before running.** Expected default: gap is real, no tightening needed.

- [ ] **Step 3: Prove Brief B radius gap**

Run: `grep -n -- '--radius:' app/globals.css`
Expected: `--radius: 0.625rem` (10px). Confirm this is NOT already "soft/very rounded" (it's a moderate default), so "softer corners" genuinely requires editing the knob. Record in §2. (If it were already large, the knob-edit wouldn't fire — note that.)

- [ ] **Step 4: Commit**

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(m6): gap-proof for both briefs (§6)"
```

---

## Task 2: Run A1 — /pricing, fresh blind subagent

**Files:**
- Subagent creates: `app/pricing/page.tsx` (+ any components it chooses)
- Possibly modifies: `app/globals.css` (extension), regenerates `design-system.{md,json}`
- Modify (orchestrator, after): `docs/M6-DOGFOOD.md` (§3 Run A1)

- [ ] **Step 1: Dispatch the blind building subagent**

Dispatch a `general-purpose` subagent. Its ENTIRE prompt = a one-line framing + the verbatim Brief A. Example:

> You are working in this repository (a checked-out project). Do the following task end to end, then report what you did. Task: "[paste Brief A from spec §2.1 verbatim]"

Do NOT add anything about tokens, the contract, AGENTS.md, `npm run check`, or any gap. Let it explore. Run it to completion. **Send it nothing else.**

- [ ] **Step 2: Observe — capture the run for grading**

While/after it runs, note against spec §4 + §5:
- Did it **consult/follow** the auto-loaded contract (`AGENTS.md`/`design-system.md`), or ignore it? (The contract is auto-present per spec §3 — we observe whether it *acts on* it, not whether it *finds* it.)
- Did it build with token utilities, or reach for hardcoded/arbitrary classes?
- Did it hit a **red `npm run check`** and recover from the output alone? (§5 #2)
- Did it run the **extension procedure** for the promo color? (§5 #1 color leg)
- Any **FAIL event** (spec §4): edited contract machinery? hardcoded-and-`ds-disable`d to dodge the promo gap? gave up?

- [ ] **Step 3: Run the gate + suite on the result**

Run: `npm run check && npm test && npm run lint && npm run build`
Expected for a PASS run: all green. Capture the output (paste tails into §3 Run A1).

- [ ] **Step 4: Inspect the extension, if any (assertion #3 — the gate hole)**

If it added a color token, check whether it landed in BOTH blocks and whether the gate would have caught a one-theme/low-contrast version:

Run: `grep -n -- '--<newname>' app/globals.css` (substitute the token it added)
Record in §3/§5 #3: present in `:root` only or both? If it shipped green while one-theme or visibly weak in dark — that's the **predicted gate hole confirmed** (spec §5 #3). If it correctly added both + good contrast, note that the *human checkpoint* (not the gate) is still what guarantees it.

- [ ] **Step 5: Grade the run + record**

Mark Run A1 PASS/FAIL in §3 per the spec §4 table. List every FAIL event (if any) and which assertions it witnessed. Paste a tight run summary + the green evidence.

- [ ] **Step 6: Commit the record (NOT the page yet — keep-decision is later, Task 8)**

The subagent's `/pricing` files exist in the working tree. **Stage only the report** for now; the page/token stay unstaged pending the keep-decision (Task 8). **If this run FAILED, follow the "On a FAIL event" loop above** (classify → fix product or re-dispatch → re-run fresh) before moving on.

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(m6): record run A1 (/pricing)"
```

- [ ] **Step 7: Reset the working tree for the next independent run (keeper scheme — N1/N2)**

Run A2 must be **independent** (fresh repo state, no memory of A1's page). Keep **at most one keeper candidate per brief**, in a **named, path-scoped** stash so the stack stays unambiguous:
- **If A1 PASSED and is the current best `/pricing` candidate:** save just its output to a named stash, replacing any prior pricing candidate:
  ```bash
  git stash drop "$(git stash list | grep keeper-pricing | head -1 | cut -d: -f1)" 2>/dev/null || true
  git stash push -u -m keeper-pricing -- app/pricing app/globals.css design-system.json design-system.md
  ```
- **If A1 FAILED or is not the keeper:** discard its output: `git checkout -- app/globals.css design-system.* && git clean -fd app/pricing`.

- [ ] **Step 8: Gate on a clean tree before the next dispatch**

Run: `git status --porcelain`
Expected: empty (only committed report on the branch; no stray untracked files the subagent may have created elsewhere). If non-empty, clean the residue (`git checkout -- . && git clean -fd <paths>`) until clean — an unclean tree contaminates the next "independent" run.

---

## Task 3: Run A2 — /pricing, fresh blind subagent (independent repeat)

Identical to Task 2, second independent subagent, same verbatim Brief A.

- [ ] **Step 1: Confirm clean tree** — `git status` shows only committed report, no `app/pricing`.
- [ ] **Step 2: Dispatch** a fresh `general-purpose` subagent with the one-line framing + verbatim Brief A (as Task 2 Step 1). Send nothing else.
- [ ] **Step 3: Observe** (Task 2 Step 2 criteria).
- [ ] **Step 4: Gate + suite** — `npm run check && npm test && npm run lint && npm run build`; capture.
- [ ] **Step 5: Inspect extension** (Task 2 Step 4).
- [ ] **Step 6: Grade + record** Run A2 in §3.
- [ ] **Step 7: Commit record** — `git add docs/M6-DOGFOOD.md && git commit -m "docs(m6): record run A2 (/pricing)"`.
- [ ] **Step 8: Reset tree** for Task 4 using the **keeper scheme (Task 2 Steps 7–8)** — if A2 beats A1 as the `/pricing` keeper, replace the `keeper-pricing` stash with A2's output; else discard A2. End on a clean `git status --porcelain`.

---

## Task 4: Run B1 — /settings, fresh blind subagent

**Files:**
- Subagent creates: `app/settings/page.tsx` (+ components); may modify `app/globals.css` (`--radius` knob), regenerate manifest.
- Modify (orchestrator): `docs/M6-DOGFOOD.md` (§3 Run B1)

- [ ] **Step 1: Confirm clean tree.**
- [ ] **Step 2: Dispatch** a fresh `general-purpose` subagent with the one-line framing + **verbatim Brief B** (spec §2.2). Send nothing else.
- [ ] **Step 3: Observe** — same §4/§5 criteria, PLUS specific to Brief B:
  - Interactive-state styling: did it use token utilities for **focus ring / hover / disabled / validation-error**, or reach for `focus:ring-blue-500` / `hover:bg-gray-100` / `disabled:opacity-50` / hardcoded reds (the off-token classes the gate should catch)?
  - **Radius:** did it find and edit the `--radius` knob in `globals.css` (§5 #1 radius leg), or hardcode `rounded-[Npx]` + try to suppress (dodge ⇒ FAIL per §4)? Or ignore the "softer" ask (brief-intent-not-met note, not a FAIL)?
- [ ] **Step 4: Gate + suite** — `npm run check && npm test && npm run lint && npm run build`; capture.
- [ ] **Step 5: Grade + record** Run B1 in §3.
- [ ] **Step 6: Commit record** — `git add docs/M6-DOGFOOD.md && git commit -m "docs(m6): record run B1 (/settings)"`.
- [ ] **Step 7: Reset tree** for Task 5 using the **keeper scheme (Task 2 Steps 7–8)**, but with stash name **`keeper-settings`** and paths `app/settings app/globals.css design-system.json design-system.md`. End on a clean `git status --porcelain`.

---

## Task 5: Run B2 — /settings, fresh blind subagent (independent repeat)

Identical to Task 4, second independent subagent, same verbatim Brief B.

- [ ] **Step 1: Confirm clean tree.**
- [ ] **Step 2: Dispatch** fresh subagent + verbatim Brief B. Send nothing else.
- [ ] **Step 3: Observe** (Task 4 Step 3 criteria).
- [ ] **Step 4: Gate + suite**; capture.
- [ ] **Step 5: Grade + record** Run B2 in §3.
- [ ] **Step 6: Commit record** — `git add docs/M6-DOGFOOD.md && git commit -m "docs(m6): record run B2 (/settings)"`.
- [ ] **Step 7: Reset tree** for Task 6 using the **keeper scheme (Task 2 Steps 7–8)**, `keeper-settings` (if B2 beats B1). End on a clean `git status --porcelain`.

---

## Task 6: Brownfield observation (spec §2.3) — observational, not pass/fail

**Files:**
- Create (temporary): `app/legacy/page.tsx`, `components/legacy-card.tsx`
- Modify: `docs/M6-DOGFOOD.md` (§4)

- [ ] **Step 1: Confirm clean tree.**

- [ ] **Step 2: Seed legacy violations** in scanned dirs (`run.ts` walks `app` + `components`, excludes `components/ui`). Create `app/legacy/page.tsx` and `components/legacy-card.tsx` with a realistic mix — some the gate catches, some it doesn't (this is deliberate, see Step 4):
  - **Caught:** `className="bg-[#3b82f6] p-[13px] bg-gray-500 border-gray-300"` (arbitrary-color, arbitrary-length, default-palette ×2).
  - **NOT caught (verified against `lib/check/`):** `className="text-gray-500"` (`arbitrary-tailwind` palette prefixes omit `text-`) and an inline `style={{ color: "red" }}` (`hardcoded-color` matches only hex/rgb/hsl, not the keyword `red`).

- [ ] **Step 3: Run the gate cold**

Run: `npm run check`
Expected: **FAIL**, exit 1, with findings for `bg-[#3b82f6]` (arbitrary-color), `p-[13px]` (arbitrary-length), and `bg-gray-500`/`border-gray-300` (default-palette). **`text-gray-500` and the inline `style` produce NO finding.** Capture the **full output** + the exact count.

- [ ] **Step 4: Record the adoption experience** in §4 — TWO findings:
  1. **Volume/legibility:** how many violations fired on code "the user didn't just write," how readable the output is at that volume, and that no incremental-adoption path exists today (confirms the brownfield baseline fast-follow).
  2. **Inverse coverage gap:** `text-gray-500` (text-palette) + inline-`style` keyword colors **slip through uncaught** — a real hole that overlaps the M5 fast-follow ("named colors / `text-` palette not caught"). Both are **findings**, not pass/fail.

- [ ] **Step 5: Revert the seed**

Run: `git checkout -- . && git clean -fd app/legacy components/legacy-card.tsx`
Expected: working tree clean; `npm run check` ✓ again.

- [ ] **Step 6: Commit the observation**

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(m6): brownfield adoption observation (§2.3)"
```

---

## Task 7: Assertion audit + findings ledger + verdict (spec §5, §8)

**Files:**
- Modify: `docs/M6-DOGFOOD.md` (§5, §6, §7)

- [ ] **Step 1: Audit the 3 required assertions (§5).** For each, confirm it was witnessed across Runs A1/A2/B1/B2 and cite the run:
  - **#1** — a run added a **color** via the procedure unaided AND a run edited the **`--radius` knob** (not hardcoded). If the radius leg didn't fire (every B run ignored "softer" or hardcoded), record as brief-intent-not-met / finding.
  - **#2 red-gate self-recovery** — at least one run hit a red `npm run check` and recovered from the output alone. **If no run naturally tripped it:** per spec §5 #2, do a targeted seeded run — start a fresh subagent on a checkout where you've pre-added one hardcoded value (e.g. `bg-[#7c3aed]` in a starter file), give it the verbatim brief, and observe whether it reads the red `check` output and self-corrects with **zero hints**. Seeding the failure is allowed; hinting the fix FAILS it. Record as Run A3/B3.
  - **#3 invented-token gate hole** — record what actually happened: did any invented color ship green while one-theme or weak-in-dark? (Predicted YES = hole confirmed.) If every run happened to add both blocks with good contrast, note the gate *still wouldn't have caught* a bad one (cite `both-theme` COLOR_ROLES-only + contrast-not-in-check) — confirmed by construction.

- [ ] **Step 2: Compile the findings ledger (§6/§8).** For each stall/fail with a product cause: what stalled, class (contract-discovery / extension-procedure / manifest-legibility / gate-error-message / both-theme-or-contrast / brownfield), product fix applied (if any), and which earlier milestone (M2/M2.5/M5) should have caught it + why it was missed.

- [ ] **Step 3: Check the termination bound (§8).** Count fixes to contract machinery (`lib/check`/`lib/tokens`/`AGENTS.md`/manifest). If **>2**, mark verdict **BLOCKED** and STOP — surface to user with the ledger. (Trivial fixes — page copy, an `ALLOWED_SPACING_STEPS` step, a doc typo — don't count, but are logged.)

- [ ] **Step 4: Write the verdict (§7).** **PASS** iff 4/4 building runs green (2 per brief) + brownfield recorded + all 3 §5 assertions witnessed/recorded + ≤2 contract-machinery fixes. Else **BLOCKED** (or partial) with the ledger naming holes to fix before v1.

- [ ] **Step 5: Commit**

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(m6): assertion audit, findings ledger, verdict"
```

---

## Task 8: Human visual checkpoint + keep-decision (spec §7) — HUMAN GATE

The keep-decision is NOT automatic. Screenshots → user reviews → user signs off any kept surface + any new token (the section-by-section token review).

**Files:**
- Restore (if keeping): the keeper run's `app/pricing/**`, `app/settings/**`, `app/globals.css` extension, regenerated `design-system.{md,json}`
- Temporary: `e2e/__m6_shots__.spec.ts` (throwaway screenshot spec, gitignored shots)

- [ ] **Step 1: Restore the keeper candidates by name** (the named stashes from the keeper scheme):

```bash
git stash pop "$(git stash list | grep keeper-pricing  | head -1 | cut -d: -f1)"
git stash pop "$(git stash list | grep keeper-settings | head -1 | cut -d: -f1)"
```
Resolve any conflict in `app/globals.css` (both stashes may touch it — take the union of both added tokens / the radius edit). Then run `npm run tokens` so the manifest reflects the merged globals. (If only one brief produced a keeper, pop just that one.)

- [ ] **Step 2: Capture screenshots** — write a throwaway Playwright spec that loads `/pricing` and `/settings` in **light and dark** (≥1 theme), saves PNGs to `e2e/__shots__/` (gitignored). Run it.

Run: `npx playwright test e2e/__m6_shots__.spec.ts`
Expected: PNGs written.

- [ ] **Step 3: Self-critique** — `Read` the PNGs. Check: featured tier reads as premium/celebratory (Brief A), form states visible (focus ring/disabled/error — Brief B), softer corners applied, dark mode not broken (esp. any invented color — the gate-hole risk). Note issues.

- [ ] **Step 4: HUMAN CHECKPOINT** — present screenshots to the user. Ask: keep `/pricing`? keep `/settings`? approve the new token (same review the other 94 got: name, light value, dark value, contrast)? Wait for explicit sign-off. **Do not proceed without it.**

- [ ] **Step 5: Apply the keep-decision.**
  - If **keeping**: ensure token (if any) is in both blocks + manifest regenerated (`npm run tokens`); remove the throwaway shot spec. Commit the kept surface in its **own** commit:
    ```bash
    rm e2e/__m6_shots__.spec.ts
    git add app/ design-system.json design-system.md
    git commit -m "feat(m6): /pricing + /settings example routes (+ <token>), user-approved"
    ```
  - If **not keeping**: discard the page output, keep only the report. `git checkout -- . && git clean -fd app/pricing app/settings e2e/__m6_shots__.spec.ts`.

---

## Task 9: Finalize (only if verdict = PASS)

**Files:**
- Modify: `docs/HANDOFF.md`, `docs/specs/2026-06-16-design-system-starter-design.md` (§10 M6)

- [ ] **Step 1: Mark M6 done** in parent spec §10 M6 and in HANDOFF (status line + "Where we are"), citing run count + linking `docs/M6-DOGFOOD.md`. Move any newly-confirmed holes into the HANDOFF M6 fast-follow block (already seeded).

- [ ] **Step 2: Full green re-check on the final tree**

Run: `npm run check && npm test && npm run lint && npm run build && npx playwright test`
Expected: all green — check ✓, vitest passing, lint 0, build ok, e2e all passing (~16 passed / 1 skipped) (+ any kept route still passes the gate). Counts are sanity checks; "all green" is the gate.

- [ ] **Step 3: Commit docs**

```bash
git add docs/HANDOFF.md docs/specs/2026-06-16-design-system-starter-design.md
git commit -m "docs(m6): mark M6 complete; v1 milestones done"
```

- [ ] **Step 4: Merge to main**

```bash
git checkout main
git merge --no-ff m6-dogfood -m "Merge M6: dogfood gate — contract validated end-to-end"
git branch -d m6-dogfood
```

- [ ] **Step 5: Confirm** — `git log --oneline -5` shows the merge; `npm run check` ✓ on main.

---

## If verdict = BLOCKED

Do NOT merge. The report (`docs/M6-DOGFOOD.md`) + findings ledger are the deliverable. Commit them on `m6-dogfood`, surface the ledger to the user with the specific contract holes to fix (against M2/M2.5/M5), and stop. The contract fixes become their own milestone/branch, then M6 re-runs fresh.
