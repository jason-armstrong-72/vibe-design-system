# F2 — One-step non-colour extension Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make adding a non-colour value (shadow level / text size / font weight) the **same one step as colour** — *add the value token to `:root`, run `npm run tokens`* — by generalising the sync pass to auto-wire scale `@theme` mappings; route the radius case to the `--radius` knob via the gate message + docs; report the true radius scale in the manifest.

**Architecture:** Generalise `syncThemeColorMappings` → `syncThemeMappings` (one pass, closed allowlist `{color, fontSize, fontWeight, shadow}`, exact-prop idempotency). Move `parseThemeSteps` to `lib/tokens/theme-steps.ts` (clean layering). Make `groupForName` not crash on a misplaced scale name. Thread live radius steps into the manifest. Make the F3 gate message + the generated docs route LLMs correctly ("easy-but-discouraged" for scales; radius is a knob).

**Tech Stack:** TypeScript, postcss (existing in sync.ts), Vitest. All changes in `lib/tokens/`, `lib/check/`, `docs/`. Reuses F3's `parseThemeSteps`.

**Spec:** [docs/superpowers/specs/2026-06-19-f2-noncolor-extension-design.md](../specs/2026-06-19-f2-noncolor-extension-design.md)

---

## Context for the implementer (read once)

- **The model:** a scale step = a **value token** in `:root` (`--fs-8xl`+`--lh-8xl`, `--elevation-xl`, `--fw-black`) + a **`@theme` mapping** that makes the utility compile (`--text-8xl`(+`--line-height`), `--shadow-xl`, `--font-weight-black`). Colour's mapping (`--color-x: var(--x)`) is auto-wired by sync; scales' weren't → the M6 wall. F2 auto-wires scales too.
- **Closed allowlist is load-bearing:** wire ONLY `{color, fontSize, fontWeight, shadow}`; silently ignore every other group. `--lh-*` is its own `lineHeight` group (consumed only as the fontSize line-height pair). **Never throw** for an unwired group — a throw crashes `npm run tokens` + `npm run check` on the unchanged repo.
- **No-op invariant:** every current scale token already has its mapping, so the generalised pass is a no-op on the unchanged repo (`changed===false`). Tests must assert this against the **real** `app/globals.css`.
- **Idempotency = exact-prop membership.** The `@theme` block has `--text-*: initial` (namespace clears, prop literally contains `*`) — an exact `existing.has("--text-8xl")` correctly ignores those; a `startsWith` would not.
- **Radius is special** — single `--radius` knob, no per-step value token, NOT auto-wired. Its only F2 changes: the manifest reads true `@theme` steps, and the gate message + docs route to the knob.
- `npm run tokens` = `lib/tokens/regenerate.ts` `syncAndGenerate`. The sync function has **4 callers**: `regenerate.ts`, `lib/check/manifest-fresh.ts` (gate enforcer), `scripts/watch-tokens.ts`, and the sync tests — all must use the renamed `syncThemeMappings`.

---

## Task 1: Move `parseThemeSteps` to `lib/tokens/theme-steps.ts` (clean layering)

`lib/tokens/generate.ts` will need the parsed radius steps; `lib/tokens` importing from `lib/check` is backwards. Move the pure parser (+ a canonical radius order) to `lib/tokens/`.

**Files:**
- Create: `lib/tokens/theme-steps.ts`
- Modify: `lib/check/off-token-scale.ts` (import from the new module; drop the local copy)
- Modify: `lib/check/run.ts` (**also imports `parseThemeSteps` from `./off-token-scale` — line 10; repoint to `@/lib/tokens/theme-steps`**)
- Test: `tests/check/off-token-scale.test.ts` (update import path), `tests/tokens/theme-steps.test.ts` (new)

- [ ] **Step 1: Create `lib/tokens/theme-steps.ts`** — move `ThemeSteps` + `parseThemeSteps` verbatim from `lib/check/off-token-scale.ts`, and add a canonical radius step order (the F3 vocab order):

```ts
export type ThemeSteps = { radius: Set<string>; shadow: Set<string>; text: Set<string>; fontWeight: Set<string> };

/** Canonical radius scale order (Tailwind v4 theme-var steps) — for stable manifest ordering. */
export const RADIUS_STEP_ORDER = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

/** Read steps defined in the `@theme inline` block. Anchors on `@theme inline` (a comment may
 *  mention "@theme" earlier). step is [a-z0-9]+ ended by `:` so `--text-xs--line-height:` is excluded. */
export function parseThemeSteps(globalsCss: string): ThemeSteps {
  const start = globalsCss.indexOf("@theme inline");
  const block = start === -1 ? "" : globalsCss.slice(start, globalsCss.indexOf("\n}", start));
  const out: ThemeSteps = { radius: new Set(), shadow: new Set(), text: new Set(), fontWeight: new Set() };
  const key = { radius: "radius", shadow: "shadow", "font-weight": "fontWeight", text: "text" } as const;
  for (const m of block.matchAll(/--(radius|shadow|font-weight|text)-([a-z0-9]+)\s*:/g)) {
    out[key[m[1] as keyof typeof key]].add(m[2]);
  }
  return out;
}
```

- [ ] **Step 2: Update the two importers** — in `lib/check/off-token-scale.ts` remove the local `ThemeSteps`/`parseThemeSteps` and `import { parseThemeSteps, type ThemeSteps } from "@/lib/tokens/theme-steps";` (the `VOCAB` const + `checkOffTokenScale` stay). In `lib/check/run.ts` (line 10) change the `parseThemeSteps` import from `./off-token-scale` to `@/lib/tokens/theme-steps`. (Grep to confirm no other importer: `grep -rn parseThemeSteps lib scripts app tests`.)

- [ ] **Step 3: Update test import** in `tests/check/off-token-scale.test.ts` — import `parseThemeSteps`/`ThemeSteps` from `@/lib/tokens/theme-steps` (was `@/lib/check/off-token-scale`). `checkOffTokenScale` still from off-token-scale.

- [ ] **Step 4: Add `tests/tokens/theme-steps.test.ts`** — move the 3 `parseThemeSteps` tests here (decoy-comment fixture); add: `RADIUS_STEP_ORDER` is the expected array.

- [ ] **Step 5: Run + commit**

Run: `npx vitest run tests/check/off-token-scale.test.ts tests/tokens/theme-steps.test.ts`
Expected: PASS.
```bash
git add lib/tokens/theme-steps.ts lib/check/off-token-scale.ts lib/check/run.ts tests/check/off-token-scale.test.ts tests/tokens/theme-steps.test.ts
git commit -m "refactor(f2): move parseThemeSteps to lib/tokens/theme-steps (clean layering for generate)"
```

---

## Task 2: Harden `groupForName` — don't crash on a misplaced scale name

The trap (spec §4): an LLM applies the scale procedure to radius and writes `--radius-2xl` in `:root`. Today `groupForName` throws on it → `npm run tokens` crashes. Classify the `@theme` utility-namespace prefixes into their family so a misplaced token degrades gracefully (the gate message + docs steer the real fix). A genuine typo (`--primaryy`) must STILL throw (real-drift detection).

**Files:**
- Modify: `lib/tokens/schema.ts` (`groupForName`)
- Test: `tests/tokens/schema.test.ts` (or wherever groupForName is tested)

- [ ] **Step 1: Write failing tests** — `groupForName("--radius-2xl")` returns `"radius"` (no throw); `--shadow-9xl`→`shadow`, `--text-8xl`→`fontSize`, `--font-weight-black`→`fontWeight`; **and** a genuine unknown `--primaryy` (non-color value) still throws. Also regression: every current `--elevation-*`/`--fs-*`/`--fw-*` classifies as shadow/fontSize/fontWeight.

```ts
expect(groupForName("--radius-2xl")).toBe("radius");
expect(groupForName("--shadow-9xl")).toBe("shadow");
expect(groupForName("--text-8xl")).toBe("fontSize");
expect(groupForName("--font-weight-black")).toBe("fontWeight");
expect(() => groupForName("--primaryy", "5")).toThrow();          // real drift still throws
expect(groupForName("--elevation-lg", "0 1px 2px oklch(0 0 0)")).toBe("shadow"); // not mis-inferred as color
```

- [ ] **Step 2: Run → fail** (`--radius-2xl` throws today).

- [ ] **Step 3: Implement** — in `groupForName`, add prefix rules for the `@theme` utility namespaces, placed AFTER the existing exact/specific rules (so `--radius` exact, `--font-(sans|mono|serif)` exact still win) and BEFORE the value-inference/throw:

```ts
  // misplaced @theme-namespace names → classify by family (graceful; the gate/docs steer the real fix)
  if (/^radius-/.test(bare)) return "radius";
  if (/^shadow-/.test(bare)) return "shadow";
  if (/^text-/.test(bare)) return "fontSize";
  if (/^font-weight-/.test(bare)) return "fontWeight";
```

(Note: these never match real `:root` tokens — `:root` uses `--fs-`/`--elevation-`/`--fw-`/`--radius`. They only catch misplaced ones. `groupForName` is called only on parsed `:root`/`.dark` tokens, never on `@theme`.)

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/schema.ts tests/tokens/schema.test.ts
git commit -m "fix(f2): groupForName classifies misplaced scale names by family (no toolchain crash)"
```

---

## Task 3: Generalise sync → `syncThemeMappings` (the core)

**Files:**
- Modify: `lib/tokens/sync.ts` (generalise + rename, add `warnings`)
- Modify callers: `lib/tokens/regenerate.ts`, `lib/check/manifest-fresh.ts`, `scripts/watch-tokens.ts`
- Test: `tests/tokens/sync.test.ts`

- [ ] **Step 1: Write failing tests** in `tests/tokens/sync.test.ts` (keep existing colour tests; import `syncThemeMappings`):

```ts
import { syncThemeMappings } from "@/lib/tokens/sync";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const THEME_OPEN = `@theme inline {\n  --color-foo: var(--foo);\n`; // minimal block helper in tests
// Use a small fixture with :root value tokens + an @theme block; assert mappings appended.

it("wires a new shadow level", () => {
  const css = `:root{--elevation-xl: 0 20px 25px oklch(0 0 0 / .1);}\n@theme inline{\n--shadow-*: initial;\n}`;
  const r = syncThemeMappings(css);
  expect(r.css).toContain("--shadow-xl: var(--elevation-xl)");
  expect(r.changed).toBe(true);
});
it("wires a new font size WITH its line-height pair", () => {
  const css = `:root{--fs-8xl: 6rem; --lh-8xl: 6.25rem;}\n@theme inline{\n--text-*: initial;\n}`;
  const r = syncThemeMappings(css);
  expect(r.css).toContain("--text-8xl: var(--fs-8xl)");
  expect(r.css).toContain("--text-8xl--line-height: var(--lh-8xl)");
});
it("wires a font size WITHOUT line-height (lenient) and warns", () => {
  const css = `:root{--fs-8xl: 6rem;}\n@theme inline{\n--text-*: initial;\n}`;
  const r = syncThemeMappings(css);
  expect(r.css).toContain("--text-8xl: var(--fs-8xl)");
  expect(r.css).not.toContain("--text-8xl--line-height");
  expect(r.warnings.some((w) => w.includes("lh-8xl"))).toBe(true);
});
it("wires a new font weight", () => {
  const css = `:root{--fw-black: 900;}\n@theme inline{\n--font-weight-*: initial;\n}`;
  expect(syncThemeMappings(css).css).toContain("--font-weight-black: var(--fw-black)");
});
it("ignores non-wired groups (lineHeight etc.) without throwing", () => {
  const css = `:root{--lh-9xl: 8rem; --duration-xl: 1s;}\n@theme inline{\n}`;
  const r = syncThemeMappings(css);
  expect(r.changed).toBe(false);          // nothing wired
  expect(r.css).not.toContain("--lineHeight");
});
it("is idempotent (incl. line-height) — second run adds nothing", () => {
  const css = `:root{--fs-8xl: 6rem; --lh-8xl: 6.25rem;}\n@theme inline{\n--text-*: initial;\n}`;
  const once = syncThemeMappings(css).css;
  const twice = syncThemeMappings(once);
  expect(twice.changed).toBe(false);
  expect(twice.added).toEqual([]);
});
it("is a no-op on the real app/globals.css", () => {
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  const r = syncThemeMappings(css);
  expect(r.changed).toBe(false);
  expect(r.added).toEqual([]);
});
```
(Keep the existing colour tests — rename their import to `syncThemeMappings`.)

- [ ] **Step 2: Run → fail** (`syncThemeMappings` not defined).

- [ ] **Step 3: Implement** — replace `syncThemeColorMappings` in `lib/tokens/sync.ts`:

```ts
export interface SyncResult { css: string; changed: boolean; added: string[]; warnings: string[]; }

/**
 * Ensure every value token in :root has its `@theme inline` mapping, so its Tailwind utility compiles.
 * Wires colour AND the scale families {fontSize, fontWeight, shadow} — additive, idempotent. This is what
 * makes the extension procedure one step for colour and scales alike. Other groups (lineHeight, radius,
 * spacing, …) are intentionally ignored (radius is a knob; lineHeight is consumed as the text pair).
 */
export function syncThemeMappings(css: string): SyncResult {
  const root = postcss.parse(css);
  const tokens = parseTokens(css).filter((t) => t.theme === "light");
  const names = new Set(tokens.map((t) => t.name));

  let themeRule: postcss.AtRule | undefined;
  root.walkAtRules("theme", (at) => { if (/(^|\s)inline(\s|$)/.test(at.params)) themeRule = at; });
  if (!themeRule) throw new Error("syncThemeMappings: no `@theme inline` block found");

  const existing = new Set<string>();
  themeRule.walkDecls((d) => existing.add(d.prop)); // ALL props, exact membership

  const added: string[] = [];
  const warnings: string[] = [];
  const ensure = (prop: string, value: string) => {
    if (!existing.has(prop)) { themeRule!.append({ prop, value }); existing.add(prop); added.push(prop); }
  };

  for (const t of tokens) {
    const bare = t.name.slice(2);
    switch (t.group) {
      case "color":      ensure(`--color-${bare}`, `var(${t.name})`); break;
      case "fontWeight": ensure(`--font-weight-${bare.replace(/^fw-/, "")}`, `var(${t.name})`); break;
      case "shadow":     ensure(`--shadow-${bare.replace(/^elevation-/, "")}`, `var(${t.name})`); break;
      case "fontSize": {
        const step = bare.replace(/^fs-/, "");
        ensure(`--text-${step}`, `var(${t.name})`);
        if (names.has(`--lh-${step}`)) ensure(`--text-${step}--line-height`, `var(--lh-${step})`);
        else warnings.push(`text-${step} wired with default line-height; add --lh-${step} for a proper pair`);
        break;
      }
      // all other groups intentionally ignored — DO NOT throw
    }
  }
  return { css: root.toString(), changed: added.length > 0, added, warnings };
}
```

- [ ] **Step 4: Update the 4 callers** (rename + warnings):
  - `lib/tokens/regenerate.ts`: import `syncThemeMappings`; after sync, if `sync.warnings.length` print them (`console.warn`). (See Task 5 for the radius-steps thread.)
  - `lib/check/manifest-fresh.ts`: import `syncThemeMappings` (used in Task 4 for the message too).
  - `scripts/watch-tokens.ts`: import `syncThemeMappings`.
  - `tests/tokens/sync.test.ts`: already updated.

- [ ] **Step 5: Run the sync tests → pass.** Run: `npx vitest run tests/tokens/sync.test.ts`. Expected: PASS (incl. the real-globals no-op).

- [ ] **Step 6: Commit**

```bash
git add lib/tokens/sync.ts lib/tokens/regenerate.ts lib/check/manifest-fresh.ts scripts/watch-tokens.ts tests/tokens/sync.test.ts
git commit -m "feat(f2): syncThemeMappings auto-wires scale @theme mappings (closed allowlist, line-height pair + warn)"
```

---

## Task 4: Family-aware manifest-fresh message

**Files:**
- Modify: `lib/check/manifest-fresh.ts`

- [ ] **Step 1: Update the stale-mapping message** — it currently says "missing @theme **color** mapping". Make it family-neutral and name the token(s) sync would add:

```ts
  if (sync.changed)
    out.push({ file: "app/globals.css", line: 0, rule: "manifest-fresh",
      message: `missing @theme mapping(s): ${sync.added.join(", ")} — run npm run tokens and commit` });
```

- [ ] **Step 2: Run** `npx vitest run tests/check/` → PASS (update any test asserting the old "color mapping" text). Commit:
```bash
git add lib/check/manifest-fresh.ts tests/check/manifest-fresh.test.ts
git commit -m "fix(f2): family-aware manifest-fresh message (names the missing mapping, not just 'color')"
```

---

## Task 5: Manifest reports the true radius scale (F4 for radius)

**Files:**
- Modify: `lib/tokens/utilities.ts` (`utilitiesForToken` optional radius arg)
- Modify: `lib/tokens/generate.ts` (`buildManifest`/`mergeByName` thread radius steps)
- Modify: `lib/tokens/regenerate.ts` + `lib/check/manifest-fresh.ts` (pass post-sync radius steps)
- Test: `tests/tokens/utilities.test.ts`, `tests/tokens/generate.test.ts`

- [ ] **Step 1: Write failing tests** — `utilitiesForToken(tok("--radius","radius"), ["sm","md","lg","xl","2xl"])` lists `rounded-2xl`; with no arg, defaults to `rounded-sm…xl` (existing assertion stays green). `buildManifest(tokens, "app/globals.css", ["sm","md","lg","xl","2xl"])` (note the 3-arg signature — `source` is 2nd) → radius token utilities include `rounded-2xl` in order.

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement**
  - `utilities.ts`: `export function utilitiesForToken(t: Token, radiusSteps?: string[]): UtilityHint` — radius case:
    ```ts
    case "radius":
      return { utilities: (radiusSteps ?? ["sm","md","lg","xl"]).map((s) => `rounded-${s}`), usage: "--radius is the knob; sm/md/lg/xl derived" };
    ```
  - `generate.ts`: **`buildManifest` ALREADY has a 2nd param `source = "app/globals.css"` (→ `generatedFrom`) — do NOT collide with it (review B1).** Add `radiusSteps` as the **3rd** param: `buildManifest(tokens: Token[], source = "app/globals.css", radiusSteps?: string[])`. `mergeByName(tokens, radiusSteps?)` passes it only for the radius token: `utilitiesForToken(t, t.group === "radius" ? radiusSteps : undefined)`. All callers that omit the 3rd arg keep the hardcoded default — no break.
  - `regenerate.ts`:
    ```ts
    import { parseThemeSteps, RADIUS_STEP_ORDER } from "./theme-steps";
    const radius = [...parseThemeSteps(sync.css).radius].sort((a,b) => RADIUS_STEP_ORDER.indexOf(a) - RADIUS_STEP_ORDER.indexOf(b));
    const { json, markdown } = buildManifest(parseTokens(sync.css), "app/globals.css", radius);
    ```
    (Pass `source` explicitly so `radius` lands in the 3rd slot, and use `sync.css` — the POST-sync string.)
  - `manifest-fresh.ts`: same — derive `radius` from `parseThemeSteps(sync.css).radius` (the **post-sync** string `sync.css`, NOT the `globalsCss` param), sort, and pass as the 3rd arg to `buildManifest`, so the gate's expected manifest matches `npm run tokens` byte-for-byte.

- [ ] **Step 4: Run tests → pass.** Then `npm run tokens` (regenerates with live radius steps = current sm/md/lg/xl → **no manifest diff**). Confirm: `git status` shows no change to `design-system.*` (no-op on current scale). `npm run check` ✓.

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/utilities.ts lib/tokens/generate.ts lib/tokens/regenerate.ts lib/check/manifest-fresh.ts tests/tokens/utilities.test.ts tests/tokens/generate.test.ts
git commit -m "feat(f2): manifest reports true @theme radius scale (fixes F4); utilitiesForToken optional steps"
```

---

## Task 6: Radius knob nudge in the gate message (F3's check) — the load-bearing ergonomic fix

**Files:**
- Modify: `lib/check/messages.ts` (`offTokenScale` family-aware)
- Test: `tests/check/off-token-scale.test.ts`

- [ ] **Step 1: Write/Update failing tests** — a `rounded-3xl` finding's message contains `--radius`; a `shadow-2xl` finding's message contains `:root` (routes to the one-step procedure). (Update any existing message-text assertions.)

- [ ] **Step 2: Implement** — in `lib/check/messages.ts`, make `offTokenScale` branch on family:

```ts
  offTokenScale: (cls: string, family: string, defined: string[]) =>
    family === "radius"
      ? `off-token scale step "${cls}" produces no styles — the radius scale is ${defined.join("/")}. To make corners rounder/softer overall, increase --radius in app/globals.css then npm run tokens (it shifts every step); for a one-off, add --radius-<step> to @theme. (see design-system.md)`
      : `off-token scale step "${cls}" produces no styles — the ${family} scale is ${defined.join("/")}. Add the value token to :root then npm run tokens, or use a defined step (see design-system.md)`,
```
(`checkOffTokenScale` already passes `FAMILY_LABEL[family]` — `"radius"` for radius. No check-logic change.)

- [ ] **Step 3: Run → pass.** `npx vitest run tests/check/off-token-scale.test.ts`. Commit:
```bash
git add lib/check/messages.ts tests/check/off-token-scale.test.ts
git commit -m "feat(f2): radius gate message nudges the --radius knob (the channel that redirects LLMs)"
```

---

## Task 7: Docs — unified, easy-but-discouraged extension procedure

**Files:**
- Modify: `lib/tokens/generate.ts` (`PREAMBLE`) → regenerates `design-system.md`
- Modify: `AGENTS.md`, `docs/NAMING-CONVENTION.md`

- [ ] **Step 1: Rewrite the `PREAMBLE` "Extension procedure" section** (spec §6) — replace the current "colour = easy / non-colour = fixed/rare" text with the unified, easy-but-discouraged version: colour (extend freely); scales (ramp is deliberately small — existing step first; value-token name differs from utility name: `--elevation-`/`--fs-`+`--lh-`/`--fw-`); radius/spacing are KNOBS ("radius is NOT like the other scales", "do NOT use rounded-2xl"); never hardcode/off-scale; keep the colour example + add a shadow-level example.

- [ ] **Step 2: Regenerate + verify** — `npm run tokens`; `git status` shows `design-system.{md,json}` changed (the preamble text). `npm run check` ✓ (manifest fresh).

- [ ] **Step 3: Update `AGENTS.md`** — the design-system contract block: the extension procedure pointer now covers scales (point at the unified `design-system.md` section). The off-token-scale failure row (from F3) already points here; ensure its fix text mentions the knob for radius.

- [ ] **Step 4: Update `docs/NAMING-CONVENTION.md`** — replace the "non-colour scales are fixed/rare" guidance with the value-token naming for a scale step (`--fs-<x>`+`--lh-<x>`, `--elevation-<x>`, `--fw-<x>`) and the radius knob rule (radius steps live in `@theme`, the knob is `--radius`).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/generate.ts design-system.md design-system.json AGENTS.md docs/NAMING-CONVENTION.md
git commit -m "docs(f2): unified easy-but-discouraged extension procedure (preamble + AGENTS + naming)"
```

---

## Task 8: End-to-end verification + ledgers + merge

- [ ] **Step 1: The headline end-to-end check (manual, scripted in this task).** On a clean tree:
  - Add `--elevation-xl: 0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1);` to `:root` in `app/globals.css`.
  - Run `npm run tokens`.
  - Assert: `@theme` now contains `--shadow-xl: var(--elevation-xl)` (`grep -n 'shadow-xl' app/globals.css`); `design-system.md`/`.json` list `shadow-xl` (`grep -c 'shadow-xl' design-system.json`); `npm run check` ✓ (off-token-scale sees `shadow-xl` defined; manifest fresh).
  - Optionally use `shadow-xl` in a scratch component → `npm run check` passes (was a no-op before, now compiles).
  - **Revert** all of it (`git checkout -- app/globals.css design-system.*`). Confirm `npm run check` ✓ and clean tree.

- [ ] **Step 2: Full green gate**

Run: `npm run check && npm test && npm run lint && npm run build`
Expected: check ✓, vitest all passing (new sync/theme-steps/schema/message tests), lint 0, build ok.

- [ ] **Step 3: Mark F2 done in the ledgers**
  - `docs/M6-DOGFOOD.md` findings ledger: F2 → **DONE 2026-06-19** (sync auto-wires scale mappings; radius knob in gate message; manifest reports true radius scale).
  - `docs/HANDOFF.md` M6 fast-follows: strike F2 (done); update the M5 check-list line if needed; note F4 (radius manifest) also addressed.

- [ ] **Step 4: Commit docs + final check**

```bash
git add docs/M6-DOGFOOD.md docs/HANDOFF.md
git commit -m "docs(f2): mark F2 done in ledgers (non-colour extension now one-step)"
```
Run `npm run check` ✓.

- [ ] **Step 5: Merge** — use **superpowers:finishing-a-development-branch**: `git checkout main && git merge --no-ff f2-noncolor-extension` (descriptive message) `&& git branch -d f2-noncolor-extension`. Confirm `npm run check` ✓ on main. (Push only if the user asks.)
