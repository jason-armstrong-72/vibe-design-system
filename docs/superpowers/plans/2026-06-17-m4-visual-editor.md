# M4 — Visual Token Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only, point-and-click editor docked over `/design-system`: click a `data-token` element → edit its value in a group-appropriate control → live preview instantly + persist (debounced) to `app/globals.css` via a dev-only write-only API route → the change ripples everywhere the token is used.

**Architecture:** A client island (`EditorProvider` + panel + hover overlay) mounted over the existing server-rendered page, gated by `NODE_ENV`. Edits call `setProperty` for instant preview and a per-token debounced `POST /api/ds/token` for persistence. The route is **write-only** (`validate → allowlist → writeToken`); manifest regeneration stays owned by the existing `scripts/watch-tokens.ts` (no double-regen). Editor chrome uses its own namespaced Part A token kit, separate from the design-system tokens it edits.

**Tech Stack:** Next 16 (App Router, Route Handlers) · React 19 · Tailwind v4 · TypeScript · Vitest (+ jsdom + Testing Library) · Playwright · `culori` (OKLCH math, already a dep). Reuses M1–M3a: `lib/tokens/{parse,write,validate,schema,regenerate,contrast}.ts`, `data-token` tags, `controlForGroup`/`foregroundFor`.

**Authoritative spec:** `docs/superpowers/specs/2026-06-17-m4-visual-editor-design.md` (read it; this plan implements it).

> **Next 16 caveat (project rule):** this is a modified Next.js. Before writing the Route Handler, read
> `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. Confirmed shape:
> `export async function POST(req: Request)` returning `Response.json(...)`; POST is not cached.

---

## Build order (slices — each leaves the suite green and adds usable value)

- **A. The seam** — prove edit→preview→write→ripple end-to-end on the *simplest* control (zIndex number field). De-risks the load-bearing mechanism before any fancy control.
- **B. Color** — the highest-value control (OKLCH), on the proven seam.
- **C. Remaining standard controls + editing-block (light/dark) toggle.**
- **D. Edit safety** — reset-to-original + save-state indicator + failed-write rollback.
- **E. Panel appearance toggle + polish** (empty state, sibling rows, overlay token name).
- **F. Close** — full suite, HANDOFF, merge.

## Branch

```bash
git switch -c m4-visual-editor   # from main, after M3a merged
```

## File map (responsibilities)

```
lib/editor/
  control-map.ts            # TokenGroup -> ControlKind (string union). Disjoint + exhaustive. Pure.
  apply-edit.ts             # validate + allowlist + writeToken for one edit. No regen. Pure-ish (fs). Testable.
  oklch.ts                  # culori wrapper: oklch() string <-> {l,c,h}; hex<->oklch with gamut clamp.
  use-token-writeback.ts    # per-token debounced POST + immediate setProperty preview + rollback on failure.
app/api/ds/token/route.ts   # dev-only POST; thin wrapper over apply-edit (NODE_ENV guard + JSON in/out).
components/editor/
  editor-chrome.css         # Part A token kit (light+dark), namespaced under [data-editor-root].
  editor-provider.tsx       # client context: enabled, selected, editingBlock, panelAppearance, per-token state.
  editor-mount.tsx          # dev-only: renders provider+toggle+panel+overlay only when NODE_ENV!=='production'.
  edit-toggle.tsx           # Edit on/off button (dock corner).
  highlight-overlay.tsx     # thin position:fixed hover/selection box; shows token name on hover.
  editor-panel.tsx          # docked-right shell: toolbar + context bar + body + empty state.
  panel-toolbar.tsx         # panel-appearance(☀/☾) · editing-block chip · state caption · close.
  save-state.tsx            # dirty/saving/saved/error indicator.
  controls/
    control-host.tsx        # picks the control component for the selected token's ControlKind.
    number-field.tsx · length-slider.tsx · opacity-slider.tsx · duration-slider.tsx
    select-field.tsx · easing-field.tsx · text-field.tsx · color-oklch.tsx
app/design-system/page.tsx  # MODIFY: wrap content in <EditorMount> (dev-only)
playwright.config.ts        # unchanged (bare `next dev`; editor e2e does NOT assert manifest regen — see §Testing notes)
```

**Testing notes (decided up front, from the 3-reviewer pass):**
- The editor route is **write-only**. Manifest regeneration is the **watcher's** existing M2 behavior (under `npm run dev`), NOT the editor's. So the editor e2e asserts **preview + `globals.css` rewritten + ripple** only — it does **not** assert manifest regeneration (that would couple the test to cross-process watcher timing). A comment in the e2e records this boundary.
- Client-component tests use `// @vitest-environment jsdom` + `@testing-library/react` (see `tests/design-system/token-item.test.tsx` for the established pattern).
- `controlForGroup` already exists in `lib/tokens/schema.ts`; `control-map.ts` is the **UI** layer that maps a group to a *component kind* (richer/looser than the bare `ControlType`).

---

# PHASE A — The seam

### Task 1: `control-map.ts` — group → ControlKind (disjoint + exhaustive)

**Files:**
- Create: `lib/editor/control-map.ts`
- Test: `tests/editor/control-map.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/editor/control-map.test.ts
import { describe, it, expect } from "vitest";
import { controlKindForGroup, CONTROL_KINDS } from "@/lib/editor/control-map";
import type { TokenGroup } from "@/lib/tokens/types";

const ALL_GROUPS: TokenGroup[] = [
  "color", "fontFamily", "fontSize", "lineHeight", "fontWeight", "radius",
  "borderWidth", "shadow", "duration", "easing", "spacing", "zIndex", "opacity", "container",
];

describe("control-map", () => {
  it("maps every TokenGroup to a known ControlKind (exhaustive + disjoint)", () => {
    for (const g of ALL_GROUPS) {
      const kind = controlKindForGroup(g);
      expect(CONTROL_KINDS).toContain(kind);
    }
  });
  it("uses v1 fallbacks for the deferred rich editors", () => {
    expect(controlKindForGroup("easing")).toBe("easing");   // preset+text field, not a curve editor
    expect(controlKindForGroup("shadow")).toBe("text");      // text field, not a layered builder
  });
  it("color/length/select/number/opacity/duration map as specified", () => {
    expect(controlKindForGroup("color")).toBe("color");
    expect(controlKindForGroup("radius")).toBe("length");
    expect(controlKindForGroup("spacing")).toBe("length");
    expect(controlKindForGroup("fontFamily")).toBe("select");
    expect(controlKindForGroup("fontWeight")).toBe("select");
    expect(controlKindForGroup("zIndex")).toBe("number");
    expect(controlKindForGroup("opacity")).toBe("opacity");
    expect(controlKindForGroup("duration")).toBe("duration");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/editor/control-map.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/editor/control-map.ts
import type { TokenGroup } from "@/lib/tokens/types";

export const CONTROL_KINDS = [
  "color", "length", "number", "opacity", "select", "duration", "easing", "text",
] as const;
export type ControlKind = (typeof CONTROL_KINDS)[number];

// UI control per group. Richer/looser than ControlType — easing/shadow use v1 fallbacks
// (rich curve editor + layered shadow builder are fast-follow, spec §7).
const MAP: Record<TokenGroup, ControlKind> = {
  color: "color",
  fontFamily: "select",
  fontWeight: "select",
  fontSize: "length",
  lineHeight: "length",
  radius: "length",
  borderWidth: "length",
  spacing: "length",
  container: "length",
  zIndex: "number",
  opacity: "opacity",
  duration: "duration",
  easing: "easing",
  shadow: "text",
};

export function controlKindForGroup(group: TokenGroup): ControlKind {
  return MAP[group];
}
```

- [ ] **Step 4: Run** the test → PASS. (TypeScript's `Record<TokenGroup, …>` makes the map exhaustive at compile time; the test guards the runtime contract.)

- [ ] **Step 5: Commit**

```bash
git add lib/editor/control-map.ts tests/editor/control-map.test.ts
git commit -m "feat(m4): control-map — TokenGroup -> ControlKind (disjoint + exhaustive)"
```

---

### Task 2: `apply-edit.ts` — validate + allowlist + write (no regen)

**Files:**
- Create: `lib/editor/apply-edit.ts`
- Test: `tests/editor/apply-edit.test.ts`

The route's core logic, extracted so it's testable without HTTP. Reuses `parseTokens` (allowlist),
`groupForName`/`validateValue` (via `writeToken`), and `writeToken` (atomic write). **Does NOT regenerate.**

- [ ] **Step 1: Write the failing test** (operates on a temp copy of globals.css)

```ts
// tests/editor/apply-edit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyEdit } from "@/lib/editor/apply-edit";

const GLOBALS = `:root {
  --primary: oklch(0.205 0 0);
  --z-modal: 1300;
}
.dark {
  --primary: oklch(0.922 0 0);
}
@theme inline { --color-primary: var(--primary); }
`;

let dir: string, file: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ds-")); file = join(dir, "globals.css"); writeFileSync(file, GLOBALS); });

describe("applyEdit", () => {
  it("writes a known token in the light block", async () => {
    await applyEdit(file, { name: "--primary", value: "oklch(0.5 0.2 250)", theme: "light" });
    expect(readFileSync(file, "utf8")).toContain("--primary: oklch(0.5 0.2 250)");
    rmSync(dir, { recursive: true });
  });
  it("writes to the dark block when theme=dark", async () => {
    await applyEdit(file, { name: "--primary", value: "oklch(0.8 0 0)", theme: "dark" });
    const css = readFileSync(file, "utf8");
    expect(css).toMatch(/\.dark \{[^}]*--primary: oklch\(0\.8 0 0\)/s);
    rmSync(dir, { recursive: true });
  });
  it("rejects an unknown token (allowlist) without writing", async () => {
    await expect(applyEdit(file, { name: "--made-up", value: "oklch(0.5 0 0)", theme: "light" }))
      .rejects.toThrow(/unknown token/i);
    expect(readFileSync(file, "utf8")).toBe(GLOBALS);
    rmSync(dir, { recursive: true });
  });
  it("rejects an injection value without writing", async () => {
    await expect(applyEdit(file, { name: "--primary", value: "red; } body{display:none", theme: "light" }))
      .rejects.toThrow();
    expect(readFileSync(file, "utf8")).toBe(GLOBALS);
    rmSync(dir, { recursive: true });
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/editor/apply-edit.ts
import { readFile } from "node:fs/promises";
import type { TokenEdit } from "@/lib/tokens/types";
import { parseTokens } from "@/lib/tokens/parse";
import { writeToken } from "@/lib/tokens/write";

export class UnknownTokenError extends Error {}

/**
 * Apply one token edit to a globals.css file: defensive allowlist check (token must already
 * exist in the target theme block) → writeToken (which re-validates value-shape/injection and
 * writes atomically). Does NOT regenerate the manifest — the watcher owns that (spec §3/§8).
 */
export async function applyEdit(filePath: string, edit: TokenEdit): Promise<void> {
  const css = await readFile(filePath, "utf8");
  const present = parseTokens(css).some((t) => t.name === edit.name && t.theme === edit.theme);
  if (!present) throw new UnknownTokenError(`unknown token: ${edit.name} (${edit.theme})`);
  await writeToken(filePath, edit); // re-reads, validates value, atomic temp+rename
}
```

- [ ] **Step 4: Run** → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/editor/apply-edit.ts tests/editor/apply-edit.test.ts
git commit -m "feat(m4): apply-edit — allowlist + writeToken (no manifest regen)"
```

---

### Task 3: `app/api/ds/token/route.ts` — dev-only POST

**Files:**
- Create: `app/api/ds/token/route.ts`
- Test: `tests/editor/route.test.ts`

- [ ] **Step 1: Read** `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (Next 16 conventions).

- [ ] **Step 2: Write the failing test** — import the `POST` handler and call it with a `Request`. Use a temp globals + dependency-inject the path via an env var the route reads (`DS_GLOBALS_PATH`, defaulting to `app/globals.css`) so the test never touches the real file.

```ts
// tests/editor/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GLOBALS = `:root { --z-modal: 1300; }\n.dark { }\n`;
let dir: string, file: string, prevEnv: string | undefined, prevNode: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ds-")); file = join(dir, "globals.css"); writeFileSync(file, GLOBALS);
  prevEnv = process.env.DS_GLOBALS_PATH; process.env.DS_GLOBALS_PATH = file;
  prevNode = process.env.NODE_ENV; (process.env as any).NODE_ENV = "development";
});
afterEach(() => {
  process.env.DS_GLOBALS_PATH = prevEnv; (process.env as any).NODE_ENV = prevNode; rmSync(dir, { recursive: true });
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/ds/token/route");
  return POST(new Request("http://x/api/ds/token", { method: "POST", body: JSON.stringify(body) }));
};

describe("POST /api/ds/token", () => {
  it("writes a valid edit and returns ok", async () => {
    const res = await post({ token: "--z-modal", value: "1500", theme: "light" });
    expect(res.status).toBe(200);
    expect(readFileSync(file, "utf8")).toContain("--z-modal: 1500");
  });
  it("rejects an unknown token with 400 and no write", async () => {
    const res = await post({ token: "--nope", value: "1", theme: "light" });
    expect(res.status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(GLOBALS);
  });
  it("rejects an injection value with 400", async () => {
    const res = await post({ token: "--z-modal", value: "1;}body{x:y", theme: "light" });
    expect(res.status).toBe(400);
  });
  it("is a no-op (404) in production", async () => {
    (process.env as any).NODE_ENV = "production";
    const res = await post({ token: "--z-modal", value: "1500", theme: "light" });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Implement**

```ts
// app/api/ds/token/route.ts
import { resolve } from "node:path";
import { applyEdit } from "@/lib/editor/apply-edit";
import type { Theme } from "@/lib/tokens/types";

const globalsPath = () => process.env.DS_GLOBALS_PATH ?? resolve("app/globals.css");

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  let body: { token?: string; value?: string; theme?: Theme };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { token, value, theme } = body;
  if (!token || value === undefined || (theme !== "light" && theme !== "dark")) {
    return Response.json({ error: "token, value, theme required" }, { status: 400 });
  }
  try {
    await applyEdit(globalsPath(), { name: token, value, theme });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 4: Run** `npx vitest run tests/editor/route.test.ts` → PASS (4). *(If `NODE_ENV` is read-only at runtime under your Node, set it via `vi.stubEnv("NODE_ENV", …)` instead.)*

- [ ] **Step 5: Commit**

```bash
git add app/api/ds/token/route.ts tests/editor/route.test.ts
git commit -m "feat(m4): dev-only POST /api/ds/token (write-only, validated, prod-guarded)"
```

---

### Task 4: `use-token-writeback.ts` — per-token debounce + preview + rollback

**Files:**
- Create: `lib/editor/use-token-writeback.ts`
- Test: `tests/editor/use-token-writeback.test.ts`

Split the testable logic into a plain class `WritebackQueue` (timers + fetch + rollback), and a thin React
hook around it. Test the class with fake timers + a mocked `fetch`.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WritebackQueue } from "@/lib/editor/use-token-writeback";

beforeEach(() => vi.useFakeTimers());

function makeQueue(fetchImpl: typeof fetch) {
  vi.stubGlobal("fetch", fetchImpl);
  const applied: Array<[string, string]> = [];
  const q = new WritebackQueue({
    debounceMs: 250,
    setVar: (name, value) => applied.push([name, value]),
    onStatus: vi.fn(),
  });
  return { q, applied };
}

describe("WritebackQueue", () => {
  it("previews immediately, persists once after debounce (same token coalesces)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }))) as any;
    const { q, applied } = makeQueue(fetchMock);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--primary", value: "oklch(0.4 0 0)", theme: "light" });
    expect(applied.at(-1)).toEqual(["--primary", "oklch(0.4 0 0)"]); // preview immediate
    expect(fetchMock).not.toHaveBeenCalled();                         // not yet persisted
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);                       // coalesced to one POST
  });

  it("debounces per token — two different tokens both persist", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }))) as any;
    const { q } = makeQueue(fetchMock);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--radius", value: "0.5rem", theme: "light" });
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rolls back the preview to last-known-good on a rejected write", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "bad" }), { status: 400 })) as any;
    const { q, applied } = makeQueue(fetchMock);
    q.seed("--primary", "oklch(0.2 0 0)");          // last persisted
    q.edit({ name: "--primary", value: "oklch(0.9 0 0)", theme: "light" });
    await vi.advanceTimersByTimeAsync(250);
    expect(applied.at(-1)).toEqual(["--primary", "oklch(0.2 0 0)"]); // reverted
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `WritebackQueue` (per-token timers, immediate preview via injected `setVar`, POST, rollback to seeded last-known-good, status callbacks) and a `useTokenWriteback` hook that wires `setVar` to `document.documentElement.style.setProperty` and reports status into the provider. (Full class: per-token `Map<string, timer>`; `seed(name,value)` records last-good; `edit()` applies preview + (re)arms that token's timer; on fire POST `/api/ds/token`; on !ok call `setVar(name, lastGood)` + `onStatus(name,'error',msg)`, on ok update lastGood + `onStatus(name,'saved')`.)

- [ ] **Step 4: Run** → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add lib/editor/use-token-writeback.ts tests/editor/use-token-writeback.test.ts
git commit -m "feat(m4): WritebackQueue — per-token debounce, optimistic preview, rollback"
```

---

### Task 5: Editor shell + number-field control, wired to the page

**Files:**
- Create: `components/editor/editor-chrome.css`, `editor-provider.tsx`, `editor-mount.tsx`, `edit-toggle.tsx`, `highlight-overlay.tsx`, `editor-panel.tsx`, `panel-toolbar.tsx`, `controls/control-host.tsx`, `controls/number-field.tsx`
- Modify: `app/design-system/page.tsx` (wrap children in `<EditorMount>`)
- Test: `tests/editor/editor-provider.test.tsx` (state), `tests/editor/number-field.test.tsx` (control)

This is the integration task. Keep behavior minimal: edit mode on/off, click a `data-token` el → select →
panel shows the control for its group (only `number` wired this task) → editing previews + queues writeback.

**Pin these so the implementer doesn't get stuck:**
- **Provider state shape** (spec §2): `{ enabled: boolean; selectedToken: string | null; editingBlock: "light"|"dark"; panelAppearance: "dark"|"light"; perToken: Record<string, { original: string; current: string; status: "idle"|"dirty"|"saving"|"saved"|"error"; error?: string }> }` + actions `enable/disable`, `select(name)`, `setEditingBlock`, `setPanelAppearance`, `reset(name)`. The provider owns a `WritebackQueue` (Task 4) whose `setVar` writes `document.documentElement.style.setProperty` and whose `onStatus` updates `perToken[*].status`.
- **`EditorMount` dev-gate mechanism:** it's a **client** component (`"use client"`); gate with `if (process.env.NODE_ENV === "production") return <>{children}</>;` (render children untouched, no editor) — do NOT use a server-only check inside a client component. `process.env.NODE_ENV` is statically replaced at build, so the editor code tree-shakes out of the prod bundle.
- **`ControlHost`:** `switch (controlKindForGroup(token.group))` → component; this task wires only `"number"` → `NumberField`, all other kinds render a small `<p>control coming…</p>` stub (replaced in Phases B/C). The token's `group` comes from the manifest (`design-system.json`) entry for `selectedToken`.
- **Selection wiring:** the overlay/page click reads `el.closest("[data-token]")?.getAttribute("data-token")` → `select(name)`. No selector derivation.
- **Mount point:** `page.tsx` stays a server component; it renders `<EditorMount>{…existing content…}</EditorMount>`. `EditorMount` (client) renders the provider + `{children}` + the dock toggle + panel + overlay.

- [ ] **Step 1 (TDD on the unit-testable pieces):** Write `tests/editor/number-field.test.tsx` — renders
  `<NumberField token="--z-modal" value="1300" onChange=… />`, asserts it shows 1300, typing 1500 calls
  `onChange("1500")`. And `editor-provider.test.tsx` — `enable()`, `select("--z-modal")`,
  `setEditingBlock("dark")` update context; default `enabled=false`. Run → FAIL.
- [ ] **Step 2:** Implement `editor-chrome.css` (Part A kit from the spec/figma §A7, scoped under
  `[data-editor-root]`, `[data-editor-theme="dark"|"light"]`), `EditorProvider` (state per spec §2 +
  `WritebackQueue`), `NumberField`, `ControlHost` (switch on `controlKindForGroup(token.group)` → component;
  only `number` this task, others render a "coming next" stub), the panel shell + toolbar (close + edit
  toggle only this task), the highlight overlay, and `EditorMount` (renders nothing in prod). Run unit tests → PASS.
- [ ] **Step 3:** Modify `app/design-system/page.tsx` to wrap its content children in `<EditorMount>`
  (a client component; the page stays a server component and just renders it). Verify `npm run build` still
  passes and the page renders unchanged with edit mode off.
- [ ] **Step 4: Commit**

```bash
git add components/editor app/design-system/page.tsx tests/editor/editor-provider.test.tsx tests/editor/number-field.test.tsx
git commit -m "feat(m4): editor shell (provider/mount/panel/overlay) + number-field, dev-gated"
```

---

### Task 6: e2e — the seam end-to-end (zIndex)

**Files:**
- Create: `e2e/editor.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// NOTE: editor route is WRITE-ONLY. Manifest regen is the watcher's job (M2), exercised under
// `npm run dev`, NOT asserted here — this proves the editor's write + live ripple only.
const GLOBALS = resolve("app/globals.css");

test.describe("editor seam", () => {
  test.afterEach(() => { /* restore globals.css from git in CI or snapshot before edit */ });

  test("edit a number token → live preview + globals.css rewritten + ripple", async ({ page }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click();          // enable edit mode
      await page.locator('[data-token="--z-modal"]').click();             // select
      const input = page.getByLabel(/z-modal|value/i);
      await input.fill("1500");
      await input.blur();
      // persisted (debounced) → poll the file
      await expect.poll(() => readFileSync(GLOBALS, "utf8")).toContain("--z-modal: 1500");
    } finally {
      writeFileSync(GLOBALS, before, "utf8"); // restore
    }
  });
});
```

- [ ] **Step 2: Run** `npx playwright test e2e/editor.spec.ts` → iterate selectors/labels until green. Use
  `expect.poll`/`toPass` for anything behind the debounce + hot-reload; never fixed waits.
- [ ] **Step 3:** Confirm the existing e2e (`design-system.spec.ts`, `themes.spec.ts`) still pass (editor is off by default; page unchanged).
- [ ] **Step 4: Commit**

```bash
git add e2e/editor.spec.ts
git commit -m "test(m4): e2e — seam (edit zIndex → preview + write + ripple)"
```

**Slice A done = the load-bearing mechanism is proven. Everything after adds controls/UX on this seam.**

---

# PHASE B — Color

### Task 7: `oklch.ts` — culori wrapper

**Files:**
- Create: `lib/editor/oklch.ts`
- Test: `tests/editor/oklch.test.ts`

- [ ] **Step 1: Write the failing test** — `parseOklch("oklch(0.205 0 0)") === {l:0.205,c:0,h:0}`;
  `formatOklch({l,c,h})` round-trips; `hexToOklch("#ffffff")` ≈ `{l:1,...}`; `oklchToHex` of an out-of-gamut
  value returns a valid 7-char hex (gamut-clamped, via culori `clampChroma`/`formatHex`); malformed input → null/throw.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** a thin wrapper over `culori` (`oklch`, `formatHex`, `clampChroma`, `parse`).
  Keep custom code to parsing/formatting the `oklch(L C H)` **string** the file stores; delegate color math to culori.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(m4): oklch.ts — culori wrapper (string<->LCH, hex<->oklch w/ gamut clamp)`

---

### Task 8: `color-oklch.tsx` core + wire via control-host

**Files:**
- Create: `components/editor/controls/color-oklch.tsx`
- Modify: `components/editor/controls/control-host.tsx` (add `color` → ColorOklch)
- Test: `tests/editor/color-oklch.test.tsx`; extend `e2e/editor.spec.ts`

- [ ] **Step 1:** Test (jsdom) — renders L/C/H sliders + hex field + swatch seeded from `oklch(0.205 0 0)`;
  moving the L slider calls `onChange` with a re-formatted `oklch(...)` string; typing a hex updates the
  oklch value. Run → FAIL.
- [ ] **Step 2:** Implement `ColorOklch` (3 range inputs bound through `oklch.ts`, an `oklch()`/hex text
  field, a live swatch). Wire into `control-host`. Run unit → PASS.
- [ ] **Step 3:** Add an e2e: edit `--primary` via the L slider → assert a second element bound to
  `--primary` repaints (computed color changes) + `globals.css` rewritten (poll). Run → green.
- [ ] **Step 4: Commit** `feat(m4): OKLCH color control (L/C/H + hex + swatch) wired to the panel`

---

### Task 9: Color enhancements — eyedropper · token swatches · contrast badge

**Files:**
- Modify: `components/editor/controls/color-oklch.tsx`
- Test: extend `tests/editor/color-oklch.test.tsx`

- [ ] **Step 1:** Tests — (a) existing-token swatches render from a passed token list and clicking one
  calls `onChange` with that token's value; (b) the contrast badge shows the WCAG ratio for the token's
  fg/bg pair (use `lib/tokens/contrast.ts` `wcagContrast` via a small helper; pair from `foregroundFor`);
  (c) eyedropper button is feature-detected (absent when `window.EyeDropper` is undefined). Run → FAIL.
- [ ] **Step 2:** Implement: token-swatch strip (values from the manifest/provider), eyedropper
  (`new window.EyeDropper().open()` → sRGB hex → `hexToOklch` → `onChange`), read-only contrast badge
  (ratio + pass/fail vs 4.5, reusing M3a thresholds). Run → PASS.
- [ ] **Step 3: Commit** `feat(m4): color control — eyedropper, reuse-a-token swatches, contrast badge`

---

# PHASE C — Remaining controls + editing-block toggle

### Task 10: length / opacity / duration / select / easing / text controls

**Files:**
- Create: `controls/{length-slider,opacity-slider,duration-slider,select-field,easing-field,text-field}.tsx`
- Modify: `controls/control-host.tsx` (wire all kinds)
- Test: `tests/editor/controls.test.tsx` + a registry-completeness test

- [ ] **Step 1:** Test — for each `ControlKind`, `control-host` resolves to a real component (no stubs left);
  a **registry-completeness** test asserts every `ControlKind` in `CONTROL_KINDS` has a component (mirrors
  the M3 page-completeness pattern). Per-control: seed value shown, edit → `onChange` with a value that
  passes `validateValue` for that group (e.g. `length-slider` emits `"0.5rem"`; `easing-field` preset →
  `"cubic-bezier(0.2,0,0,1)"`, and its text field accepts a custom `cubic-bezier(...)`). Run → FAIL.
- [ ] **Step 2:** Implement the six controls (compact; share a `field-row` layout per figma A3). `easing-field`
  = preset `<select>` of the named curves + a validated `cubic-bezier()` text input (NOT a curve editor).
  `text-field` = validated free text (shadow string / font stack). Run → PASS.
- [ ] **Step 3:** Add an e2e editing one length token (e.g. `--radius`) end-to-end. Run → green.
- [ ] **Step 4: Commit** `feat(m4): length/opacity/duration/select/easing/text controls + registry-complete`

---

### Task 11: Editing-block (light/dark) toggle + forced dark preview

**Files:**
- Modify: `editor-provider.tsx` (editingBlock drives preview scope + the POST `theme`), `panel-toolbar.tsx`
  (the chip + state caption), `use-token-writeback.ts` (target `.dark` scope)
- Test: extend provider test; `e2e/editor.spec.ts`

- [ ] **Step 1:** Tests — provider: setting `editingBlock="dark"` makes a writeback POST `theme:"dark"`;
  preview adds `.dark` to `document.documentElement` and sets the var on that element. e2e: toggle to Dark,
  edit a token whose dark value differs from light, assert the `.dark` block in `globals.css` changed (not
  `:root`) and the forced-dark preview shows the dark value. Run → FAIL.
- [ ] **Step 2:** Implement: the editing-block chip ("Editing: Light/Dark"), the live state caption
  ("toolbox <appearance> · editing your site's <block> theme"), and the dark preview scoping. Run → PASS.
- [ ] **Step 3: Commit** `feat(m4): editing-block toggle + truthful forced-dark preview + state caption`

---

# PHASE D — Edit safety

### Task 12: reset-to-original + save-state indicator + surfaced rollback

**Files:**
- Create: `components/editor/save-state.tsx`
- Modify: `editor-provider.tsx` (already holds `{original,status,error}`), `editor-panel.tsx` (context bar)
- Test: extend provider test; `e2e/editor.spec.ts`

- [ ] **Step 1:** Tests — provider `reset(token)` restores `original` (preview + queues a write of the
  original value); `save-state.tsx` renders the right glyph/color per status (idle/dirty/saving/saved/error)
  and shows the error message on error. e2e: enter an invalid value via the hex/text field → API 400 →
  panel shows `error` + reason → preview rolled back → `globals.css` unchanged; then `reset` returns a
  dirtied token to its original. Run → FAIL.
- [ ] **Step 2:** Implement `SaveState`, the reset affordance in the context bar, and ensure the
  `WritebackQueue` error path drives `status='error'` + rollback (Task 4 already rolls the preview; here we
  surface it). Run → PASS.
- [ ] **Step 3: Commit** `feat(m4): reset-to-original + save-state indicator + surfaced write-error rollback`

---

# PHASE E — Panel appearance + polish

### Task 13: Panel-appearance (chrome light/dark) toggle

**Files:**
- Modify: `editor-chrome.css` (already has both sets), `editor-provider.tsx` (panelAppearance + persist),
  `panel-toolbar.tsx` (☀/☾ button)
- Test: extend provider test; `e2e/editor.spec.ts`

- [ ] **Step 1:** Tests — toggling panel-appearance flips `data-editor-theme` on the editor root and
  persists to `localStorage` (survives remount). e2e: flip ☀/☾, reload, assert the chrome theme persisted;
  assert both chrome themes meet Part A contrast (muted text ≥ 4.5:1 on field — compute via the same
  contrast helper). Run → FAIL.
- [ ] **Step 2:** Implement the toggle + persistence + default dark (optionally seed from
  `prefers-color-scheme`). Run → PASS.
- [ ] **Step 3: Commit** `feat(m4): panel-appearance light/dark toggle (persisted) + chrome contrast e2e`

---

### Task 14: Polish — empty state · sibling rows · overlay token name · reflow width

**Files:**
- Modify: `editor-panel.tsx` (empty state + sibling rows), `highlight-overlay.tsx` (token-name label),
  `panel-toolbar.tsx` (effective preview-width readout)
- Test: jsdom tests for empty state + sibling rows; extend e2e

- [ ] **Step 1:** Tests — empty state shows the instructional copy when edit on + nothing selected; sibling
  rows render the other tokens of the selected token's group and clicking one promotes it to the focused
  control; overlay shows the token name on hover. Run → FAIL.
- [ ] **Step 2:** Implement. Sibling rows = compact inline rows (reuse the field-row layout); promotion sets
  `selectedToken`. Show the current effective preview width (px) in the toolbar with a tooltip noting
  breakpoints reflect the reduced width (spec §8). Run → PASS.
- [ ] **Step 3: Commit** `feat(m4): empty state, group sibling rows, overlay token name, preview-width note`

---

# PHASE F — Close

### Task 15: Full suite green + HANDOFF + merge

- [ ] **Step 1:** `npm test` (all vitest) green; `npx playwright test` green (editor + design-system + themes).
  Confirm `npm run build` passes and the page renders unchanged with editor off. Confirm `git status` clean
  (no stray globals.css edit left by an e2e — the editor spec restores it).
- [ ] **Step 2:** Update `docs/HANDOFF.md` (mark M4 done: what shipped, dev-only, the route/provider, the
  control set, fast-follows = bezier editor / shadow builder / pick-anywhere / gradient / panel-chrome was
  done / contrast-warning). Commit.
- [ ] **Step 3:** Merge:

```bash
git switch main
git merge --no-ff m4-visual-editor -m "Merge M4: dev-only visual token editor"
git branch -d m4-visual-editor
```
- [ ] **Step 4:** Verify suite green on `main`.

---

## Gates / definition of done

- Edit mode is **dev-only** (route 404s + mount renders nothing in prod build).
- Click a `data-token` → edit in a group-appropriate control → **instant preview** + **debounced persist**
  to `globals.css` → **ripple** on a second bound element. Proven by e2e.
- Every `TokenGroup` resolves to a real control (registry-complete, unit-tested).
- Bad/injection/unknown values are **rejected** (route 400) and the preview **rolls back** with a surfaced reason.
- Reset, save-state, both toolbar toggles (panel-appearance + editing-block), enhanced color (eyedropper +
  token swatches + contrast badge) all working.
- Full vitest + Playwright suites green; build passes; tree clean.

## Risks / notes

- **e2e + the real file.** The editor e2e edits `app/globals.css`; each test **snapshots and restores** it
  (try/finally). Never leave the tree dirty. Manifest regen is the watcher's (M2) job and is NOT asserted by
  the editor e2e (decoupled to avoid cross-process flakiness).
- **NODE_ENV in tests.** If your Node makes `process.env.NODE_ENV` read-only, use `vi.stubEnv`.
- **Riskiest task = Task 5** (the integration shell). It's deliberately gated behind Tasks 1–4 (all pure +
  unit-tested) so the seam's logic is proven before the React wiring.
- **Deferred (fast-follow, NOT this milestone):** draggable cubic-bezier curve editor, layered shadow
  builder, pick-anywhere, gradient builder, contrast-warning workflow beyond the read-only badge.
