# Pick-anywhere (reverse token resolution) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> **PROJECT OVERRIDE (HANDOFF.md):** Execute **in-session** (TDD, commit per task) — NOT via subagents (shared-tree `git checkout` orphans commits; see memory `subagent-shared-tree-checkout-hazard`).

**Goal:** Add an eyedropper "pick-anywhere" mode to the editor: click any element → resolve which design token(s) drive its computed styles → popover → open the token in the docked panel.

**Architecture:** A pure matcher (`lib/editor/resolve-token.ts`) compares an element's canonicalized computed values to a token index built by a DOM **probe** (`lib/editor/use-probe-index.ts`) that reads `var(<token>)` back through `getComputedStyle` (computed→computed, never authored). Hover/highlight is a shared extracted hook (`lib/editor/use-hover-rect.ts`) used by both the existing `highlight-overlay` and the new `pick-overlay`. `pickMode` is a provider sub-mode of `enabled`.

**Tech Stack:** TypeScript, React 19, `culori` (color canonicalization, already a dep), `getComputedStyle` probing, Vitest + Testing Library (jsdom), Playwright e2e, `@untitled-ui/icons-react` (`Dropper`), `--ed-*` editor chrome CSS.

**Spec:** [docs/superpowers/specs/2026-06-22-pick-anywhere-design.md](../specs/2026-06-22-pick-anywhere-design.md)

**Conventions (read first):** `.test.tsx` need `// @vitest-environment jsdom`; `@` alias via `vitest.config.ts`. TDD per @superpowers:test-driven-development; commit per task. Pre-commit runs `npm run check`. Before merge: **`npm run verify`** (check && test && lint && build) per memory `run-next-build-before-merge`. The editor is a dev-only island (`components/editor/*`) tree-shaken from prod; chrome uses `--ed-*` classes in `editor-chrome.css` (excluded from `npm run check`).

---

## Task 1: Pure resolver (`lib/editor/resolve-token.ts`)

**Files:**
- Create: `lib/editor/resolve-token.ts`
- Test: `tests/editor/resolve-token.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/editor/resolve-token.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  canonicalize, resolveMatches, GROUP_PROPERTY, PROPERTY_GROUP,
  type TokenIndex, type ElementValue,
} from "@/lib/editor/resolve-token";

describe("canonicalize", () => {
  it("colour: equal colours in different serializations canonicalize equal", () => {
    expect(canonicalize("background-color", "oklch(0.205 0 0)")).toBe(
      canonicalize("color", "rgb(23, 23, 23)") !== null
        ? canonicalize("color", "rgb(23, 23, 23)")
        : "x", // sanity: both non-null
    );
    expect(canonicalize("background-color", "rgb(23, 23, 23)")).toBe(canonicalize("color", "rgb(23,23,23)"));
  });
  it("colour: alpha < 1 / transparent is rejected (skipped, no match)", () => {
    expect(canonicalize("background-color", "rgba(0, 0, 0, 0)")).toBeNull();
    expect(canonicalize("background-color", "oklch(0.97 0 0 / 0.4)")).toBeNull();
    expect(canonicalize("background-color", "transparent")).toBeNull();
  });
  it("box-shadow: strips empty composed layers so a 5-layer element equals a 2-layer probe", () => {
    const element =
      "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
      "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
      "oklch(0 0 0 / 0.1) 0px 4px 6px -1px, oklch(0 0 0 / 0.1) 0px 2px 4px -2px";
    const probe = "oklch(0 0 0 / 0.1) 0px 4px 6px -1px, oklch(0 0 0 / 0.1) 0px 2px 4px -2px";
    expect(canonicalize("box-shadow", element)).toBe(canonicalize("box-shadow", probe));
  });
  it("box-shadow: none is rejected", () => {
    expect(canonicalize("box-shadow", "none")).toBeNull();
  });
  it("font-size / border-radius pass through as the px string", () => {
    expect(canonicalize("font-size", "14px")).toBe("14px");
    expect(canonicalize("border-radius", "8px")).toBe("8px");
  });
});

describe("resolveMatches", () => {
  const index: TokenIndex = {
    color: [
      { token: "--primary", canonical: "#171717" },
      { token: "--card", canonical: "#ffffff" },
      { token: "--background", canonical: "#ffffff" },
      { token: "--popover", canonical: "#ffffff" },
    ],
    radius: [{ token: "--radius", canonical: "8px" }, { token: "--radius", canonical: "10px" }],
  };
  it("single match", () => {
    const ev: ElementValue[] = [{ property: "background-color", group: "color", canonical: "#171717" }];
    expect(resolveMatches(ev, index)).toEqual([
      { property: "background-color", group: "color", value: "#171717", tokens: ["--primary"] },
    ]);
  });
  it("lists ALL tokens on a value collision", () => {
    const ev: ElementValue[] = [{ property: "background-color", group: "color", canonical: "#ffffff" }];
    expect(resolveMatches(ev, index)[0].tokens).toEqual(["--card", "--background", "--popover"]);
  });
  it("groups multiple properties of one element", () => {
    const ev: ElementValue[] = [
      { property: "background-color", group: "color", canonical: "#171717" },
      { property: "border-radius", group: "radius", canonical: "8px" },
    ];
    const m = resolveMatches(ev, index);
    expect(m.map((x) => x.property)).toEqual(["background-color", "border-radius"]);
    expect(m[1].tokens).toEqual(["--radius"]);
  });
  it("no match → empty", () => {
    expect(resolveMatches([{ property: "color", group: "color", canonical: "#abcabc" }], index)).toEqual([]);
  });
});

describe("GROUP_PROPERTY / PROPERTY_GROUP", () => {
  it("covers exactly the in-scope groups (list-the-groups guard; it is a Partial map)", () => {
    expect(Object.keys(GROUP_PROPERTY).sort()).toEqual(
      ["color", "fontFamily", "fontSize", "radius", "shadow"].sort(),
    );
    // out-of-scope groups absent
    for (const g of ["spacing", "duration", "zIndex", "borderWidth", "fontWeight", "lineHeight", "container", "opacity"]) {
      expect(GROUP_PROPERTY[g as keyof typeof GROUP_PROPERTY]).toBeUndefined();
    }
  });
  it("PROPERTY_GROUP inverts GROUP_PROPERTY", () => {
    for (const [group, props] of Object.entries(GROUP_PROPERTY)) {
      for (const p of props!) expect(PROPERTY_GROUP[p]).toBe(group);
    }
  });
});
```

- [ ] **Step 2: Run test → fails** (module missing).
Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/resolve-token.test.ts`
Expected: FAIL (cannot resolve `@/lib/editor/resolve-token`).

- [ ] **Step 3: Implement**

Create `lib/editor/resolve-token.ts`:

```ts
/** Pure reverse-resolution: match an element's canonical computed values to design tokens. No DOM. */
import { parse, formatHex } from "culori";
import type { TokenGroup } from "@/lib/tokens/types";

export type CssProperty =
  | "background-color" | "color" | "border-radius" | "font-size" | "font-family" | "box-shadow";

/** In-scope groups → the ELEMENT CSS properties to read+match. Partial: only the picked groups. */
export const GROUP_PROPERTY: Partial<Record<TokenGroup, CssProperty[]>> = {
  color: ["background-color", "color"],
  radius: ["border-radius"],
  fontSize: ["font-size"],
  fontFamily: ["font-family"],
  shadow: ["box-shadow"],
};

/** The representative property used to canonicalize a token's probed value, per group. */
export const GROUP_CANON_PROP: Partial<Record<TokenGroup, CssProperty>> = {
  color: "color",
  radius: "border-radius",
  fontSize: "font-size",
  fontFamily: "font-family",
  shadow: "box-shadow",
};

/** property → group (inverse of GROUP_PROPERTY), for routing an element read to the right index bucket. */
export const PROPERTY_GROUP: Record<CssProperty, TokenGroup> = {
  "background-color": "color",
  color: "color",
  "border-radius": "radius",
  "font-size": "fontSize",
  "font-family": "fontFamily",
  "box-shadow": "shadow",
};

export interface TokenValue { token: string; canonical: string; }
export type TokenIndex = Partial<Record<TokenGroup, TokenValue[]>>;
export interface ElementValue { property: CssProperty; group: TokenGroup; canonical: string; }
export interface Match { property: CssProperty; group: TokenGroup; value: string; tokens: string[]; }

const isColorProp = (p: CssProperty) => p === "background-color" || p === "color";

/** Paren-aware comma split (box-shadow layers may contain `rgb(0, 0, 0)`). */
function splitLayers(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A composed shadow layer with all-zero offsets/blur/spread contributes nothing — drop it. */
function stripEmptyShadowLayers(s: string): string {
  return splitLayers(s)
    .filter((layer) => {
      const noColor = layer
        .replace(/(rgba?|oklch|oklab|hsla?|color|lab|lch)\([^)]*\)/gi, "")
        .replace(/#[0-9a-f]+/gi, "")
        .replace(/\b(transparent|currentcolor)\b/gi, "");
      const lengths = noColor.match(/-?\d*\.?\d+px/g) ?? [];
      return !lengths.every((l) => parseFloat(l) === 0);
    })
    .join(", ");
}

/** Canonicalize a raw computed value to a comparable key, or null to skip (no match for this property). */
export function canonicalize(property: CssProperty, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (isColorProp(property)) {
    const c = parse(v);
    if (!c) return null;
    if (c.alpha !== undefined && c.alpha < 1) return null; // color-mix / transparent → skip
    return formatHex(c); // 8-bit canonical; both rgb- and oklch-serialized inputs collapse here
  }
  if (property === "box-shadow") {
    if (v === "none") return null;
    const stripped = stripEmptyShadowLayers(v);
    return stripped.length ? stripped : null;
  }
  if (property === "font-family") {
    return v.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).join(",");
  }
  // font-size / border-radius: the px string as-is
  return v;
}

/** Pure: element values + token index → grouped matches (all collisions listed). */
export function resolveMatches(elementValues: ElementValue[], index: TokenIndex): Match[] {
  const matches: Match[] = [];
  for (const ev of elementValues) {
    const bucket = index[ev.group] ?? [];
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const tv of bucket) {
      if (tv.canonical === ev.canonical && !seen.has(tv.token)) {
        seen.add(tv.token);
        tokens.push(tv.token);
      }
    }
    if (tokens.length) matches.push({ property: ev.property, group: ev.group, value: ev.canonical, tokens });
  }
  return matches;
}
```

- [ ] **Step 4: Run test → pass.**
Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/resolve-token.test.ts`
Expected: PASS. (If the colour test's first assertion is awkward, it still asserts both forms canonicalize to the same `#171717`.)

- [ ] **Step 5: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/editor/resolve-token.ts tests/editor/resolve-token.test.ts
git commit -m "feat(editor): pure reverse-resolution matcher (resolve-token)"
```

---

## Task 2: Extract `use-hover-rect`, refactor highlight-overlay onto it

**Files:**
- Create: `lib/editor/use-hover-rect.ts`
- Modify (refactor): `components/editor/highlight-overlay.tsx`
- Test: `tests/editor/use-hover-rect.test.tsx` (new) + `tests/editor/highlight-overlay.test.tsx` (must still pass unchanged)

- [ ] **Step 1: Write the failing test**

Create `tests/editor/use-hover-rect.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { useHoverRect } from "@/lib/editor/use-hover-rect";

afterEach(cleanup);
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, left: 20, width: 100, height: 40 }) as DOMRect;
});

function Harness({ onPick }: { onPick: (el: HTMLElement) => void }) {
  const { box, boxRef } = useHoverRect<HTMLElement>({
    active: true,
    match: (t) => (t instanceof HTMLElement && t.dataset.pickable ? { el: t, payload: t } : null),
    onPick,
    onScroll: "dismiss",
  });
  return (
    <div>
      {box && <div ref={boxRef} data-testid="box" style={{ top: box.top }} />}
      <button data-pickable="1">target</button>
      <div data-testid="outside">outside</div>
    </div>
  );
}

describe("useHoverRect", () => {
  it("shows a box on hover of a matching element, clears on leaving to a non-match", () => {
    const { container, getByText, getByTestId } = render(<Harness onPick={() => {}} />);
    act(() => fireEvent.pointerMove(getByText("target"), { bubbles: true }));
    expect(getByTestId("box")).toBeTruthy();
    act(() => fireEvent.pointerMove(getByTestId("outside"), { bubbles: true }));
    expect(container.querySelector('[data-testid="box"]')).toBeNull();
  });
  it("calls onPick with the matched element on click", () => {
    const onPick = vi.fn();
    const { getByText } = render(<Harness onPick={onPick} />);
    act(() => fireEvent.click(getByText("target"), { bubbles: true }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect((onPick.mock.calls[0][0] as HTMLElement).tagName).toBe("BUTTON");
  });
});
```

- [ ] **Step 2: Run → fails** (module missing).
Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/use-hover-rect.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

Create `lib/editor/use-hover-rect.ts`:

```ts
"use client";
import { useEffect, useRef, useState } from "react";

export interface HoverBox { top: number; left: number; width: number; height: number; label: string | null; }

export interface HoverMatch<M> { el: HTMLElement; payload: M; }

export interface UseHoverRectOpts<M> {
  active: boolean;
  /** Return the matched element + payload, or null to ignore the target. */
  match: (target: EventTarget | null) => HoverMatch<M> | null;
  /** Called on a capture-phase click of a matched element (default-prevented + propagation-stopped). */
  onPick: (payload: M, e: MouseEvent) => void;
  /** On scroll/resize: reposition the box (default) or dismiss the hover (pick mode). */
  onScroll?: "reposition" | "dismiss";
  /** Optional label rendered on the box (highlight shows the token name; pick omits). */
  label?: (payload: M) => string | null;
}

/**
 * Shared hover-outline logic for the editor overlays: tracks the hovered element, exposes a fixed-position
 * box (with optional label), keeps it glued on scroll (imperative boxRef write — no React lag), and fires
 * onPick on a capture-phase click. Extracted from highlight-overlay so pick-overlay reuses it verbatim.
 */
export function useHoverRect<M>({ active, match, onPick, onScroll = "reposition", label }: UseHoverRectOpts<M>) {
  const [box, setBox] = useState<HoverBox | null>(null);
  const hovered = useRef<HoverMatch<M> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const reposition = () => {
      const c = hovered.current;
      if (!c) { setBox(null); return; }
      const r = c.el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height, label: label ? label(c.payload) : null });
    };
    const clear = () => { hovered.current = null; setBox(null); };
    const onMove = (e: PointerEvent) => {
      const m = match(e.target);
      if (!m) { clear(); return; }
      hovered.current = m;
      reposition();
    };
    const onScrollOrResize = () => {
      const c = hovered.current;
      if (!c) return;
      if (onScroll === "dismiss") { clear(); return; }
      const node = boxRef.current;
      if (!node) return;
      const r = c.el.getBoundingClientRect();
      node.style.top = `${r.top}px`;
      node.style.left = `${r.left}px`;
      node.style.width = `${r.width}px`;
      node.style.height = `${r.height}px`;
    };
    const onClick = (e: MouseEvent) => {
      const m = match(e.target);
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      onPick(m.payload, e);
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerleave", clear, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerleave", clear, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      hovered.current = null;
      setBox(null);
    };
  }, [active, match, onPick, onScroll, label]);

  return { box, boxRef };
}
```

- [ ] **Step 4: Refactor `highlight-overlay.tsx` onto the hook**

Replace the body of `components/editor/highlight-overlay.tsx` with:

```tsx
"use client";

import { useCallback } from "react";
import { useEditor } from "@/components/editor/editor-provider";
import { useHoverRect, type HoverMatch } from "@/lib/editor/use-hover-rect";

/**
 * In edit mode (and NOT pick mode), draws a thin outline over the hovered [data-token] element, tagged with
 * the token name; clicking selects that token. The hover/scroll mechanics live in useHoverRect (shared with
 * pick-overlay).
 */
export function HighlightOverlay() {
  const { enabled, pickMode, select } = useEditor();

  const match = useCallback((target: EventTarget | null): HoverMatch<string> | null => {
    if (!(target instanceof Element)) return null;
    const el = target.closest<HTMLElement>("[data-token]");
    const name = el?.getAttribute("data-token");
    return el && name ? { el, payload: name } : null;
  }, []);
  const onPick = useCallback((name: string) => select(name), [select]);
  const label = useCallback((name: string) => name, []);

  const { box, boxRef } = useHoverRect<string>({
    active: enabled && !pickMode,
    match,
    onPick,
    onScroll: "reposition",
    label,
  });

  if (!enabled || pickMode || !box) return null;

  return (
    <div
      ref={boxRef}
      className="ed-highlight"
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    >
      <span className="ed-highlight-label">{box.label}</span>
    </div>
  );
}
```

(This depends on `pickMode` from the provider — added in Task 3. To keep Task 2 self-contained, you may temporarily reference `enabled` only and add `pickMode` in Task 3; but since Task 3's provider change is small, do Task 3's provider edit first if `pickMode` doesn't yet exist. Simplest: do Task 3 Step "provider" before this refactor, then run both test suites together.)

- [ ] **Step 5: Run both suites → pass**
Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/use-hover-rect.test.tsx tests/editor/highlight-overlay.test.tsx`
Expected: PASS — the existing highlight tests (label content, no-box, clear-on-leave, pointerleave) pass unchanged.

- [ ] **Step 6: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/editor/use-hover-rect.ts components/editor/highlight-overlay.tsx tests/editor/use-hover-rect.test.tsx
git commit -m "refactor(editor): extract use-hover-rect; highlight-overlay uses it"
```

---

## Task 3: Provider `pickMode` + the DOM probe hook

**Files:**
- Modify: `components/editor/editor-provider.tsx` (add `pickMode`, `togglePickMode`; `disable()` clears it)
- Create: `lib/editor/use-probe-index.ts`
- Test: extend `tests/editor/editor-provider.test.tsx` (pickMode toggle + disable clears)

- [ ] **Step 1: Provider test (failing)**

Add to `tests/editor/editor-provider.test.tsx` (follow the file's existing render/act harness):

```tsx
it("pickMode toggles and is cleared by disable()", () => {
  // render the provider + a capture component exposing useEditor() (see existing tests' Capture pattern)
  act(() => api!.enable());
  expect(api!.pickMode).toBe(false);
  act(() => api!.togglePickMode());
  expect(api!.pickMode).toBe(true);
  act(() => api!.disable());
  expect(api!.pickMode).toBe(false);
});
```

- [ ] **Step 2: Run → fails** (`pickMode`/`togglePickMode` undefined).

- [ ] **Step 3: Edit the provider**

In `components/editor/editor-provider.tsx`:
1. Add to `EditorContextValue`: `pickMode: boolean;` and `togglePickMode: () => void;`.
2. Add state: `const [pickMode, setPickMode] = useState(false);`
3. Add `const togglePickMode = useCallback(() => setPickMode((p) => !p), []);`
4. Change `disable` to also clear pick: `const disable = useCallback(() => { setEnabled(false); setPickMode(false); }, []);`
5. Add `pickMode` + `togglePickMode` to the context `value` object AND to the `useMemo` dependency array.

- [ ] **Step 4: Run provider test → pass.**

- [ ] **Step 5: Create the probe hook**

Create `lib/editor/use-probe-index.ts`:

```ts
"use client";
import { useCallback } from "react";
import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import type { TokenGroup } from "@/lib/tokens/types";
import {
  GROUP_PROPERTY, GROUP_CANON_PROP, canonicalize,
  type TokenIndex, type ElementValue, type CssProperty,
} from "@/lib/editor/resolve-token";

const MANIFEST = designSystem as Manifest;

/** The probe's inline style property to SET = var(<token>), per group (radius is special — see below). */
const STYLE_PROP: Partial<Record<TokenGroup, "color" | "fontSize" | "fontFamily" | "boxShadow">> = {
  color: "color",
  fontSize: "fontSize",
  fontFamily: "fontFamily",
  shadow: "boxShadow",
};

const read = (el: Element, prop: string) => getComputedStyle(el).getPropertyValue(prop).trim();

/** border-radius: only meaningful when all four corners are equal (a single shorthand). */
function readBorderRadius(el: Element): string | null {
  const cs = getComputedStyle(el);
  const corners = [
    cs.borderTopLeftRadius, cs.borderTopRightRadius,
    cs.borderBottomRightRadius, cs.borderBottomLeftRadius,
  ].map((s) => s.trim());
  return corners.every((c) => c === corners[0]) ? corners[0] : null;
}

export function useProbeIndex() {
  // Built FRESH on each call (reads live var values; never memoized across edits/blocks — see spec §0).
  const buildIndex = useCallback((): TokenIndex => {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;width:0;height:0;opacity:0;overflow:hidden;pointer-events:none;";
    document.body.appendChild(probe);
    const index: TokenIndex = {};
    try {
      for (const t of MANIFEST.tokens) {
        const group = t.group;
        if (!(group in GROUP_PROPERTY)) continue;
        const canonProp = GROUP_CANON_PROP[group]!;
        if (group === "radius") {
          for (const util of t.utilities) {
            probe.className = util;
            const canon = canonicalize("border-radius", readBorderRadius(probe) ?? "");
            if (canon) (index.radius ??= []).push({ token: t.name, canonical: canon });
          }
          probe.className = "";
        } else {
          const styleProp = STYLE_PROP[group]!;
          // @ts-expect-error indexed style write
          probe.style[styleProp] = `var(${t.name})`;
          const canon = canonicalize(canonProp, read(probe, canonProp));
          if (canon) (index[group] ??= []).push({ token: t.name, canonical: canon });
          // @ts-expect-error reset
          probe.style[styleProp] = "";
        }
      }
    } finally {
      probe.remove();
    }
    return index;
  }, []);

  const readElementValues = useCallback((el: Element): ElementValue[] => {
    const out: ElementValue[] = [];
    for (const [group, props] of Object.entries(GROUP_PROPERTY)) {
      for (const prop of props as CssProperty[]) {
        const raw = prop === "border-radius" ? readBorderRadius(el) : read(el, prop);
        const canon = raw != null ? canonicalize(prop, raw) : null;
        if (canon) out.push({ property: prop, group: group as TokenGroup, canonical: canon });
      }
    }
    return out;
  }, []);

  return { buildIndex, readElementValues };
}
```

(No unit test for the hook — jsdom can't resolve `var()`/`calc()`/real serialization; it's covered by the e2e in Task 5. This is the honest unit/e2e boundary from the spec.)

- [ ] **Step 6: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add components/editor/editor-provider.tsx lib/editor/use-probe-index.ts tests/editor/editor-provider.test.tsx
git commit -m "feat(editor): provider pickMode sub-mode + DOM probe-index hook"
```

---

## Task 4: Pick overlay + menu + toolbar toggle + chrome CSS

**Files:**
- Create: `components/editor/pick-overlay.tsx`
- Create: `components/editor/pick-menu.tsx`
- Modify: `components/editor/editor-mount.tsx` (mount `<PickOverlay/>`)
- Modify: `components/editor/panel-toolbar.tsx` (eyedropper toggle)
- Modify: `components/editor/editor-chrome.css` (`.ed-pick-*`)

- [ ] **Step 1: Create the menu**

Create `components/editor/pick-menu.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Match } from "@/lib/editor/resolve-token";

const PROP_LABEL: Record<string, string> = {
  "background-color": "background",
  color: "text colour",
  "border-radius": "border radius",
  "font-size": "font size",
  "font-family": "font family",
  "box-shadow": "box shadow",
};

const PANEL_WIDTH = 312;

interface Row { property: string; token: string; value: string; isColor: boolean; }

export function PickMenu({
  anchor, matches, onPickToken, onClose,
}: {
  anchor: { x: number; y: number };
  matches: Match[];
  onPickToken: (token: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rows: Row[] = matches.flatMap((m) =>
    m.tokens.map((token) => ({
      property: m.property,
      token,
      value: m.value,
      isColor: m.property === "background-color" || m.property === "color",
    })),
  );

  // focus the first item on open
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  // clamp position to viewport (account for the docked panel); flip above if it would overflow bottom.
  const menuW = 240;
  const left = Math.min(anchor.x, window.innerWidth - PANEL_WIDTH - menuW - 8);
  const top = anchor.y;

  function onKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    // Escape handled by pick-overlay (layered exit).
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Tokens for this element"
      className="ed-pick-menu"
      style={{ top: Math.max(8, top), left: Math.max(8, left) }}
      onKeyDown={onKeyDown}
    >
      {rows.length === 0 ? (
        <p className="ed-pick-empty">No matching design token for this element</p>
      ) : (
        rows.map((r, i) => (
          <button
            key={`${r.property}-${r.token}-${i}`}
            type="button"
            role="menuitem"
            className="ed-pick-row"
            onClick={() => onPickToken(r.token)}
          >
            <span className="ed-pick-prop">{PROP_LABEL[r.property] ?? r.property}</span>
            {r.isColor && <span className="ed-reuse-swatch" style={{ background: r.value }} aria-hidden="true" />}
            <span className="ed-pick-token">{r.token}</span>
          </button>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the overlay**

Create `components/editor/pick-overlay.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor } from "@/components/editor/editor-provider";
import { useHoverRect, type HoverMatch } from "@/lib/editor/use-hover-rect";
import { useProbeIndex } from "@/lib/editor/use-probe-index";
import { resolveMatches, type Match } from "@/lib/editor/resolve-token";
import { PickMenu } from "@/components/editor/pick-menu";

/** Elements that are the editor's own chrome — never pickable. */
const CHROME = ".ed-panel, .ed-toggle, .ed-pick-menu, .ed-highlight, .ed-pick-highlight";

export function PickOverlay() {
  const { enabled, pickMode, select, togglePickMode } = useEditor();
  const active = enabled && pickMode;
  const { buildIndex, readElementValues } = useProbeIndex();
  const [popover, setPopover] = useState<{ anchor: { x: number; y: number }; matches: Match[] } | null>(null);

  const match = useCallback((target: EventTarget | null): HoverMatch<HTMLElement> | null => {
    if (!(target instanceof HTMLElement)) return null;
    if (target.closest(CHROME)) return null;
    return { el: target, payload: target };
  }, []);

  const onPick = useCallback(
    (el: HTMLElement, e: MouseEvent) => {
      const index = buildIndex();
      const matches = resolveMatches(readElementValues(el), index);
      setPopover({ anchor: { x: e.clientX, y: e.clientY }, matches });
    },
    [buildIndex, readElementValues],
  );

  // Hover highlight is suspended while the popover is open.
  const { box, boxRef } = useHoverRect<HTMLElement>({
    active: active && !popover,
    match,
    onPick,
    onScroll: "dismiss",
  });

  // Suppress native activation + focus-steal while picking (capture phase). Pick resolves on click (in the hook).
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const inChrome = (t: EventTarget | null) => t instanceof Element && !!t.closest(CHROME);
    const stopPointer = (e: Event) => { if (inChrome(e.target)) return; e.preventDefault(); e.stopPropagation(); };
    const stopKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { if (inChrome(e.target)) return; e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener("pointerdown", stopPointer, true);
    document.addEventListener("keydown", stopKey, true);
    return () => {
      document.removeEventListener("pointerdown", stopPointer, true);
      document.removeEventListener("keydown", stopKey, true);
    };
  }, [active]);

  // Layered Escape: close popover first, else exit pick mode.
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (popover) setPopover(null);
      else togglePickMode();
    };
    document.addEventListener("keydown", onEsc, true);
    return () => document.removeEventListener("keydown", onEsc, true);
  }, [active, popover, togglePickMode]);

  // Crosshair cursor while picking.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = active ? "crosshair" : "";
    return () => { document.body.style.cursor = ""; };
  }, [active]);

  const onPickToken = useCallback(
    (token: string) => {
      select(token);
      setPopover(null);
      togglePickMode(); // auto-exit so the next move doesn't re-arm over the element you're now previewing
    },
    [select, togglePickMode],
  );

  if (!active) return null;
  return (
    <>
      {box && !popover && (
        <div
          ref={boxRef}
          className="ed-pick-highlight"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      {popover && (
        <PickMenu
          anchor={popover.anchor}
          matches={popover.matches}
          onPickToken={onPickToken}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Mount the overlay** — in `components/editor/editor-mount.tsx`, import `PickOverlay` and render it beside `<HighlightOverlay />` inside `EditorShell`'s returned tree:

```tsx
import { PickOverlay } from "@/components/editor/pick-overlay";
// ...
      <EditToggle />
      <HighlightOverlay />
      <PickOverlay />
      <EditorPanel />
```

- [ ] **Step 4: Toolbar toggle** — in `components/editor/panel-toolbar.tsx`:
1. Import `Dropper`: `import { ChevronDown, Dropper, Moon01, Sun, X } from "@untitled-ui/icons-react";`
2. Pull `pickMode, togglePickMode` from `useEditor()`.
3. Add, as the first `.ed-iconbtn` in `.ed-toolbar-actions` (before the appearance button):

```tsx
<button
  type="button"
  className="ed-iconbtn"
  aria-label="Pick token from element"
  aria-pressed={pickMode}
  data-on={pickMode ? "" : undefined}
  title="Pick a token by clicking any element"
  onClick={togglePickMode}
>
  <Dropper aria-hidden="true" width={16} height={16} />
</button>
```

- [ ] **Step 5: Chrome CSS** — append to `components/editor/editor-chrome.css`:

```css
/* Pick-anywhere */
.ed-pick-highlight {
  position: fixed;
  z-index: 2147483646;
  pointer-events: none;
  border: 2px solid var(--ed-warn);
  border-radius: 3px;
  box-shadow: 0 0 0 1px var(--ed-panel);
}
.ed-iconbtn[data-on] {
  border-color: var(--ed-accent);
  background: var(--ed-accent-soft);
}
.ed-pick-menu {
  position: fixed;
  z-index: 2147483647;
  width: 240px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
  padding: 4px;
}
.ed-pick-row {
  all: unset;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 7px 9px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--ed-text);
}
.ed-pick-row:hover,
.ed-pick-row:focus-visible {
  background: var(--ed-field-hover);
  outline: none;
}
.ed-pick-prop {
  color: var(--ed-muted);
  min-width: 84px;
}
.ed-pick-token {
  font-family: ui-monospace, monospace;
  margin-left: auto;
}
.ed-pick-empty {
  margin: 0;
  padding: 10px;
  font-size: 12px;
  color: var(--ed-muted);
}
```

- [ ] **Step 6: Type/compile gate**
Run: `cd /Users/jason/Developer/vibe-design-system && npm run check`
Expected: PASS (chrome CSS excluded; no off-token classes added to app/components).

- [ ] **Step 7: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add components/editor/pick-overlay.tsx components/editor/pick-menu.tsx components/editor/editor-mount.tsx components/editor/panel-toolbar.tsx components/editor/editor-chrome.css
git commit -m "feat(editor): pick-anywhere overlay + menu + eyedropper toggle + chrome"
```

---

## Task 5: e2e fidelity gate + full verify + visual checkpoint

**Files:**
- Create: `e2e/pick-anywhere.spec.ts`

- [ ] **Step 1: e2e spec**

Create `e2e/pick-anywhere.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GLOBALS = resolve("app/globals.css");

async function enterPick(page: import("@playwright/test").Page) {
  await page.goto("/design-system");
  await page.getByRole("button", { name: /edit/i }).click();
  await page.getByRole("button", { name: /pick token from element/i }).click();
}

test.describe("pick-anywhere", () => {
  test("pick a button → menu lists --primary → row opens it in the panel + pick exits", async ({ page }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await enterPick(page);
      // a real showcase button (bg-primary). Force-click: pick mode suppresses native activation.
      await page.getByRole("button", { name: "Default" }).first().click({ force: true });
      const menu = page.getByRole("menu", { name: /tokens for this element/i });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: /--primary\b/ })).toBeVisible();
      await menu.getByRole("menuitem", { name: /--primary\b/ }).first().click();
      // panel now shows --primary controls; eyedropper toggle is no longer pressed.
      await expect(page.getByRole("button", { name: /pick token from element/i })).toHaveAttribute(
        "aria-pressed", "false",
      );
    } finally {
      writeFileSync(GLOBALS, before, "utf8");
    }
  });

  test("Escape exits pick mode; empty state on a transparent wrapper", async ({ page }) => {
    await enterPick(page);
    // a plain layout div with transparent bg + no token-backed size → no match.
    await page.locator("main").click({ position: { x: 2, y: 2 }, force: true });
    await expect(page.getByText(/no matching design token/i)).toBeVisible();
    await page.keyboard.press("Escape"); // close popover
    await page.keyboard.press("Escape"); // exit pick mode
    await expect(page.getByRole("button", { name: /pick token from element/i })).toHaveAttribute(
      "aria-pressed", "false",
    );
  });
});
```

(If `main` resolves to a token-backed element, target a known transparent wrapper instead — inspect the page during the run and adjust the selector; the point is an element with no token-backed bg/text/size.)

- [ ] **Step 2: Run e2e**
Run: `cd /Users/jason/Developer/vibe-design-system && npx playwright test e2e/pick-anywhere.spec.ts`
Expected: PASS. Debug resolution with `--headed` if a match is missing (most likely cause: a probed value not canonicalizing equal — verify against `canonicalize`).

- [ ] **Step 3: Full suite + the merge gate**
Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run && npm run verify`
Expected: all PASS (`verify` = check && test && lint && build).

- [ ] **Step 4: Full e2e**
Run: `cd /Users/jason/Developer/vibe-design-system && npx playwright test`
Expected: PASS (existing 16 + new).

- [ ] **Step 5: Visual checkpoint**
Throwaway shot spec into `e2e/__shots__/pick.shot.spec.ts` (gitignored; rename to `.spec.ts` so Playwright matches it): enter pick mode, screenshot (a) the `--ed-warn` crosshair highlight over a button, (b) the popover/collision list with swatches over a Card. Snapshot/restore `app/globals.css` in before/afterEach (the editor writes on a real pick→edit). `Read` the PNGs; self-critique vs `docs/DESIGN-BRIEF.md` (highlight legibility, menu density, swatch clarity, focus ring).

- [ ] **Step 6: HUMAN CHECKPOINT** — present screenshots; do NOT declare done until the user approves the aesthetic.

---

## Done criteria
- `npm run verify` green; `npx playwright test` green.
- Eyedropper toggle enters pick mode (crosshair, `--ed-warn` highlight, normal hover suspended); clicking any element lists its token(s) by property; collisions list all; row opens the token in the panel; pick auto-exits; Escape layered-exits; native actions suppressed.
- User approved the screenshots.
- Update `docs/HANDOFF.md`: mark pick-anywhere ✅ DONE (2026-06-22) in the M4 fast-follows; bump the test count; note the documented nested-child limitation. Commit. Then `superpowers:finishing-a-development-branch` (merge `--no-ff`, delete branch).
```
