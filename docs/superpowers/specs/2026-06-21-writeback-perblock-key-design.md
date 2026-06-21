# Writeback per-block key (editor nit #2) — design

**Date:** 2026-06-21
**Status:** Design approved (brainstorm, 3-agent reviewed), pre-plan
**Milestone:** M4 editor fast-follow — review nit (b) from HANDOFF.md:49.
**Depends on:** M4 (`lib/editor/use-token-writeback.ts`, `components/editor/editor-provider.tsx`).

> **The bug:** the writeback queue keys its persist maps (`timers`/`pending`/`lastGood`) by token **name**.
> Editing the SAME token in the light block then the dark block within the 250ms debounce window
> **overwrites the pending light write** → the light POST never fires (dropped write). The same name-keying
> also makes `lastGood` cross-contaminate: a light-block rollback can revert the preview to the **dark**
> value (wrong-value rollback). Fix: key the persist maps by `${name}|${theme}`.

3-agent review reshaped this from the original "2 nits" brief: **nit #1 (in-flight status clobber on
block-switch) is CUT** — see §4. Only nit #2 (this doc) ships.

---

## 1. Keying model — three categories, one seam

The queue holds collections in three categories; only **persist** gains the theme dimension:

| Category | Members | Key | Why |
|---|---|---|---|
| **persist** | `timers`, `pending`, `lastGood` | **`${name}\|${theme}`** | a token has independent pending writes + last-good per block |
| **preview** | `applied` + `setVar`/`clearVar` | `name` (unchanged) | the inline preview var is a **single DOM property** on `documentElement` (`style.setProperty(name, …)`) — global, one live value at a time; a theme dimension is meaningless here |
| **status** | `onStatus` → provider `perToken` | `name` (unchanged) | status is single-view display ("the selected token in the active block"); per-(name,theme) status is the deferred rekey (§4) |

**Anti-foot-gun (required):** add one private helper `private key(name, theme) { return \`${name}|${theme}\`; }`
so the composite key has exactly one spelling, and annotate each map declaration inline (`// keyed by
name|theme` vs `// keyed by name — preview/DOM is global`). Mirror the wording of the provider's existing
`committedRef` (`Map<"name|theme", value>`, editor-provider.tsx) so the two composite keys read as one idiom.

---

## 2. `lib/editor/use-token-writeback.ts` changes

- **`edit(edit)`** — preview stays name-keyed (`setVar(edit.name, …)`, `applied.add(edit.name)`,
  `onStatus(edit.name, "dirty")`). Persist keys move to `key(edit.name, edit.theme)`: `pending.set(k, edit)`,
  clear/arm `timers` under `k`, `setTimeout(() => flush(k))`. → same-token **same-block** edits still coalesce
  (same `k`, last-write-wins); same-token **cross-block** edits get distinct timers/pending → both flush.
- **`flush(k)`** — `pending.get(k)` → `edit` (carries name+value+theme); `onStatus(edit.name, "saving")`; POST
  `{token: edit.name, value: edit.value, theme: edit.theme}`; ok → `lastGood.set(k, edit.value)` +
  `onStatus(edit.name, "saved")`; fail → `rollback(edit)`.
- **`rollback(edit)`** (signature: take the `edit`, not a bare name) — `good = lastGood.get(key(edit.name, edit.theme))`;
  if `good !== undefined`: `setVar(edit.name, good)` **and re-add `applied.add(edit.name)`** (see §3 leak fix);
  `onStatus(edit.name, "error", msg)`.
- **`seed(name, value)` → `seed(name, theme, value)`** — `lastGood.set(key(name, theme), value)`. Required: once
  `lastGood` is composite-keyed, seed can't form the key without the theme.
- **`clearPreviews()`** / `applied` — unchanged (name-keyed; DOM-global).

## 3. The late-rollback preview leak (MAJOR — fold in) [R]

Because the fix makes a cross-block pending write **survive** a block switch, this path is now normal-flow, not
ultra-narrow: edit `--primary` light → switch to dark (`setEditingBlock` calls `clearPreviews()`, emptying
`applied`) → the surviving `--primary|light` timer fires and the POST **fails** → `rollback` does
`setVar("--primary", lightGood)`, re-applying a light inline var **while dark is shown**, and because
`--primary` is no longer in `applied`, the next `clearPreviews()` won't remove it → **permanent leak**.

**Fix (minimal):** `rollback` re-adds the name to `applied` (above) so a later `clearPreviews()` reclaims it.
This bounds the leak to "until the next block switch / preview clear" instead of permanent. The remaining
transient (a failed background-block write briefly shows its value while another block is active) is genuinely
cosmetic + only on POST failure — acceptable; documented. (We deliberately do **not** teach the queue the active
block to suppress the setVar — that couples the queue to view state for a cosmetic edge.)

## 4. Nit #1 — CUT (documented, not fixed) [R]

Original brief included nit (a): block-switch resets a same-token in-flight save-state to idle. With status
**name-keyed** there is one status slot per token shared across blocks, so on switching to dark the panel shows
the dark value — *preserving* "saving" would paint a false "Saving…" on the dark value, while the current idle
reset is **truthful for the block now shown** (the light write still lands silently via the armed timer). So
#1 can't be made correct without the per-(name,theme) status rekey the user declined, and "preserve saving"
would be worse than today. **Decision: do not change the status reset.** Add a one-line comment at the
`setEditingBlock` idle-reset noting cross-block in-flight status is intentionally not surfaced (a known
limitation pending a per-block status model), and update the HANDOFF nit entry to reflect: #2 fixed, #1 =
documented limitation.

## 5. Provider call sites

`seed` is called from three places, each with the theme in hand — update all:
- `select` → `queue.seed(name, editingBlock, currentValue(name, editingBlock))`
- `setEditingBlock` → `queue.seed(selectedToken, block, currentValue(selectedToken, block))` (the NEW block —
  the crux: after a switch, seed the destination block's last-good)
- `applyHistory` → `queue.seed(entry.token, entry.theme, value)`

No other provider change (status reset stays as-is per §4, plus the §4 comment).

## 6. Testing

**`tests/editor/use-token-writeback.test.ts`** (uses fake timers + a `fetch` stub):
- **Body-capturing mock (required):** the existing mocks ignore args. Capture `JSON.parse(init.body)` so tests
  assert *what* was POSTed, not just the count.
- **Cross-block (the fix):** `edit(--primary, "L", light)` then `edit(--primary, "D", dark)` within one debounce
  window → advance 250ms → **two** POSTs whose bodies are `{token:--primary,value:L,theme:light}` **and**
  `{…value:D,theme:dark}` (`arrayContaining`, order-independent). Fails before (one POST, value D only).
- **Coalescing guard (upgrade):** same-token same-block twice → **one** POST carrying the **last** value+theme
  (not just count==1 — guards against over-granular keying).
- **Cross-block rollback (proves `lastGood` theme-keyed):** seed light good, edit light ok; edit dark → POST 400
  → dark rolls back to dark's last-good; the light value is untouched.
- **Leak guard (§3):** after a failed cross-block flush + a subsequent `clearPreviews()`, the re-applied var is
  cleared (name back in `applied`).
- **Migrate `seed()` calls** to 3-arg (the rollback test at the existing seed line must seed with `"light"`).
- Add `afterEach(() => vi.useRealTimers())` (the file currently lacks it).

**`tests/editor/editor-provider.test.tsx`:** the existing rollback/clearPreviews tests are the integration guard
on the provider-side `seed` theme — must stay green (a wrong seed theme makes them fail loudly). No new
provider behaviour to test (#1 cut).

**Gate:** `npm run verify` (check + test + lint + **build**) before merge.

## 7. Done =

The writeback queue keys `timers`/`pending`/`lastGood` by `${name}|${theme}` (one `key()` helper, field-level
comments); a same-token cross-block edit within the debounce no longer drops the earlier block's write, and
rollback reverts to the correct per-block last-good; a failed cross-block flush can't leak a permanent inline
preview var (`applied` re-add); `seed` takes the theme; preview + status stay name-keyed (documented seam);
nit #1 is documented-not-fixed; body-capturing tests prove both writes' values+themes; `npm run verify` green.
