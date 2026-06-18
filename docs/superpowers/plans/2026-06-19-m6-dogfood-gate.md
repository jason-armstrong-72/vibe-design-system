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
- **Building-run subagent context = ONLY the clean checkout + the verbatim brief.** Do NOT pass AGENTS.md / design-system.md / HANDOFF / this plan / the spec / any gap hint. It must discover the contract itself.
- **PASS/FAIL table** = spec §4. **Required assertions** = spec §5. **Findings + termination bound** = spec §8.
- **Minimum PASS verdict** = 4/4 building runs green (2 per brief) + brownfield observation recorded + all 3 §5 assertions witnessed/recorded.
- **Termination bound:** >2 fixes to contract machinery (`lib/check`/`lib/tokens`/`AGENTS.md`/manifest) ⇒ M6 **BLOCKED**, stop and surface to user.

---

## Task 0: Branch + report skeleton

**Files:**
- Create: `docs/M6-DOGFOOD.md`
- Branch: `m6-dogfood`

- [ ] **Step 1: Confirm green baseline on main**

Run: `npm run check && npm test && npm run lint`
Expected: check ✓ (4 ds-disable), 312 vitest passing, lint 0 errors.

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
- Did it **discover** `AGENTS.md`/`CLAUDE.md`/`design-system.md` on its own? (assertion-relevant)
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

The subagent's `/pricing` files exist in the working tree. **Stage only the report** for now; the page/token stay unstaged pending the keep-decision (Task 8). If a run FAILED and needs a product fix, that's Task 7.

```bash
git add docs/M6-DOGFOOD.md
git commit -m "docs(m6): record run A1 (/pricing)"
```

- [ ] **Step 7: Reset the working tree for the next independent run**

Run A2 must be **independent** (fresh repo state, no memory of A1's page). Stash/discard the uncommitted page so A2 starts clean:

Run: `git stash -u` (keeps A1's output recoverable) — or `git checkout -- . && git clean -fd app/pricing` if A1 is not being kept.
Expected: working tree clean except committed report. **Decide per outcome:** if A1 passed and looks like the keeper candidate, `git stash -u` (recover in Task 8); if not, discard.

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
- [ ] **Step 8: Reset tree** for Task 4 (stash keeper candidate or discard).

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
- [ ] **Step 6: Commit record** — `git commit -m "docs(m6): record run B1 (/settings)"`.
- [ ] **Step 7: Reset tree** for Task 5.

---

## Task 5: Run B2 — /settings, fresh blind subagent (independent repeat)

Identical to Task 4, second independent subagent, same verbatim Brief B.

- [ ] **Step 1: Confirm clean tree.**
- [ ] **Step 2: Dispatch** fresh subagent + verbatim Brief B. Send nothing else.
- [ ] **Step 3: Observe** (Task 4 Step 3 criteria).
- [ ] **Step 4: Gate + suite**; capture.
- [ ] **Step 5: Grade + record** Run B2 in §3.
- [ ] **Step 6: Commit record** — `git commit -m "docs(m6): record run B2 (/settings)"`.
- [ ] **Step 7: Reset tree** for Task 6.

---

## Task 6: Brownfield observation (spec §2.3) — observational, not pass/fail

**Files:**
- Create (temporary): `app/legacy/page.tsx`, `components/legacy-card.tsx`
- Modify: `docs/M6-DOGFOOD.md` (§4)

- [ ] **Step 1: Confirm clean tree.**

- [ ] **Step 2: Seed legacy violations** in scanned dirs (`run.ts` walks `app` + `components`, excludes `components/ui`). Create `app/legacy/page.tsx` and `components/legacy-card.tsx` each containing realistic pre-existing mess: `className="bg-[#3b82f6] text-gray-500 p-[13px]"` and an inline `style={{ color: "red" }}`.

- [ ] **Step 3: Run the gate cold**

Run: `npm run check`
Expected: FAIL with multiple findings (hardcoded color, arbitrary length, default-palette, off-scale). Capture the **full output**.

- [ ] **Step 4: Record the adoption experience** in §4: how many violations fired on code "the user didn't just write," how legible the output is at that volume, whether any incremental-adoption path exists today (none — confirms the fast-follow need). This is a **finding**, not a pass/fail.

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

- [ ] **Step 1: Restore the keeper candidates** — `git stash pop` (or re-dispatch is NOT needed; reuse the stashed passing output) for the best `/pricing` and `/settings` runs. Run `npm run tokens` if a token was added so the manifest is fresh.

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
Expected: check ✓, vitest passing, lint 0, build ok, e2e 16 passed / 1 skipped (+ any new route still passes the gate).

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
