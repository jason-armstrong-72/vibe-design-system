# M6 — Dogfood Gate — design (pre-registered run protocol)

**Date:** 2026-06-18
**Status:** Design approved (brainstorm + 3-reviewer challenge pass), pre-plan
**Milestone:** M6 of the design-system-starter (parent spec §10). **The last v1 milestone.**
**Depends on:** M0–M5 all shipped (token system, manifest, `/design-system` page, 3 themes, editor, the contract + `npm run check` + CI + husky).

> Implements parent spec §10 M6 — the **dogfood gate**: drive an LLM to build a real feature through the
> finished template and prove the contract holds with zero hand-fixes. The product's actual job ("build
> with an LLM") is the acceptance test, not "lint fails on a hardcode."
>
> **This milestone is a VALIDATION, not a code feature.** There is no production code to TDD. This document
> is therefore a **pre-registered run protocol**: the briefs, the pass/fail rules, the run count, the
> termination bound, and the required assertions are all fixed *here, in writing, before any run* — so a
> green M6 measures the product, not the author's ability to write a brief the contract happens to handle.

---

## 0. Why pre-registration (the 3-reviewer challenge)

Three independent skeptics challenged the first draft (test-validity, realism, process-rigor lenses). All
three returned **NEEDS CHANGES — "designed to pass / theater risk."** The convergent failures, and the
fixes folded into this protocol:

| Reviewer finding | Fix (in this protocol) |
|---|---|
| Brief leaked the answer — "vibrant promo highlight" ≈ the manifest's own worked `--highlight` example | Briefs describe the **feature**, never the mechanism; **frozen** here before any run (§2) |
| N=1 is an anecdote, not a gate | **2 briefs × ~2 fresh runs each** + brownfield run; all required runs pass clean (§3) |
| Pricing too narrow — never hits interactive states / non-color extension / both-theme | Brief B is a **stateful form**; forces focus/hover/disabled/validation + a **non-color** extension (§2) |
| The genuinely-new M5 machinery (red-gate → self-recover) is untested; M6 ≈ M2.5 re-run | **Required assertion #2** (§5): LLM hits a red `check` and recovers from the error output **alone** |
| Pass/fail undefined → player-and-referee bias | **Pre-registered PASS/FAIL event table** (§4) — pass/fail reads off the transcript mechanically |
| Contract pre-loaded into context = cheat (real failure mode = LLM never reads it) | **Resolved differently after a plan-review finding (§3):** the Claude Code harness *auto-surfaces* `AGENTS.md`/`CLAUDE.md` to every agent in this repo — for the **Claude v1 audience that auto-load IS the product's intended delivery**, so testing with it = the real first-run experience, not a cheat. Subagent still gets **only the brief as its task** (no gap hints, no spec/HANDOFF/plan). "Does a tool surface the contract when it *doesn't* auto-load?" → **multi-model fast-follow** (§9). |
| Validation permanently mutates the user-curated token set, bypassing token review | Runs on a **throwaway branch**; keeping `/pricing`/any token is a **separate, user-signed-off** decision (§7) |
| "Gap" asserted, not proven — `brand-*`/`chart-*` might satisfy "vibrant" | **Prove the gap before running** (§6) — confirm no existing token fits each brief |
| Fix-loop unbounded; if it fires, M5 shipped broken | **Bounded**: >2 contract-machinery fixes = M6 **BLOCKED**; each fix logged against the milestone that missed it (§8) |

Out of v1 scope, documented as **fast-follows** (§9): multi-model portability (non-Claude agents +
`AGENTS.md` being Claude/Cursor-shaped), and the brownfield *fix* (baseline/incremental check) if the
brownfield run shows it's non-trivial.

---

## 1. What M6 proves (and what it does not)

**Proves:** a fresh LLM, given a realistic feature brief and a clean checkout of the template **with the
contract auto-surfaced as a real Claude Code user receives it**, will (a) build with token utilities and
obey the contract, (b) when the design needs a value the system lacks, run the extension procedure
end-to-end, (c) recover from a blocking-gate failure using only the gate's own output, and (d) ship green
(`check` + `test` + `lint` + `build`) — with **zero hand-fixes to the contract**.

**Does NOT prove (explicit non-goals, stated so a PASS isn't overclaimed):** that an LLM will **find the
contract when a tool doesn't auto-surface it** (self-discovery is out of v1 scope — the Claude harness
auto-loads `AGENTS.md`; "does a non-auto-loading tool surface it" is the multi-model fast-follow, §9); that
*every* LLM/model does this (Claude-only — §9); that adoption onto an existing messy codebase is graceful
(brownfield is *observed*, not *solved* — §2.3, §9); that the visual output is good (that's the human
checkpoint, §7, not the gate). M6 certifies the **contract loop**, not aesthetics and not portability.

---

## 2. The briefs (FROZEN — do not edit after the first run)

Each brief is what a real "vibe coder" would type. It describes a **feature and a look**, never a token or a
procedure. The forcing function is the *design need*, which the LLM must translate into "no existing token
fits → extend." No brief mentions tokens, colors-by-value, `npm run check`, `npm run tokens`, `AGENTS.md`,
or "the design system" beyond what a normal user would say.

### 2.1 Brief A — Pricing page (forces a COLOR extension)

> Build a pricing page at `/pricing` for my SaaS. Three plans: **Starter** (free), **Pro** ($29/mo),
> **Team** ($99/mo). Each plan is a card with the name, the price, a one-line description, a list of 5
> features (each with a check mark), and a "Get started" button. **Pro is our most popular plan — make it
> the hero of the page: it should feel premium and celebratory and clearly stand out from the other two so
> people's eyes land on it first.** Make it look polished and work on mobile (cards stack).

*Intended forcing function:* "premium / celebratory / stand out" has no honest match in the neutral set
(`accent` is low-chroma; `brand-*` reads as the product's own UI; `chart-*` reads as data; `warning` is a
semantic amber that's wrong for a promo). The LLM should add a dedicated featured/promo color via the
extension procedure. **Gap must be proven before running — §6.**

### 2.2 Brief B — Account settings form (forces interactive STATES + a NON-COLOR extension)

> Build an account settings page at `/settings`. It has a form: **Name** (text), **Email** (text, show a
> validation error if it's not a valid email), **Notification frequency** (a select), and a **Save changes**
> button that is **disabled until the user edits something**. Rows should highlight on hover and show a
> clear focus ring when tabbed through. Add a **"Danger zone"** section at the bottom with a **Delete
> account** button. Show a friendly **empty state** if there's nothing configured yet. **I want the whole
> form to feel softer and more rounded than the default — gentler corners on the cards and inputs.**

*Intended forcing functions:* (a) focus ring / hover / disabled / validation-error coloring exercise the
interactive-state tokens (`--ring`, `--opacity-*`, `--destructive`) where LLMs reach for `focus:ring-blue-500`
out of training-data habit — the off-token classes the gate exists to catch; (b) "softer / more rounded
than default" exercises the **single-knob radius path**.

**Be precise about what the radius leg tests (review correction G3).** Radius is **one knob**
(`app/globals.css`: `--radius: 0.625rem`; sm/md/lg/xl derived via `calc()` in `@theme`). "Softer / more
rounded" = the LLM must find that knob and *edit one line*, then `npm run tokens` — NOT add a new token. So
this leg tests **"does the LLM discover and edit the radius knob in `globals.css` instead of hardcoding
`rounded-[12px]`"** — a real risk (the temptation is an arbitrary class the gate rejects), but it is the
*easy, documented single-knob* path, not the hard one. **Adding a genuinely-new non-color token** (a new
shadow level, a new spacing step) is procedure-**undocumented** (the one-step procedure is color-only —
HANDOFF: spacing/radius/shadow are "single-knob / fixed / rare") and is an **explicit non-goal / fast-follow
(§9)**, not something M6 must prove. **Gap must be proven before running — §6** (confirm the default radius
isn't already soft, else even the knob-edit doesn't fire).

### 2.3 Brownfield run (OBSERVATIONAL — not a pass/fail gate)

Simulate adopting the contract onto an existing messy app. **Concretely (review G5):** on the throwaway
branch, add seeded "legacy" code a migrating user would already have — `app/legacy/page.tsx` +
`components/legacy-card.tsx` containing a realistic mix: `bg-[#3b82f6]` (arbitrary color — **caught**),
`p-[13px]` (arbitrary length — **caught**), `bg-gray-500` / `border-gray-300` (default palette — **caught**),
**plus** `text-gray-500` and inline `style={{ color: "red" }}` which — verified against `lib/check/` — are
**NOT caught** (`arbitrary-tailwind`'s palette prefixes omit `text-`; `hardcoded-color` matches only
hex/rgb/hsl, not the keyword `red`). These land in the **scanned** dirs (`run.ts` walks `app` + `components`,
excludes `components/ui`). Run `npm run check`. **Observe and record** the adoption experience
— the "I installed your design system and now my whole app is red" first impression: how many violations
fire on code the user didn't just write, how legible the output is at that volume, whether there's any path
to adopt incrementally. **Also record the inverse finding:** the `text-gray-500` + inline-`style` keyword
color **slip through uncaught** — a real coverage gap (overlaps the M5 fast-follow "named colors / `text-`
palette not caught"). **Revert the seeded files after observing.** **This run does not pass or fail M6**;
it produces a finding. If the finding warrants a fix (a baseline / incremental-check mode) and that fix is
non-trivial, it is a **fast-follow** (§9), not M6 scope.

---

## 3. Run setup (per subagent)

- **Runs:** Brief A × 2 fresh subagents, Brief B × 2 fresh subagents (4 total), + 1 brownfield run. Each
  subagent is **independent** (fresh context, no memory of prior runs).
- **Context given to each building subagent = the clean checkout + ONLY the verbatim frozen brief (§2) as
  its task.** No HANDOFF, no spec, no plan, no hint about any gap, no coaching toward the contract or the
  fix. **The contract (`AGENTS.md` via root `CLAUDE.md`) auto-loads into the subagent via the harness — this
  is intentional and realistic:** it is exactly how a real Claude Code user receives the contract (the file's
  whole purpose is to be auto-surfaced by the tool). So the run legitimately starts with the contract
  available, and M6 tests whether the LLM *builds with it correctly*, not whether it *finds it* (plan-review
  finding: self-discovery is un-testable here and belongs to the multi-model fast-follow §9 anyway — a
  non-auto-loading tool is where "never opens the contract" actually bites). What the subagent must still do
  unaided: translate the brief into token-based code, hit the gap, run the extension procedure, and recover
  from a red gate — none of which the auto-loaded contract does for it.
- **Model:** Claude (what we can cleanly drive here). Multi-model = fast-follow (§9).
- **Observer (the orchestrator) role:** dispatch, then **only observe and record**. The observer sends the
  subagent **nothing beyond the frozen brief** for the duration of the run (sending anything else = a FAIL
  event, §4). The observer's separate job — fixing the *product* between runs when a finding warrants —
  happens **outside** a run, on the branch, and is logged (§8).

---

## 4. Pre-registered PASS/FAIL event table

Pass/fail is read off each run's transcript against this table. Almost all events are **mechanical** (a
file was/wasn't edited; a command was/wasn't green; the observer did/didn't send a message). Exactly **one**
event needs a judgment — "hardcode-and-`ds-disable` to *dodge* a gap vs. a legitimate one-off" — and the
rule for it is pre-registered below so the judgment is bounded, not free.

Each building run is a PASS iff it ends with `/pricing` (or `/settings`) shipped and
`npm run check && npm test && npm run lint && npm run build` all green, **and** no FAIL event occurred.

**Minimum for a PASS verdict (review G4):** **2 green runs per brief (4 total)** with no FAIL event, plus
the brownfield observation (§2.3) recorded. A fix→re-run (§8) *replaces* a failed run — the failed run
becomes a finding, and the 2-green-per-brief minimum still must be met after any fix.

**PASS-preserving subagent actions (expected, healthy — NOT failures):**
- Reading/consulting any repo file, including the auto-loaded `AGENTS.md` / `design-system.md`.
- Iterating against a **red `npm run check`** — editing its own code and re-running until green.
- Running `npm run tokens` after adding a token (the extension procedure working as designed).
- Using `/* ds-disable: <reason> */` **with a genuine reason** on a legitimate one-off.
- Multiple build / test attempts; reading CI/check output; re-reading the manifest.

**FAIL-triggering events (any one fails that run):**
- The **observer** sends the subagent any message beyond the frozen brief (hint, nudge, correction).
- The subagent edits any **contract machinery**: `lib/check/**`, `lib/tokens/**`, `AGENTS.md`,
  `CLAUDE.md`, `.cursor/rules/**`, the manifest generator, or `design-system.{md,json}` by hand (the
  manifest is regenerated by `npm run tokens`, never hand-edited).
- The subagent **hardcodes a value and `ds-disable`s it to *dodge* a genuine gap** instead of extending.
  **Pre-registered rule for this one judged call:** it is a FAIL (dodge) iff the brief's *core design need*
  demanded that value and the system's documented affordance was to extend — i.e. **(a) color:** the brief
  needed a promo color, no existing token fits, and instead of running the extension procedure the subagent
  hardcoded + suppressed; **(b) radius:** the brief asked for softer corners and instead of editing the
  `--radius` knob the subagent hardcoded `rounded-[Npx]` + suppressed. It is **NOT** a FAIL (legitimate
  one-off, PASS-preserving) when the `ds-disable` is on a genuine incidental that the brief's core need did
  not call for (e.g. a 1px hairline, a sub-12px label like the template's own 4 justified disables) with a
  real reason. *A run that simply leaves the default (ignores the "softer" ask) ships green but misses the
  brief's intent — that is recorded as a `brief-intent-not-met` note, not a gate FAIL; the run still counts
  for its interactive-states purpose.*
- Any **human edit** to the subagent's produced files during the run.
- The subagent gives up / declares it cannot proceed.

---

## 5. Required assertions (each must be OBSERVED at least once across the runs)

A PASS on all runs is necessary but not sufficient — these three must each be witnessed and cited in the
report, or M6 is **incomplete** even if every run went green:

1. **Extension procedure works unaided** — at least one run adds a **color** token via the procedure
   (`:root`+`.dark` → `npm run tokens` → `bg-<name>` compiles) with no observer help, **and** at least one
   run edits the **single `--radius` knob** (the documented single-knob path) rather than hardcoding a
   radius. *Note (G3): the radius leg tests the knob-edit path, not adding a new non-color token — that
   harder, procedure-undocumented case is an explicit non-goal / fast-follow (§9), not required here.*
2. **Red-gate self-recovery (the genuinely-new M5 machinery)** — at least one run **hits a red
   `npm run check`** and **recovers using only the gate's own output** (the failure→fix recovery table /
   error message), with **zero observer hints**. M2.5 proved the manifest is buildable-from; this proves the
   *blocking gate guides recovery* — which has never been tested by anyone but the contract's author. If no
   run naturally trips the gate, the observer may (per protocol, logged) **seed** the failure — *not by
   editing the frozen brief (§2)*, but by adding one pre-existing hardcoded value to the **checkout the fresh
   subagent inherits** (a file already present when it starts; `hardcoded-color` will trip on it in `app/`).
   The subagent then meets the red gate naturally while building. *Seeding the failure is allowed; hinting
   the fix is not.*
3. **Invented-token theme-completeness + contrast — PREDICTED GAP, confirmed as an M6 finding (review
   E1/E2).** This is **not** a coverage the gate has — verified against `lib/check/`:
   - `both-theme` (`lib/check/both-theme.ts`) iterates **only `COLOR_ROLES`** (a fixed shadcn/status
     allowlist in `lib/tokens/schema.ts`). A subagent-**invented** color like `--highlight` is **not** in
     that set, so adding it to `:root` only **passes the gate**.
   - **Contrast is not in `npm run check` at all** (`run.ts` imports only hardcoded-color / arbitrary /
     both-theme / manifest-fresh). It runs as a test over the **3 shipped preset `themes/*.css`**, never over
     `app/globals.css` (parent spec §10 lists editor contrast-warning as a *post-v1 fast-follow*).

   So the gate does **not** enforce that an LLM-invented color is theme-complete or AA-accessible. M6's job
   here is to **confirm this hole**: a run that adds a one-theme or low-contrast promo color and **ships
   green** is the **expected, recorded finding** — and the **human visual checkpoint (§7) is the only thing
   that catches it today**. Required observation = *what actually happens* when an invented token is
   one-theme/low-contrast (does it ship green? does dark mode look broken?). Fast-follow (§9): extend
   `both-theme`/contrast to cover invented color tokens. *(This corrects the earlier draft, which falsely
   asserted the gate catches these.)*

---

## 6. Prove the gap BEFORE running (per brief)

Before dispatching runs for a brief, confirm the forcing function is real — that **no existing token
honestly satisfies the brief's design need.** If an existing token does fit, the LLM will (correctly) use
it, the extension procedure never fires, and the run goes green having tested nothing.

- **Brief A (promo color):** enumerate every color token and confirm none reads as a premium/celebratory
  promo highlight (`accent` low-chroma; `brand-*` = product UI; `chart-*` = data-viz; status colors carry
  fixed meaning). If one *does* plausibly fit, **tighten the brief's look** (e.g. specify a hue family the
  set lacks) or accept the brief tests "uses the right existing token" instead — and say which, in the spec,
  before running.
- **Brief B (radius):** confirm "softer / more rounded than default" genuinely requires changing the
  `--radius` knob (i.e. the default isn't already soft) — else the non-color forcing function doesn't fire.

Record the gap-proof in the report (§7) so the test's validity is auditable.

---

## 7. Deliverables & commit order

1. **`docs/M6-DOGFOOD.md`** (repo-root `docs/`, alongside `HANDOFF.md`) **— lands regardless of outcome
   (PASS, BLOCKED, or partial).** Contains: the frozen
   briefs (§2), the gap-proof (§6), the PASS/FAIL table (§4), **per-run transcripts/summaries** (what the
   subagent did, where it stalled, every FAIL event), the **findings ledger** (§8), which required
   assertions were witnessed (§5), the brownfield observation (§2.3), and final green evidence
   (`check`/`test`/`lint`/`build` output) for the runs that passed.
2. **Branch:** all runs happen on a **throwaway branch** (`m6-dogfood`). The report + any *contract/doc
   product fixes* are the merge-worthy output.
3. **Keeping `/pricing` / `/settings` / any new token is a SEPARATE, deliberate decision** — NOT an
   automatic M6 deliverable. After the runs, the **human visual checkpoint** (screenshots, light+dark, ≥1
   theme — per the project's visual-work convention) gates it: the user reviews and explicitly approves.
   Any new token the user chooses to keep goes through the **section-by-section token review** the other 94
   tokens got (the user "has strong design opinions" — a subagent-invented color does not bypass that). Kept
   route + token land in their **own commit, after** checkpoint approval.
4. **`docs/HANDOFF.md` + parent spec §10 M6 marked done** only when the verdict is **PASS** under this
   protocol (4/4 required runs green, all §5 assertions witnessed/recorded), citing the run count and the
   findings ledger.
5. Merge `--no-ff` to `main`, delete branch (project convention).

---

## 8. Findings ledger & termination bound

A **finding** = anything that made a run stall or fail for a **product/contract** reason (not a
subagent-coding reason). For each: what stalled, the class (contract-discovery / extension-procedure /
manifest-legibility / gate-error-message / `both-theme`-or-contrast / brownfield), the product fix applied,
and **which earlier milestone's done-criteria should have caught it** (M2 / M2.5 / M5) with a one-line "why
it was missed."

- **Fix → re-run fresh** is the loop (mirrors M2.5: find a contract flaw, fix the *product*, re-validate).
- **Termination bound: more than 2 fixes to contract *machinery* (`lib/check`/`lib/tokens`/`AGENTS.md`/
  manifest) = M6 BLOCKED** and surfaced to the user — because by the project's own logic (M2.5 exists to
  catch contract flaws *early and cheaply*), needing >2 such fixes at M6 means M5/M2 shipped a contract that
  doesn't hold, which is a process finding worth stopping on, not polishing past.
- **Trivial fixes don't count against the bound** (page copy, adding a legitimate step to the
  adopter-editable `ALLOWED_SPACING_STEPS`, a doc typo) — but are still logged.

---

## 9. Fast-follows (documented, out of v1 M6 scope)

- **Multi-model portability + contract self-discovery.** Re-run the gate with a non-Claude agent
  (Cursor+GPT / Gemini CLI) and add a generic/portable rules surface if `AGENTS.md` (Claude/Cursor-shaped)
  doesn't get auto-loaded. This is where "**does the LLM find the contract when the tool doesn't
  auto-surface it**" actually gets tested — v1 M6 (Claude) starts with the contract auto-loaded (the real
  Claude delivery, §3), so it cannot and does not test self-discovery. The product says "point your LLM at
  it"; v1 M6 only proves it for Claude with auto-load.
- **Brownfield adoption fix.** If §2.3's observation shows the "all red" experience is bad, build a
  baseline / incremental-check mode (enforce only on new/changed code). Observed in M6; *fixed* later.
- **Non-color extension procedure**, if §5 assertion #1 shows radius/spacing/shadow extension isn't
  followable from the docs — either document the path or make it one-step like color. Covers **adding a new
  non-color token** (new shadow level / spacing step), which the color-only one-step procedure does not.
- **Gate coverage of invented color tokens (from §5 #3 / E1-E2).** Today `both-theme` only enforces the
  fixed `COLOR_ROLES`, and contrast isn't in `npm run check` — so an LLM-invented color can ship one-theme
  or below-AA and pass the gate. Fast-follow: extend `both-theme` to **any** color token present in `:root`
  (require it in `.dark`), and fold the `contrast` check into `npm run check` over `app/globals.css`.

---

## 10. Done =

An LLM ships **both** sample features through the full loop (discover contract → build with tokens → hit a
genuine gap → run the extension procedure → recover from a red gate unaided → pass `check`+`test`+`lint`+
`build`) across the pre-registered runs **with zero hand-fixes to the contract**; all three §5 assertions
are witnessed; the brownfield experience is recorded; `docs/M6-DOGFOOD.md` captures it all; and the human
visual checkpoint has signed off on whatever product surface (if any) is kept — **OR** M6 is recorded as
**BLOCKED** with the findings ledger naming the contract holes to fix before v1.
