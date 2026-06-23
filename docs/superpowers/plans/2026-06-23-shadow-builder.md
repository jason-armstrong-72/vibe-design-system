# Layered Shadow Builder Implementation Plan

> **For agentic workers:** This plan is executed **IN-SESSION** (TDD, commit per task) — NOT via subagents.
> The repo is a shared working tree; a subagent's `git checkout` has orphaned commits before (see project
> memory `subagent-shared-tree-checkout-hazard`). Steps use checkbox (`- [ ]`) syntax for tracking. Use
> superpowers:executing-plans.

**Goal:** Replace the editor's plain-text shadow control with a layered `box-shadow` builder (add/remove
layers; per-layer x/y/blur/spread + color(black-or-token)+alpha + inset; 2D offset pad + numeric inputs;
accordion; live preview; raw escape-hatch), editing the existing `--elevation-*` tokens.

**Architecture:** House pure-lib + thin-view pattern, mirroring the shipped gradient builder. A pure
`lib/editor/shadow.ts` (model + parse/format/clamp, no React/DOM/culori) feeds a thin
`components/editor/controls/shadow-builder.tsx` (with in-file `LayerCard`/`LayerSummaryRow` subcomponents) +
a purpose-built `shadow-color-picker.tsx`. The paren-aware comma splitter is extracted to a shared
`lib/editor/css-list.ts` (3rd consumer: gradient, resolve-token, shadow). Wiring is two edits:
`control-map.ts` (`shadow:"text"→"shadow"`) + `control-host.tsx` (new `case`). No new TokenGroup / token /
gate work — the `shadow` group plumbing is already complete.

**Tech Stack:** Next 16 / React 19 / TypeScript / Tailwind v4 (CSS-first), Vitest (+ jsdom for `.test.tsx`),
Playwright (e2e). Spec: `docs/superpowers/specs/2026-06-23-shadow-builder-design.md`.

**Branch:** `m4-shadow-builder` (already created). Commit per task.

**Pre-merge gate (NON-NEGOTIABLE):** `npm run verify` (= check && test && lint && build — `next build` is the
only thing that type-checks the app graph + compiles Tailwind) **and** `npx playwright test`. The atomicity
of Task 6 (CONTROL_KINDS + never-guard) is caught ONLY by `next build`, not `npm run check`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `lib/editor/css-list.ts` | **Create.** Pure `splitTopLevel(s)` — paren-aware depth-0 comma split (filter-empties). | 1 |
| `lib/editor/gradient.ts` | **Modify.** Delete private `splitTopLevel`, import from `css-list`. | 1 |
| `lib/editor/resolve-token.ts` | **Modify.** Refactor `splitLayers` to delegate to `splitTopLevel`. | 1 |
| `lib/editor/shadow.ts` | **Create.** Model + `parseShadow`/`formatShadow`/clamps + `offsetFromPointer`/`dotPercent`. | 2 |
| `components/editor/controls/shadow-color-picker.tsx` | **Create.** Black-sentinel + token-grid + alpha popover (sibling of `GradientStopPicker`). | 4 |
| `components/editor/controls/shadow-builder.tsx` | **Create.** The view: preview + accordion of `LayerCard`/`LayerSummaryRow` + add + raw + disabled. | 5 |
| `lib/editor/control-map.ts` | **Modify.** Add `"shadow"` to `CONTROL_KINDS`; `MAP.shadow:"text"→"shadow"`. | 6 |
| `components/editor/controls/control-host.tsx` | **Modify.** Add `case "shadow"`. | 6 |
| `components/editor/editor-chrome.css` | **Modify.** `.ed-shadow-*` chrome (incl. `:focus-visible`, sticky, `data-on`). | 7 |
| `tests/editor/css-list.test.ts` | **Create.** | 1 |
| `tests/editor/shadow.test.ts` | **Create.** | 2,3 |
| `tests/editor/shadow-builder.test.tsx` | **Create.** | 5 |
| `tests/editor/control-host.test.tsx` | **Modify** (or create) — assert `shadow→ShadowBuilder`. | 6 |
| `e2e/shadow-builder.spec.ts` | **Create.** Real computed `box-shadow` on `/design-system`. | 8 |

---

## Task 1: Extract shared `splitTopLevel` to `css-list.ts`

**Why first:** `shadow.ts` (Task 2) needs the paren-aware splitter; it's currently private in `gradient.ts`
and re-implemented in `resolve-token.ts`. Extract once (rule-of-three). The shared impl uses gradient's
**filter-empties** behaviour (safe superset — `resolve-token`'s only caller never has empty segments).

**Files:**
- Create: `lib/editor/css-list.ts`, `tests/editor/css-list.test.ts`
- Modify: `lib/editor/gradient.ts:51-62` (delete private fn, import), `lib/editor/resolve-token.ts:44-55`

- [ ] **Step 1: Write the failing test** — `tests/editor/css-list.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { splitTopLevel } from "@/lib/editor/css-list";

describe("splitTopLevel", () => {
  it("splits at depth-0 commas only", () => {
    expect(splitTopLevel("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("keeps inner commas inside parens (color-mix / rgb)", () => {
    expect(splitTopLevel("0 1px 2px rgb(0, 0, 0), 0 2px var(--x)")).toEqual([
      "0 1px 2px rgb(0, 0, 0)",
      "0 2px var(--x)",
    ]);
  });
  it("survives nested parens and slashes", () => {
    expect(splitTopLevel("color-mix(in oklch, var(--x) 40%, transparent), oklch(0 0 0 / 0.1)")).toEqual([
      "color-mix(in oklch, var(--x) 40%, transparent)",
      "oklch(0 0 0 / 0.1)",
    ]);
  });
  it("trims and drops empty segments", () => {
    expect(splitTopLevel(" a , , b ")).toEqual(["a", "b"]);
    expect(splitTopLevel("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/editor/css-list.test.ts`
Expected: FAIL (Cannot find module `@/lib/editor/css-list`).

- [ ] **Step 3: Create `lib/editor/css-list.ts`**

```ts
// Pure CSS value-list helpers. No React, no DOM. Shared by gradient.ts, shadow.ts, resolve-token.ts.

/** Split a CSS list on commas at paren-depth 0 (so color-mix(...) / rgb(...) inner commas survive).
 *  Trims each segment and drops empties. */
export function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run tests/editor/css-list.test.ts`
Expected: PASS.

- [ ] **Step 5: Reroute `gradient.ts`** — delete the private `splitTopLevel` (lines ~50-62) and add the import
at the top of the file:

```ts
import { splitTopLevel } from "@/lib/editor/css-list";
```

(Leave the `// ---- parse ----` comment; remove only the `function splitTopLevel(...) {...}` block.)

- [ ] **Step 6: Reroute `resolve-token.ts`** — replace the `splitLayers` function body (lines ~44-55) so it
delegates (keep the name + export-internal usage unchanged):

```ts
import { splitTopLevel } from "@/lib/editor/css-list";
// ...
/** Paren-aware comma split (box-shadow layers may contain `rgb(0, 0, 0)`). */
const splitLayers = splitTopLevel;
```

(If `splitLayers` is referenced only locally, this alias is enough. Verify no `export` on it changes.)

- [ ] **Step 7: Run the affected suites — verify still green**

Run: `npx vitest run tests/editor/gradient.test.ts tests/editor/resolve-token.test.ts tests/editor/css-list.test.ts`
Expected: PASS (gradient + resolve-token unchanged in behaviour; the filter-empties superset is unreachable
in their inputs).

- [ ] **Step 8: Commit**

```bash
git add lib/editor/css-list.ts tests/editor/css-list.test.ts lib/editor/gradient.ts lib/editor/resolve-token.ts
git commit -m "refactor(editor): extract shared splitTopLevel to css-list.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure core `lib/editor/shadow.ts` — model + parse + format

**Files:**
- Create: `lib/editor/shadow.ts`, `tests/editor/shadow.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/editor/shadow.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseShadow, formatShadow, type Layer } from "@/lib/editor/shadow";

const SEED_SM = "0 1px 2px 0 oklch(0 0 0 / 0.05)";
const SEED_MD = "0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)";
const SEED_LG = "0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1)";

describe("parseShadow", () => {
  it("parses a single black layer (decimal alpha → percent)", () => {
    expect(parseShadow(SEED_SM)).toEqual([
      { inset: false, x: 0, y: 1, blur: 2, spread: 0, color: "black", alpha: 5 },
    ]);
  });
  it("parses multi-layer with negative spread", () => {
    const md = parseShadow(SEED_MD)!;
    expect(md).toHaveLength(2);
    expect(md[0]).toEqual({ inset: false, x: 0, y: 4, blur: 6, spread: -1, color: "black", alpha: 10 });
    expect(md[1].spread).toBe(-2);
  });
  it("parses inset, token var(), and color-mix token+alpha", () => {
    expect(parseShadow("inset 0 2px 4px 0 var(--brand-500)")![0])
      .toEqual({ inset: true, x: 0, y: 2, blur: 4, spread: 0, color: "--brand-500", alpha: 100 });
    expect(parseShadow("0 4px 8px 0 color-mix(in oklch, var(--brand-500) 30%, transparent)")![0])
      .toEqual({ inset: false, x: 0, y: 4, blur: 8, spread: 0, color: "--brand-500", alpha: 30 });
  });
  it("defaults missing blur/spread to 0 and clamps negative blur", () => {
    expect(parseShadow("1px 2px oklch(0 0 0 / 0.1)")![0]).toMatchObject({ x: 1, y: 2, blur: 0, spread: 0 });
    expect(parseShadow("0 0 -5px 0 oklch(0 0 0 / 0.1)")![0].blur).toBe(0);
  });
  it("returns null for unmodellable values", () => {
    expect(parseShadow("0 1px 2px rgb(0,0,0)")).toBeNull();          // raw rgb
    expect(parseShadow("0 1px 2px #000")).toBeNull();                 // hex
    expect(parseShadow("0 1px 2px oklch(0.2 0 0 / 0.3)")).toBeNull(); // non-black literal
    expect(parseShadow("none")).toBeNull();
    expect(parseShadow("red 0 1px 2px")).toBeNull();                  // leading-color grammar
    expect(parseShadow("garbage")).toBeNull();
  });
});

describe("formatShadow", () => {
  it("round-trips the three seeds to exact strings", () => {
    expect(formatShadow(parseShadow(SEED_SM)!)).toBe(SEED_SM);
    expect(formatShadow(parseShadow(SEED_MD)!)).toBe(SEED_MD);
    expect(formatShadow(parseShadow(SEED_LG)!)).toBe(SEED_LG);
  });
  it("emits bare 0 for zero lengths; 0px-input formats back to 0", () => {
    expect(formatShadow(parseShadow("0px 1px 2px 0px oklch(0 0 0 / 0.1)")!)).toBe("0 1px 2px 0 oklch(0 0 0 / 0.1)");
  });
  it("black alpha=100 → oklch(0 0 0); token alpha=100 → var(); token <100 → color-mix", () => {
    expect(formatShadow([{ inset: false, x: 0, y: 0, blur: 0, spread: 0, color: "black", alpha: 100 }]))
      .toBe("0 0 0 0 oklch(0 0 0)");
    expect(formatShadow([{ inset: false, x: 0, y: 2, blur: 4, spread: 0, color: "--brand-500", alpha: 100 }]))
      .toBe("0 2px 4px 0 var(--brand-500)");
    expect(formatShadow([{ inset: true, x: 0, y: 2, blur: 4, spread: 0, color: "--brand-500", alpha: 30 }]))
      .toBe("inset 0 2px 4px 0 color-mix(in oklch, var(--brand-500) 30%, transparent)");
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/editor/shadow.test.ts`
Expected: FAIL (Cannot find module `@/lib/editor/shadow`).

- [ ] **Step 3: Create `lib/editor/shadow.ts`**

```ts
// Pure box-shadow model + parse/format/clamp + pad coord helpers. No React, no DOM, no culori. Testable core.
import { splitTopLevel } from "@/lib/editor/css-list";

// color: the literal "black" sentinel (renders oklch(0 0 0 / a)) | a color-token name "--brand-500".
export interface Layer { inset: boolean; x: number; y: number; blur: number; spread: number;
                         color: string; alpha: number }
export type Shadow = Layer[]; // ≥ 1 layer

const round = (n: number) => Math.round(n * 100) / 100; // 2dp, trailing zeros dropped — NOT toFixed
export const clampPct = (n: number) => Math.max(0, Math.min(100, n));
export const clampBlur = (n: number) => Math.max(0, n);

// ---- format ----
const len = (n: number) => (n === 0 ? "0" : `${round(n)}px`);
function color(l: Layer): string {
  if (l.color === "black") return l.alpha >= 100 ? "oklch(0 0 0)" : `oklch(0 0 0 / ${round(l.alpha / 100)})`;
  const ref = `var(${l.color})`;
  return l.alpha >= 100 ? ref : `color-mix(in oklch, ${ref} ${round(clampPct(l.alpha))}%, transparent)`;
}
function formatLayer(l: Layer): string {
  return `${l.inset ? "inset " : ""}${len(l.x)} ${len(l.y)} ${len(clampBlur(l.blur))} ${len(l.spread)} ${color(l)}`;
}
export function formatShadow(layers: Shadow): string {
  return layers.map(formatLayer).join(", ");
}

/** A flat preview-safe box-shadow of just the first layer's color, for a summary swatch (resolved by view). */
export function layerColorCss(l: Layer): string { return color(l); }

// ---- parse ----
/** Split a layer into space-separated tokens, keeping fn(...) calls whole. */
function tokenize(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s.trim()) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ""; } }
    else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const LEN = /^-?\d*\.?\d+(px)?$/;
function parseColorToken(t: string): { color: string; alpha: number } | null {
  if (/^oklch\(\s*0\s+0\s+0\s*\)$/.test(t)) return { color: "black", alpha: 100 };
  const ok = /^oklch\(\s*0\s+0\s+0\s*\/\s*(\d*\.?\d+)\s*\)$/.exec(t);
  if (ok) return { color: "black", alpha: round(Number(ok[1]) * 100) };
  const vm = /^var\((--[\w-]+)\)$/.exec(t);
  if (vm) return { color: vm[1], alpha: 100 };
  const cm = /^color-mix\(inoklch,var\((--[\w-]+)\)(\d*\.?\d+)%,transparent\)$/.exec(t.replace(/\s+/g, ""));
  if (cm) return { color: cm[1], alpha: clampPct(Number(cm[2])) };
  return null; // raw color / unsupported
}

function parseLayer(raw: string): Layer | null {
  const toks = tokenize(raw);
  if (toks.length < 3) return null; // need ≥ 2 lengths + a color
  let inset = false;
  if (toks[0] === "inset") { inset = true; toks.shift(); }
  const lens: number[] = [];
  while (toks.length && LEN.test(toks[0])) lens.push(Number(toks.shift()!.replace("px", "")));
  if (lens.length < 2 || lens.length > 4 || toks.length !== 1) return null; // exactly one trailing color token
  const c = parseColorToken(toks[0]);
  if (!c) return null;
  const [x, y, blur = 0, spread = 0] = lens;
  return { inset, x, y, blur: clampBlur(blur), spread, color: c.color, alpha: c.alpha };
}

export function parseShadow(value: string): Shadow | null {
  const parts = splitTopLevel(value.trim());
  if (parts.length === 0) return null;
  const layers: Layer[] = [];
  for (const p of parts) { const l = parseLayer(p); if (!l) return null; layers.push(l); }
  return layers;
}

// ---- pad coord helpers (pure; take rect + range; centre = origin, y down-positive) ----
export function offsetFromPointer(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  range: number,
): { x: number; y: number } {
  const fx = rect.width <= 0 ? 0.5 : (clientX - rect.left) / rect.width;
  const fy = rect.height <= 0 ? 0.5 : (clientY - rect.top) / rect.height;
  return { x: round((fx * 2 - 1) * range), y: round((fy * 2 - 1) * range) };
}
/** Model x/y → clamped [0,100]% dot position (pins to edge when |value| > range). */
export function dotPercent(x: number, y: number, range: number): { left: number; top: number } {
  const pct = (v: number) => clampPct(((v / range) + 1) * 50);
  return { left: pct(x), top: pct(y) };
}
```

> **Note on the `color-mix` regex:** it strips whitespace first (`replace(/\s+/g,"")`) then matches the
> compact form, so `formatShadow` output and any spacing variant both parse. The round-trip test pins exact
> output spacing.

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run tests/editor/shadow.test.ts`
Expected: PASS. If a seed round-trip fails, check `len()` (bare `0`) and the black-alpha decimal
(`round(alpha/100)` → `0.05`/`0.1`, never `0.10`).

- [ ] **Step 5: Commit**

```bash
git add lib/editor/shadow.ts tests/editor/shadow.test.ts
git commit -m "feat(editor): pure shadow.ts — parse/format/clamp layered box-shadow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Clamp + pad-coord unit tests (pure)

**Files:** Modify `tests/editor/shadow.test.ts`.

- [ ] **Step 1: Append the failing tests**

```ts
import { clampPct, clampBlur, offsetFromPointer, dotPercent } from "@/lib/editor/shadow";

describe("clamps + pad coords", () => {
  it("clampPct/clampBlur", () => {
    expect(clampPct(150)).toBe(100); expect(clampPct(-3)).toBe(0);
    expect(clampBlur(-4)).toBe(0); expect(clampBlur(7)).toBe(7);
  });
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  it("offsetFromPointer: centre = origin, edges = ±range, y down-positive", () => {
    expect(offsetFromPointer(50, 50, rect, 32)).toEqual({ x: 0, y: 0 });
    expect(offsetFromPointer(100, 100, rect, 32)).toEqual({ x: 32, y: 32 });
    expect(offsetFromPointer(0, 0, rect, 32)).toEqual({ x: -32, y: -32 });
  });
  it("dotPercent pins to [0,100]% when value exceeds range", () => {
    expect(dotPercent(0, 0, 32)).toEqual({ left: 50, top: 50 });
    expect(dotPercent(64, -64, 32)).toEqual({ left: 100, top: 0 }); // beyond range → pinned
  });
});
```

- [ ] **Step 2: Run — verify pass** (helpers already exist from Task 2)

Run: `npx vitest run tests/editor/shadow.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/editor/shadow.test.ts
git commit -m "test(editor): clamp + pad-coord helpers for shadow.ts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `shadow-color-picker.tsx` — black sentinel + token grid + alpha

Purpose-built sibling of `GradientStopPicker` (read it first as the template). Emits
`{ color: "black" | "--name", alpha }`. **Copy** the popover/grid/alpha idiom; do NOT extract a shared grid.

**Files:**
- Create: `components/editor/controls/shadow-color-picker.tsx`
- Test: covered by the builder test (Task 5) + a focused render test appended to `shadow-builder.test.tsx`.
  (No standalone test file — it has no pure logic; behaviour is asserted through the builder.)

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import { layerColorCss, type Layer } from "@/lib/editor/shadow";

interface Props {
  color: string;          // "black" | "--name"
  alpha: number;          // 0–100
  tokens: ManifestToken[];
  onChange: (next: { color: string; alpha: number }) => void;
  label: string;          // e.g. "layer 1" — for accessible names
}

const swatchValue = (t: ManifestToken) => t.values.light ?? t.values.dark ?? "";
const asLayer = (color: string, alpha: number): Layer =>
  ({ inset: false, x: 0, y: 0, blur: 0, spread: 0, color, alpha }); // for layerColorCss swatch render

export function ShadowColorPicker({ color, alpha, tokens, onChange, label }: Props) {
  const colors = tokens.filter((t) => t.group === "color");
  const isBlack = color === "black";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="ed-shadow-color" ref={ref}>
      <button
        type="button"
        className="ed-shadow-swatch ed-shadow-trigger"
        aria-label={`${label} color`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ed-shadow-swatch-fill" style={{ background: layerColorCss(asLayer(color, alpha)) }} aria-hidden="true" />
      </button>

      {open && (
        <div className="ed-shadow-pop" role="menu" aria-label={`${label} color tokens`}>
          <div className="ed-shadow-swatches">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isBlack}
              className="ed-shadow-swatch"
              aria-label={`${label} black`}
              data-selected={isBlack ? "" : undefined}
              onClick={() => onChange({ color: "black", alpha: isBlack ? alpha : 100 })}
            >
              <span className="ed-shadow-swatch-fill" style={{ background: "oklch(0 0 0)" }} aria-hidden="true" />
            </button>
            {colors.map((t) => (
              <button
                key={t.name}
                type="button"
                role="menuitemradio"
                aria-checked={color === t.name}
                className="ed-shadow-swatch"
                aria-label={t.name}
                data-selected={color === t.name ? "" : undefined}
                onClick={() => onChange({ color: t.name, alpha })}
              >
                <span className="ed-shadow-swatch-fill" style={{ background: swatchValue(t) }} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="ed-shadow-alpha">
            <span className="ed-shadow-alpha-label" aria-hidden="true">alpha</span>
            <input
              type="range"
              aria-label={`${label} alpha`}
              min={0} max={100} step={1}
              value={alpha}
              onChange={(e) => onChange({ color, alpha: Number(e.target.value) })}
            />
            <span className="ed-shadow-alpha-val" aria-hidden="true">{`${alpha}%`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

> The alpha slider here is live (`onChange` per move). Per spec §2 only the **pad** drag needs commit-once
> coalescing (it floods history via `setDrag`); the alpha range is a discrete control on an existing popover —
> but to avoid history-flooding on alpha-drag, the **builder** wires this picker's `onChange` straight to a
> single `emit` per change (acceptable: it mirrors the gradient stop picker's live alpha, which ships today).
> If review wants alpha coalesced, revisit — keep parity with gradient for now.

- [ ] **Step 2: Typecheck (no test yet — exercised in Task 5)**

Run: `npx tsc --noEmit -p tsconfig.json` (or rely on Task 5's `next build`).
Expected: no errors in this file.

- [ ] **Step 3: Commit**

```bash
git add components/editor/controls/shadow-color-picker.tsx
git commit -m "feat(editor): shadow color picker (black sentinel + token grid + alpha)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `shadow-builder.tsx` — the view (TDD via jsdom)

Read `gradient-builder.tsx` first — copy the drag-buffer shape (`mode`/`working` refs + window `useEffect`
keyed on `[value]` + the `eslint-disable exhaustive-deps`), the `NumField` pattern, and the disabled
early-return-after-hooks. Decompose into in-file `LayerCard` + `LayerSummaryRow`. **Per-layer `useDraftField`
calls MUST live in `LayerCard`** (hook-count safety).

**Files:**
- Create: `components/editor/controls/shadow-builder.tsx`, `tests/editor/shadow-builder.test.tsx`

- [ ] **Step 1: Write the failing test** — `tests/editor/shadow-builder.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ShadowBuilder } from "@/components/editor/controls/shadow-builder";

const tokens = [
  { name: "--brand-500", group: "color", values: { light: "oklch(0.6 0.2 250)" } },
] as any;
const props = (value: string, onChange = vi.fn()) =>
  ({ token: "--elevation-md", value, onChange, tokens });

describe("ShadowBuilder", () => {
  beforeEach(() => { /* jsdom: no layout */ });

  it("renders preview, one layer card per layer, add + raw row; emits nothing on mount", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)", onChange)} />);
    expect(screen.getByLabelText(/raw value/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /add layer/i })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("numeric blur commits on Enter (one onChange), reverts on Escape", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    const blur = screen.getByLabelText(/layer 1 blur/i) as HTMLInputElement;
    fireEvent.change(blur, { target: { value: "12" } });
    expect(onChange).not.toHaveBeenCalled();           // not while typing
    fireEvent.keyDown(blur, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("12px"));
  });

  it("add layer → one onChange with an extra (visible) layer; remove disabled at 1 layer", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    expect((screen.getByRole("button", { name: /remove layer 1/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].split(",").length).toBe(2);
  });

  it("inset toggle reads initial state, flips aria-pressed, emits with inset", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("inset 0 2px 4px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    const toggle = screen.getByRole("button", { name: /layer 1 inset/i });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");      // initial reads model
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).not.toContain("inset");
  });

  it("accordion: collapsed layer inputs not in tree; expander toggles aria-expanded; expand emits nothing", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1), 0 2px 4px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    // layer 1 open by default, layer 2 collapsed
    expect(screen.queryByLabelText(/layer 2 blur/i)).toBeNull();
    const exp2 = screen.getByRole("button", { name: /expand layer 2/i });
    expect(exp2.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(exp2);
    expect(exp2.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText(/layer 2 blur/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();                       // pure UI
  });

  it("unmodellable value → dimmed fallback, raw row holds it, emits nothing on mount; raw commit emits", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 1px 2px rgb(0,0,0)", onChange)} />);
    const raw = screen.getByLabelText(/raw value/i) as HTMLInputElement;
    expect(raw.value).toBe("0 1px 2px rgb(0,0,0)");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(raw, { target: { value: "0 2px 4px 0 oklch(0 0 0 / 0.2)" } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("0 2px 4px 0 oklch(0 0 0 / 0.2)");
  });

  it("dark-block disabled: shows switch-to-Light, emits nothing", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)", onChange)} disabled />);
    expect(screen.getByText(/switch to the Light block/i)).toBeTruthy();
    expect(screen.queryByLabelText(/layer 1 blur/i)).toBeNull();
  });

  it("a11y: pad aria-hidden, numeric inputs labelled per layer, color grid is a menu", () => {
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)")} />);
    expect(screen.getByLabelText(/layer 1 x offset/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/layer 1 color/i));
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/editor/shadow-builder.test.tsx`
Expected: FAIL (Cannot find module `shadow-builder`).

- [ ] **Step 3: Implement `shadow-builder.tsx`**

Structure (write it to satisfy the tests — model on `gradient-builder.tsx`):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import {
  parseShadow, formatShadow, clampPct, clampBlur, offsetFromPointer, dotPercent,
  type Shadow, type Layer,
} from "@/lib/editor/shadow";
import { useDraftField } from "@/lib/editor/use-draft-field";
import { ShadowColorPicker } from "@/components/editor/controls/shadow-color-picker";

const PAD_RANGE = 32;
const FALLBACK: Shadow = [{ inset: false, x: 0, y: 4, blur: 6, spread: 0, color: "black", alpha: 10 }];
const ADD_DEFAULT: Layer = { inset: false, x: 0, y: 2, blur: 4, spread: 0, color: "black", alpha: 15 };
const isNum = (v: string) => v.trim().length > 0 && Number.isFinite(Number(v.trim()));
const RAW_VALID = (v: string) =>
  !/[;{}]|\/\*|\*\//.test(v) && /(^|[\s,])(inset|none|var\(|oklch\(|color-mix\(|-?\d*\.?\d+px?)/.test(v.trim());

interface Props {
  token: string; value: string; onChange: (v: string) => void; tokens: ManifestToken[]; disabled?: boolean;
}

// ---- LayerCard (expanded): pad + numeric twins + color picker + inset toggle + remove ----
function NumField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const f = useDraftField(String(value), (v) => onCommit(Number(v)), isNum);
  return (
    <input type="number" className="ed-shadow-num" aria-label={label} step={1}
      value={f.draft} onChange={f.onChange} onBlur={f.onBlur} onKeyDown={f.onKeyDown} />
  );
}

function LayerCard({
  id, n, token, layer, tokens, canRemove, onLayer, onRemove, onPadDown, dot, badge,
}: {
  id: string; n: number; token: string; layer: Layer; tokens: ManifestToken[]; canRemove: boolean;
  onLayer: (l: Layer) => void; onRemove: () => void;
  onPadDown: (e: React.PointerEvent) => void;
  dot: { left: number; top: number }; badge: { x: number; y: number } | null;
}) {
  const lbl = `${token} layer ${n}`;
  return (
    <div className="ed-shadow-card" id={id}>
      <div className="ed-shadow-pad" aria-hidden="true" onPointerDown={onPadDown}>
        <span className="ed-shadow-dot" style={{ left: `${dot.left}%`, top: `${dot.top}%` }} />
        {badge && <span className="ed-shadow-badge">{`x ${badge.x} · y ${badge.y}`}</span>}
      </div>
      <div className="ed-shadow-fields">
        <label className="ed-shadow-axis"><span aria-hidden="true">x</span>
          <NumField label={`${lbl} x offset`} value={layer.x} onCommit={(v) => onLayer({ ...layer, x: v })} /></label>
        <label className="ed-shadow-axis"><span aria-hidden="true">y</span>
          <NumField label={`${lbl} y offset`} value={layer.y} onCommit={(v) => onLayer({ ...layer, y: v })} /></label>
        <label className="ed-shadow-axis"><span aria-hidden="true">blur</span>
          <NumField label={`${lbl} blur`} value={layer.blur} onCommit={(v) => onLayer({ ...layer, blur: clampBlur(v) })} /></label>
        <label className="ed-shadow-axis"><span aria-hidden="true">spread</span>
          <NumField label={`${lbl} spread`} value={layer.spread} onCommit={(v) => onLayer({ ...layer, spread: v })} /></label>
      </div>
      <div className="ed-shadow-row2">
        <ShadowColorPicker color={layer.color} alpha={layer.alpha} tokens={tokens} label={`layer ${n}`}
          onChange={({ color, alpha }) => onLayer({ ...layer, color, alpha })} />
        <button type="button" className="ed-shadow-inset" aria-pressed={layer.inset}
          aria-label={`${lbl} inset`} data-on={layer.inset ? "" : undefined}
          onClick={() => onLayer({ ...layer, inset: !layer.inset })}>inset</button>
        <button type="button" className="ed-iconbtn" aria-label={`Remove layer ${n}`}
          disabled={!canRemove} onClick={onRemove}>✕</button>
      </div>
    </div>
  );
}

function LayerSummaryRow({ n, layer, onExpand, onRemove, canRemove, cardId }: {
  n: number; layer: Layer; onExpand: () => void; onRemove: () => void; canRemove: boolean; cardId: string;
}) {
  return (
    <div className="ed-shadow-summary">
      <button type="button" className="ed-shadow-expander" aria-expanded={false} aria-controls={cardId}
        aria-label={`Expand layer ${n}`} onClick={onExpand}>
        <span className="ed-shadow-summary-swatch" aria-hidden="true"
          style={{ background: layer.color === "black" ? "oklch(0 0 0)" : `var(${layer.color})` }} />
        <span className="ed-shadow-summary-text">{`${layer.x} ${layer.y} · blur ${layer.blur}${layer.inset ? " · inset" : ""}`}</span>
      </button>
      <button type="button" className="ed-iconbtn" aria-label={`Remove layer ${n}`}
        disabled={!canRemove} onClick={onRemove}>✕</button>
    </div>
  );
}

export function ShadowBuilder({ token, value, onChange, tokens, disabled = false }: Props) {
  const parsed = parseShadow(value);
  const [drag, setDrag] = useState<Shadow | null>(null);
  const display: Shadow = drag ?? parsed ?? FALLBACK;
  const editable = parsed !== null;
  const [surfaceDark, setSurfaceDark] = useState(false);
  const [open, setOpen] = useState(0); // accordion open index (transient UI state)
  const [announce, setAnnounce] = useState("");

  // clamp open index if layer count shrank (undo/reset)
  const openIdx = Math.min(open, display.length - 1);

  const emit = (s: Shadow) => onChange(formatShadow(s));
  const raw = useDraftField(value, (v) => onChange(v), RAW_VALID);

  const setLayer = (i: number, l: Layer) => emit(display.map((p, j) => (j === i ? l : p)));
  const removeLayer = (i: number) => {
    if (display.length <= 1) return;
    setAnnounce(`Layer ${i + 1} removed, ${display.length - 1} remain`);
    emit(display.filter((_, j) => j !== i));
    setOpen((o) => Math.max(0, o > i ? o - 1 : o));
  };
  const addLayer = () => {
    setAnnounce(`Layer ${display.length + 1} added`);
    setOpen(display.length);
    emit([...display, { ...ADD_DEFAULT }]);
  };

  // ---- pad drag: commit once on pointer-up ----
  const padRef = useRef<HTMLDivElement | null>(null);
  const mode = useRef<{ index: number } | null>(null);
  const working = useRef<Shadow | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const m = mode.current, g = working.current;
      if (!m || !g || !padRef.current) return;
      const { x, y } = offsetFromPointer(e.clientX, e.clientY, padRef.current.getBoundingClientRect(), PAD_RANGE);
      const next = g.map((p, j) => (j === m.index ? { ...p, x, y } : p));
      working.current = next; setDrag(next);
    };
    const up = () => {
      if (!mode.current || !working.current) return;
      emit(working.current); mode.current = null; working.current = null; setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const startPad = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    padRef.current = e.currentTarget as HTMLDivElement;
    mode.current = { index }; working.current = display; setDrag(display);
  };

  if (disabled) {
    return (
      <div className="ed-shadow" data-disabled="">
        <div className="ed-shadow-preview" data-surface={surfaceDark ? "dark" : "light"}>
          <span className="ed-shadow-card-preview" style={{ boxShadow: value }} aria-hidden="true" />
        </div>
        <p className="ed-shadow-fallback" role="status">
          Shadows are theme-independent — switch to the Light block to edit.
        </p>
      </div>
    );
  }

  return (
    <div className="ed-shadow" data-editable={editable}>
      <span className="ed-sr-only" aria-live="polite">{announce}</span>

      <div className="ed-shadow-preview" data-surface={surfaceDark ? "dark" : "light"}>
        <span className="ed-shadow-card-preview" style={{ boxShadow: value }} aria-hidden="true" />
        <button type="button" className="ed-shadow-surface" aria-label="Toggle preview surface"
          aria-pressed={surfaceDark} onClick={() => setSurfaceDark((v) => !v)}>
          {surfaceDark ? "dark bg" : "light bg"}
        </button>
      </div>

      <div className="ed-shadow-layers">
        {display.map((layer, i) => {
          const cardId = `ed-shadow-card-${i}`;
          if (i !== openIdx) {
            return (
              <LayerSummaryRow key={i} n={i + 1} layer={layer} cardId={cardId} canRemove={display.length > 1}
                onExpand={() => setOpen(i)} onRemove={() => removeLayer(i)} />
            );
          }
          const isDragging = drag !== null && mode.current?.index === i;
          return (
            <LayerCard key={i} id={cardId} n={i + 1} token={token} layer={layer} tokens={tokens}
              canRemove={display.length > 1}
              onLayer={(l) => setLayer(i, l)} onRemove={() => removeLayer(i)}
              onPadDown={(e) => startPad(e, i)}
              dot={dotPercent(layer.x, layer.y, PAD_RANGE)}
              badge={isDragging ? { x: layer.x, y: layer.y } : null} />
          );
        })}
        <button type="button" className="ed-shadow-addlayer" onClick={addLayer}>+ Add layer</button>
      </div>

      {!editable && (
        <p className="ed-shadow-fallback">Can’t edit this shadow visually — editing the raw value.</p>
      )}

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">raw</span>
        <input type="text" aria-label={`${token} raw value`}
          value={raw.draft} onChange={raw.onChange} onBlur={raw.onBlur} onKeyDown={raw.onKeyDown} />
      </div>
    </div>
  );
}
```

> **eslint note:** `padRef.current = e.currentTarget` is set inside the `startPad` event handler (not during
> render) — safe. The `[value]`-keyed effect needs the `exhaustive-deps` disable (copied from gradient).

- [ ] **Step 4: Run — verify it passes**

Run: `npx vitest run tests/editor/shadow-builder.test.tsx`
Expected: PASS. (jsdom: pad drag relies on `getBoundingClientRect` — the tests here don't drag the pad; a
drag-emits-once test is added in the e2e/shot phase where layout exists. If you add a jsdom drag test, mock
`getBoundingClientRect` + `setPointerCapture` as `gradient-builder.test.tsx` does.)

- [ ] **Step 5: Run the full editor suite — no regressions**

Run: `npx vitest run tests/editor/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/editor/controls/shadow-builder.tsx tests/editor/shadow-builder.test.tsx
git commit -m "feat(editor): layered shadow builder view (accordion, pad, raw, disabled)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire control-map + control-host (ATOMIC — must compile together)

**Files:**
- Modify: `lib/editor/control-map.ts:3-5,24`, `components/editor/controls/control-host.tsx`
- Test: `tests/editor/control-host.test.tsx` (create or extend)

- [ ] **Step 1: Write/extend the failing test** — `tests/editor/control-host.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { controlKindForGroup } from "@/lib/editor/control-map";

describe("control-map: shadow", () => {
  it("maps shadow group to the shadow control kind", () => {
    expect(controlKindForGroup("shadow")).toBe("shadow");
  });
});
```

(If a `control-host` render test already exists, add a case asserting a `shadow` token renders the builder —
otherwise the `control-map` assertion + the `next build` type-check is sufficient.)

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/editor/control-host.test.tsx`
Expected: FAIL (`controlKindForGroup("shadow")` returns `"text"`).

- [ ] **Step 3: Edit `lib/editor/control-map.ts`** — add `"shadow"` to `CONTROL_KINDS` and flip the map:

```ts
export const CONTROL_KINDS = [
  "color", "length", "number", "opacity", "select", "duration", "easing", "text", "gradient", "shadow",
] as const;
```
```ts
  shadow: "shadow",   // was "text"
```

- [ ] **Step 4: Edit `components/editor/controls/control-host.tsx`** — import + add the `case` (before the
`default`):

```tsx
import { ShadowBuilder } from "@/components/editor/controls/shadow-builder";
```
```tsx
    case "shadow":
      return (
        <ShadowBuilder
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
          tokens={MANIFEST.tokens}
          disabled={editingBlock === "dark" && token.values.dark === undefined}
        />
      );
```

- [ ] **Step 5: Run — verify it passes + typechecks**

Run: `npx vitest run tests/editor/control-host.test.tsx && npx tsc --noEmit -p tsconfig.json`
Expected: PASS + no type errors (the `_never` guard is satisfied).

- [ ] **Step 6: Commit**

```bash
git add lib/editor/control-map.ts components/editor/controls/control-host.tsx tests/editor/control-host.test.tsx
git commit -m "feat(editor): wire shadow control kind → ShadowBuilder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `.ed-shadow-*` chrome (CSS)

`editor-chrome.css` uses the `--ed-*` namespace (real vars only: `--ed-panel`, `--ed-panel-raised`,
`--ed-field`, `--ed-border`, `--ed-text`, `--ed-muted`, `--ed-accent`, `--ed-warn` — **no** `--ed-bg`/
`--ed-fg`). The file is excluded from `npm run check`. Read the `.ed-gradient-*` block as the template.

**Files:** Modify `components/editor/editor-chrome.css` (append a `.ed-shadow-*` section).

- [ ] **Step 1: Add the chrome** — covering: `.ed-shadow` container; `.ed-shadow-preview` (neutral surface,
`position: sticky; top: 0`, `data-surface="dark"` variant) + `.ed-shadow-card-preview` (filled card with
margin); `.ed-shadow-surface` toggle; `.ed-shadow-pad` (64px square) + `.ed-shadow-dot` + `.ed-shadow-badge`;
`.ed-shadow-fields`/`.ed-shadow-axis`/`.ed-shadow-num` (+ **`.ed-shadow-num:focus-visible` outline** — the
inputs are the keyboard path; `.ed-row input{all:unset}` strips it); `.ed-shadow-row2`; `.ed-shadow-inset`
(+ `[data-on]` filled state); `.ed-shadow-color`/`-swatch`/`-pop`/`-swatches`/`-alpha` (mirror
`.ed-gradient-*` popover); `.ed-shadow-summary`/`-expander`/`-swatch`/`-text`; `.ed-shadow-addlayer`;
`.ed-shadow-fallback` (dimmed). Reuse existing `.ed-iconbtn`, `.ed-row`, `.ed-label`, `.ed-sr-only`.

> Pixel/color values are tuned in Task 8's screenshot loop — start from the `.ed-gradient-*` values. Use only
> the real `--ed-*` vars (a nonexistent var renders transparent silently).

- [ ] **Step 2: Build (CSS compiles only via `next build`)**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/editor/editor-chrome.css
git commit -m "style(editor): .ed-shadow-* chrome (sticky preview, pad, accordion, focus rings)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: e2e + screenshot self-critique + gate

**Files:** Create `e2e/shadow-builder.spec.ts`; throwaway shots into `e2e/__shots__/` (gitignored).

- [ ] **Step 1: Write the e2e** — `e2e/shadow-builder.spec.ts` (model on the gradient e2e if present):
  open `/design-system`, enable the editor, click a `--elevation-*` `data-token`, assert the builder renders
  (preview + a layer card + the add button), drag/edit a numeric, assert the element's computed
  `box-shadow` (or the inline `--elevation-*` var) changed.

```ts
import { test, expect } from "@playwright/test";

test("shadow builder edits a computed box-shadow", async ({ page }) => {
  await page.goto("/design-system");
  // enable editor + select an elevation token (mirror the gradient/editor e2e setup)
  // ... open editor, click [data-token="--elevation-md"] ...
  const blur = page.getByLabel(/layer 1 blur/i);
  await blur.fill("20");
  await blur.press("Enter");
  // assert the live preview / computed box-shadow reflects 20px blur
  // (use the same assertion style as the gradient e2e)
});
```

- [ ] **Step 2: Run e2e**

Run: `npx playwright test e2e/shadow-builder.spec.ts`
Expected: PASS. (If the editor-open/selection setup differs, copy it from the existing gradient/editor
e2e spec.)

- [ ] **Step 3: Throwaway shot spec → self-critique**

Write a temp spec into `e2e/__shots__/` capturing: single-layer resting, multi-layer accordion (one open +
summaries), a tinted glow (token color), an inset layer, the dark preview-surface. `Read` the PNGs;
critique against `docs/DESIGN-BRIEF.md` (spacing, the `--ed-*` palette, pad/badge legibility, focus ring
visibility, summary-row density). Iterate on `.ed-shadow-*` CSS; re-render after each tweak.

- [ ] **Step 4: Full gate**

Run: `npm run verify && npx playwright test`
Expected: `check` ✓ (4 ds-disable), all vitest ✓, lint ✓, `next build` ✓, e2e ✓.

- [ ] **Step 5: Commit (e2e only — shots are gitignored)**

```bash
git add e2e/shadow-builder.spec.ts
git commit -m "test(e2e): shadow builder edits computed box-shadow

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: USER screenshot review (human checkpoint)** — present the builder screenshots; the user
reviews exact px/colors before this is called done. Iterate via screenshots until approved.

---

## Task 9: HANDOFF + merge

- [ ] **Step 1:** Update `docs/HANDOFF.md` — mark the shadow builder DONE (date 2026-06-23), update test
counts (vitest + e2e), note it's the **last M4 builder** (M4 fast-follows complete). Note documented
limitations (non-black-literal/`%`/leading-color/`none` → raw row; dark-block disabled; alpha live not
coalesced if kept). Commit.
- [ ] **Step 2:** Final `npm run verify && npx playwright test` green.
- [ ] **Step 3:** Merge `m4-shadow-builder` → `main` with `--no-ff`; delete the branch. (Per project
convention; confirm with the user first.)

---

## Notes / gotchas (from spec review)

- **Round-trip is load-bearing for `manifest-fresh`:** `len()` must emit bare `0`, and black alpha must be
  `round(alpha/100)` decimal (`0.05`/`0.1`), never `toFixed` (`0.10`). Task 2 test pins all three seeds.
- **Atomicity:** Task 6 is one commit — adding `"shadow"` to `CONTROL_KINDS` makes `control-host`'s `_never`
  guard a compile error until the `case` lands. Only `next build` catches a half-edit.
- **Hooks:** per-layer `useDraftField` live in `LayerCard`; the disabled early-return sits AFTER all hooks.
- **Shared tree:** execute in-session; never let a subagent `git checkout` in this repo.
- **Open-index** clamps when layer count shrinks (undo/reset) — `openIdx = min(open, length-1)`.
