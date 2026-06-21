# Writeback per-block key (editor nit #2) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Key the writeback queue's persist maps by `${name}|${theme}` so a same-token cross-block edit within the debounce no longer drops the earlier write (or rolls back to the wrong block's value), and a failed cross-block flush can't leak a permanent inline preview var.

**Architecture:** `lib/editor/use-token-writeback.ts` — `timers`/`pending`/`lastGood` keyed by a single `key(name,theme)` helper; `seed` gains `theme`; `flush(key)`/`rollback(edit)`; rollback re-adds the name to `applied`. Preview (`applied`/`setVar`) + status (`onStatus`) stay name-keyed (documented seam). Provider updates its 3 `seed()` call sites + a doc comment for the cut nit #1.

**Tech Stack:** TypeScript, Vitest (fake timers + fetch stub).

**Spec:** [docs/superpowers/specs/2026-06-21-writeback-perblock-key-design.md](../specs/2026-06-21-writeback-perblock-key-design.md)

**Branch:** `writeback-perblock-key` (already created).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/editor/use-token-writeback.ts` | persist maps keyed by name\|theme; seed(theme); rollback applied re-add | Modify |
| `components/editor/editor-provider.tsx` | 3 `seed()` call sites + nit-#1 doc comment | Modify |
| `tests/editor/use-token-writeback.test.ts` | body-capture mock + cross-block/rollback/coalescing/leak tests + seed migration + afterEach | Modify |
| `tests/editor/editor-provider.test.tsx` | integration guard (stays green) | Verify |

---

## Task 1: Rekey the queue + migrate provider seed calls

**Files:** Modify `lib/editor/use-token-writeback.ts`, `components/editor/editor-provider.tsx`; modify `tests/editor/use-token-writeback.test.ts`.

- [ ] **Step 1: Upgrade the test harness + add failing tests** — `tests/editor/use-token-writeback.test.ts`

(a) Make `makeQueue`'s fetch mock body-capturing — change the helper so callers can read POST bodies. Add a shared capture: replace each per-test `fetchMock` with one that records bodies. Minimal: add a `bodies` array to `makeQueue` by wrapping fetch:

```ts
function makeQueue(fetchImpl: typeof fetch) {
  vi.stubGlobal("fetch", fetchImpl);
  const applied: Array<[string, string]> = [];
  const cleared: string[] = [];
  const q = new WritebackQueue({
    debounceMs: 250,
    setVar: (name, value) => applied.push([name, value]),
    clearVar: (name) => cleared.push(name),
    onStatus: vi.fn(),
  });
  return { q, applied, cleared };
}

// helper: a fetch mock that records parsed POST bodies
function capturingFetch(ok = true, status = 200) {
  const bodies: any[] = [];
  const fn = vi.fn(async (_url: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify(ok ? { ok: true } : { error: "bad" }), { status });
  }) as unknown as typeof fetch;
  return { fn, bodies };
}
```

(b) Migrate the existing `seed` call (rollback test) to 3-arg + assert the rolled-back value:
```ts
    q.seed("--primary", "light", "oklch(0.2 0 0)");
```

(c) Add `afterEach(() => vi.useRealTimers());` after the `beforeEach`.

(d) New tests:
```ts
  it("cross-block: same token in light then dark within the debounce → BOTH writes POST", async () => {
    const { fn, bodies } = capturingFetch();
    const { q } = makeQueue(fn);
    q.edit({ name: "--primary", value: "L", theme: "light" });
    q.edit({ name: "--primary", value: "D", theme: "dark" }); // within debounce — must NOT overwrite light
    await vi.advanceTimersByTimeAsync(250);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(bodies).toEqual(
      expect.arrayContaining([
        { token: "--primary", value: "L", theme: "light" },
        { token: "--primary", value: "D", theme: "dark" },
      ]),
    );
  });

  it("same token + same block coalesces to ONE POST carrying the LAST value", async () => {
    const { fn, bodies } = capturingFetch();
    const { q } = makeQueue(fn);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--primary", value: "oklch(0.4 0 0)", theme: "light" });
    await vi.advanceTimersByTimeAsync(250);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(bodies[0]).toEqual({ token: "--primary", value: "oklch(0.4 0 0)", theme: "light" });
  });

  it("cross-block rollback reverts to THAT block's last-good (lastGood is per-block)", async () => {
    const { fn } = capturingFetch(false, 400);
    const { q, applied } = makeQueue(fn);
    q.seed("--primary", "dark", "oklch(0.8 0 0)"); // dark's last-good
    q.edit({ name: "--primary", value: "oklch(0.5 0 0)", theme: "dark" }); // will 400
    await vi.advanceTimersByTimeAsync(250);
    expect(applied.at(-1)).toEqual(["--primary", "oklch(0.8 0 0)"]); // reverted to dark good, not undefined
  });

  it("a failed cross-block flush's rollback re-adds to applied so clearPreviews reclaims it (no leak)", async () => {
    const { fn } = capturingFetch(false, 400);
    const { q, cleared } = makeQueue(fn);
    q.seed("--primary", "light", "oklch(0.2 0 0)");
    q.edit({ name: "--primary", value: "oklch(0.9 0 0)", theme: "light" });
    q.clearPreviews(); // simulate block switch BEFORE the flush — empties applied
    await vi.advanceTimersByTimeAsync(250); // flush fails → rollback setVar + re-add to applied
    q.clearPreviews();
    expect(cleared).toContain("--primary"); // the rolled-back var was reclaimable
  });
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run tests/editor/use-token-writeback.test.ts` (cross-block → 1 POST today; rollback test seed signature; leak test).

- [ ] **Step 3: Rekey the queue** — `lib/editor/use-token-writeback.ts`. Add a `key()` helper, rekey the three persist maps, change `seed`, thread the key through `flush`/`rollback`, re-add to `applied` on rollback:

```ts
export class WritebackQueue {
  private timers = new Map<string, ReturnType<typeof setTimeout>>(); // keyed by name|theme
  private pending = new Map<string, WritebackEdit>();                 // keyed by name|theme
  private lastGood = new Map<string, string>();                       // keyed by name|theme
  /** Names of inline preview vars (DOM is global per var → keyed by NAME, not theme). */
  private applied = new Set<string>();
  private readonly endpoint: string;

  constructor(private opts: WritebackOpts) {
    this.endpoint = opts.endpoint ?? "/api/ds/token";
  }

  /** Composite persist key — same idiom as the provider's committedRef. */
  private key(name: string, theme: Theme): string {
    return `${name}|${theme}`;
  }

  seed(name: string, theme: Theme, value: string): void {
    this.lastGood.set(this.key(name, theme), value);
  }

  clearPreviews(): void {
    for (const name of this.applied) this.opts.clearVar(name);
    this.applied.clear();
  }

  edit(edit: WritebackEdit): void {
    this.opts.setVar(edit.name, edit.value); // optimistic preview (name-keyed DOM var)
    this.applied.add(edit.name);
    this.opts.onStatus(edit.name, "dirty");
    const k = this.key(edit.name, edit.theme);
    this.pending.set(k, edit);
    const existing = this.timers.get(k);
    if (existing) clearTimeout(existing);
    this.timers.set(k, setTimeout(() => void this.flush(k), this.opts.debounceMs));
  }

  private async flush(k: string): Promise<void> {
    this.timers.delete(k);
    const edit = this.pending.get(k);
    if (!edit) return;
    this.pending.delete(k);
    this.opts.onStatus(edit.name, "saving");
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: edit.name, value: edit.value, theme: edit.theme }),
      });
      if (!res.ok) {
        let msg = `write failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        this.rollback(edit, msg);
        return;
      }
      this.lastGood.set(k, edit.value);
      this.opts.onStatus(edit.name, "saved");
    } catch (e) {
      this.rollback(edit, (e as Error).message);
    }
  }

  private rollback(edit: WritebackEdit, error: string): void {
    const good = this.lastGood.get(this.key(edit.name, edit.theme));
    if (good !== undefined) {
      this.opts.setVar(edit.name, good);
      this.applied.add(edit.name); // re-arm for clearPreviews — block-switch may have emptied applied
    }
    this.opts.onStatus(edit.name, "error", error);
  }
}
```

(`Theme` is already imported at the top of the file.)

- [ ] **Step 4: Migrate provider seed calls + nit-#1 comment** — `components/editor/editor-provider.tsx`:
  - `select` (~line 192): `queue.seed(name, editingBlock, value)` (value already = `currentValue(name, editingBlock)`).
  - `setEditingBlock` (~line 160): `queue.seed(selectedToken, block, value)` (value already bound at ~159).
  - `applyHistory` (~line 282): `queue.seed(entry.token, entry.theme, value)`.
  - At the `setEditingBlock` perToken idle-reset (~lines 161-173), add a comment:
    ```ts
    // NOTE: status is name-keyed (one slot per token, shared across blocks), so we reset to the new
    // block's truth (idle). A same-token write still in flight for the OLD block isn't surfaced after
    // the switch (it still lands via the armed timer) — a known limitation pending a per-(name,theme)
    // status model. See docs/superpowers/specs/2026-06-21-writeback-perblock-key-design.md §4.
    ```

- [ ] **Step 5: Run — expect PASS** — `npx vitest run tests/editor/use-token-writeback.test.ts tests/editor/editor-provider.test.tsx`
Expected: queue tests green (incl. the 4 new) + provider rollback/clearPreviews integration tests still green (they exercise the migrated seed). If a provider test goes red, the seed theme is wrong — fix.

- [ ] **Step 6: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/editor/use-token-writeback.ts components/editor/editor-provider.tsx tests/editor/use-token-writeback.test.ts
git commit -m "fix(editor): key writeback persist maps by name|theme (no dropped cross-block write / wrong rollback)"
```

---

## Task 2: Docs + full verify + merge

- [ ] **Step 1: HANDOFF.** Update the nit line (docs/HANDOFF.md:49): mark nit (b)/#2 fixed (persist keyed by name|theme); reframe nit (a)/#1 as a documented limitation of name-keyed status (not a bug fixable without a per-block status rekey). Commit.

```bash
git add docs/HANDOFF.md
git commit -m "docs(editor): HANDOFF — writeback per-block key done; status nit documented"
```

- [ ] **Step 2: Full verify (incl. build)** — `npm run verify`
Expected: check ✓ + all tests pass + lint 0 + `next build` compiles (route table). This is the canonical pre-merge gate.

- [ ] **Step 3: Verify before done** — @superpowers:verification-before-completion. `npm run verify` green + tree clean.

- [ ] **Step 4: Merge** — @superpowers:finishing-a-development-branch. `--no-ff`, verify green, delete branch.

```bash
git checkout main && git merge --no-ff writeback-perblock-key && git branch -d writeback-perblock-key
```

---

## Done =

The writeback queue keys `timers`/`pending`/`lastGood` by `${name}|${theme}` (one `key()` helper, field comments); a same-token cross-block edit within the debounce posts BOTH writes and rolls back to the correct per-block last-good; a failed cross-block flush re-adds to `applied` so no permanent preview leak; `seed` takes the theme (3 provider call sites migrated); preview + status stay name-keyed with the seam documented + nit #1 recorded as a known limitation; body-capturing tests prove both writes' value+theme; `npm run verify` (incl. build) green; merged to main.
