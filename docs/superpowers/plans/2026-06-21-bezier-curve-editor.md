# Bezier Curve Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
> **PROJECT OVERRIDE (HANDOFF.md):** Execute **in-session** (TDD, commit per task) — NOT via subagents. Review subagents share the repo working tree and a `git checkout` orphans commits (see memory `subagent-shared-tree-checkout-hazard`).

**Goal:** Replace the easing token control (preset `<select>` + cubic-bezier text input) with a draggable SVG cubic-bezier curve editor.

**Architecture:** A pure, unit-tested `lib/editor/bezier.ts` (parse/format/clamp/keyword-map + SVG⇄curve coordinate helpers) feeds a thin SVG view in the rewritten `components/editor/controls/easing-field.tsx`. Drag uses a transient buffer committed once on `pointerup` (one history entry, no preview strobe); numeric inputs and preset chips are discrete commits. Same `EasingField`/kind `easing`/props — `control-host.tsx`/`control-map.ts` untouched. Single emit funnel: `formatBezier(cubic) → onChange`.

**Tech Stack:** TypeScript, React 19, SVG pointer events (`setPointerCapture`), Vitest + Testing Library (jsdom), existing `useDraftField`, `--ed-*` editor-chrome CSS.

**Spec:** [docs/superpowers/specs/2026-06-21-bezier-curve-editor-design.md](../specs/2026-06-21-bezier-curve-editor-design.md)

**Conventions (read first):**
- `.test.tsx` files need a top docblock `// @vitest-environment jsdom`; `.test.ts` run in node.
- The `@` alias resolves via `vitest.config.ts`.
- TDD per @superpowers:test-driven-development. Commit per task.
- Pre-commit runs `npm run check`. Before merge: `npm run verify` (= check && test && lint && build) per memory `run-next-build-before-merge`.

---

## Task 1: Pure bezier lib (`lib/editor/bezier.ts`)

**Files:**
- Create: `lib/editor/bezier.ts`
- Test: `tests/editor/bezier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/editor/bezier.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseBezier, formatBezier, clampX, clampY, toSvg, fromSvg,
  Y_MIN, Y_MAX, GEOM_DEFAULT, type Cubic,
} from "@/lib/editor/bezier";

describe("parseBezier", () => {
  it("maps each CSS keyword to its exact spec curve", () => {
    expect(parseBezier("linear")).toEqual([0, 0, 1, 1]);
    expect(parseBezier("ease")).toEqual([0.25, 0.1, 0.25, 1]);
    expect(parseBezier("ease-in")).toEqual([0.42, 0, 1, 1]);
    expect(parseBezier("ease-out")).toEqual([0, 0, 0.58, 1]);
    expect(parseBezier("ease-in-out")).toEqual([0.42, 0, 0.58, 1]);
  });
  it("parses cubic-bezier with arbitrary whitespace and negative/overshoot values", () => {
    expect(parseBezier("cubic-bezier(0.2, 0, 0, 1)")).toEqual([0.2, 0, 0, 1]);
    expect(parseBezier("  cubic-bezier(0.68,-0.55,0.27,1.55)  ")).toEqual([0.68, -0.55, 0.27, 1.55]);
  });
  it("returns null for steps(), var(), and garbage", () => {
    expect(parseBezier("steps(4, end)")).toBeNull();
    expect(parseBezier("var(--ease-in)")).toBeNull();
    expect(parseBezier("nonsense")).toBeNull();
    expect(parseBezier("cubic-bezier(1, 2, 3)")).toBeNull();
  });
});

describe("formatBezier", () => {
  it("rounds to 2dp numerically (drops trailing zeros, not toFixed)", () => {
    expect(formatBezier([0.2, 0, 0, 1])).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(formatBezier([0.123456, 0.1, 0.999, 1])).toBe("cubic-bezier(0.12, 0.1, 1, 1)");
  });
  it("clamps x defensively into [0,1] on output", () => {
    expect(formatBezier([1.4, 0, -0.3, 1])).toBe("cubic-bezier(1, 0, 0, 1)");
  });
  it("round-trips: parseBezier(formatBezier(c)) === c for normalised c", () => {
    const c: Cubic = [0.2, -0.5, 0.8, 1.5];
    expect(parseBezier(formatBezier(c))).toEqual(c);
  });
  it("the --ease-standard value formats back to its exact globals string (no 0.2->0.20 drift)", () => {
    expect(formatBezier(parseBezier("cubic-bezier(0.2, 0, 0, 1)")!)).toBe("cubic-bezier(0.2, 0, 0, 1)");
  });
});

describe("clamp", () => {
  it("clampX to [0,1], clampY to [Y_MIN,Y_MAX]", () => {
    expect(clampX(-1)).toBe(0);
    expect(clampX(2)).toBe(1);
    expect(clampX(0.5)).toBe(0.5);
    expect(clampY(-99)).toBe(Y_MIN);
    expect(clampY(99)).toBe(Y_MAX);
  });
});

describe("toSvg / fromSvg (coordinate mapping)", () => {
  const g = GEOM_DEFAULT; // {width:240,height:300,padX:24,padTop:90,padBottom:90}
  it("maps anchors to the canvas corners (y flipped: y=0 bottom band, y=1 top band)", () => {
    const s = toSvg([0, 0, 1, 1], g);
    expect(s.p1).toEqual({ sx: 24, sy: 210 });   // x=0 -> padX; y=0 -> height-padBottom
    expect(s.p2).toEqual({ sx: 216, sy: 90 });   // x=1 -> width-padX; y=1 -> padTop
  });
  it("fromSvg inverts toSvg within the [0,1] band", () => {
    const r = fromSvg(24, 210, g);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
  });
  it("fromSvg always clamps x into [0,1] (the value validator won't catch a regression)", () => {
    expect(fromSvg(-500, 150, g).x).toBe(0);
    expect(fromSvg(99999, 150, g).x).toBe(1);
  });
  it("maps the overshoot region (top edge -> Y_MAX, bottom edge -> Y_MIN)", () => {
    expect(fromSvg(120, 0, g).y).toBeCloseTo(Y_MAX);
    expect(fromSvg(120, 300, g).y).toBeCloseTo(Y_MIN);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/bezier.test.ts`
Expected: FAIL — cannot resolve `@/lib/editor/bezier`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/editor/bezier.ts`:

```ts
/** Pure cubic-bezier helpers for the easing curve editor. No React, no DOM. */

export type Cubic = [number, number, number, number]; // [x1, y1, x2, y2]

/** Vertical overshoot range the canvas/handles allow (CSS y is unbounded; this is a UI limit). */
export const Y_MIN = -0.75;
export const Y_MAX = 1.75;

/** SVG viewBox geometry. The [0,1] progress band occupies the middle; overshoot rooms top+bottom. */
export interface Geom {
  width: number;
  height: number;
  padX: number;
  padTop: number;    // y=1 maps here
  padBottom: number; // y=0 maps to height - padBottom
}
export const GEOM_DEFAULT: Geom = { width: 240, height: 300, padX: 24, padTop: 90, padBottom: 90 };

const KEYWORDS: Record<string, Cubic> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const clampX = (n: number) => clamp(n, 0, 1);
export const clampY = (n: number) => clamp(n, Y_MIN, Y_MAX);

const CB = /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;

export function parseBezier(value: string): Cubic | null {
  const v = value.trim();
  if (v in KEYWORDS) return [...KEYWORDS[v]] as Cubic;
  const m = CB.exec(v);
  if (!m) return null;
  const nums = [m[1], m[2], m[3], m[4]].map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return nums as Cubic;
}

export function formatBezier(c: Cubic): string {
  const [x1, y1, x2, y2] = c;
  return `cubic-bezier(${round2(clampX(x1))}, ${round2(y1)}, ${round2(clampX(x2))}, ${round2(y2)})`;
}

const xToSvg = (x: number, g: Geom) => g.padX + (g.width - 2 * g.padX) * x;
const yToSvg = (y: number, g: Geom) => {
  const y0 = g.height - g.padBottom; // y=0
  const y1 = g.padTop;               // y=1
  return y0 + (y1 - y0) * y;
};
const svgToX = (sx: number, g: Geom) => (sx - g.padX) / (g.width - 2 * g.padX);
const svgToY = (sy: number, g: Geom) => {
  const y0 = g.height - g.padBottom;
  const y1 = g.padTop;
  return (sy - y0) / (y1 - y0);
};

export interface SvgPoints {
  anchorStart: { sx: number; sy: number };
  anchorEnd: { sx: number; sy: number };
  p1: { sx: number; sy: number };
  p2: { sx: number; sy: number };
}
export function toSvg(c: Cubic, g: Geom): SvgPoints {
  const [x1, y1, x2, y2] = c;
  return {
    anchorStart: { sx: xToSvg(0, g), sy: yToSvg(0, g) },
    anchorEnd: { sx: xToSvg(1, g), sy: yToSvg(1, g) },
    p1: { sx: xToSvg(x1, g), sy: yToSvg(y1, g) },
    p2: { sx: xToSvg(x2, g), sy: yToSvg(y2, g) },
  };
}
export function fromSvg(sx: number, sy: number, g: Geom): { x: number; y: number } {
  return { x: clampX(svgToX(sx, g)), y: clampY(svgToY(sy, g)) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/bezier.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/editor/bezier.ts tests/editor/bezier.test.ts
git commit -m "feat(editor): pure cubic-bezier lib (parse/format/clamp + svg coords)"
```

---

## Task 2: Rewrite the easing control as the curve editor

**Files:**
- Modify (full rewrite): `components/editor/controls/easing-field.tsx`
- Modify (full rewrite): `tests/editor/easing-field.test.tsx`

The control keeps the export name `EasingField` and its props `{ token, value, onChange, tokens }` — `control-host.tsx` and `control-map.ts` are NOT touched.

- [ ] **Step 1: Write the failing test**

Replace the contents of `tests/editor/easing-field.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EasingField } from "@/components/editor/controls/easing-field";
import { GEOM_DEFAULT, parseBezier } from "@/lib/editor/bezier";

afterEach(cleanup);

const TOKENS = [
  { name: "--ease-standard", group: "easing" as const, values: { light: "cubic-bezier(0.2, 0, 0, 1)" }, utilities: [] },
  { name: "--ease-in", group: "easing" as const, values: { light: "cubic-bezier(0.4, 0, 1, 1)" }, utilities: [] },
  { name: "--ease-out", group: "easing" as const, values: { light: "cubic-bezier(0, 0, 0.2, 1)" }, utilities: [] },
];

// jsdom has no layout: stub the SVG rect to the viewBox so client->viewBox mapping is identity.
beforeEach(() => {
  Object.defineProperty(SVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: GEOM_DEFAULT.width, height: GEOM_DEFAULT.height, right: GEOM_DEFAULT.width, bottom: GEOM_DEFAULT.height, x: 0, y: 0, toJSON() {} }),
  });
  // jsdom doesn't implement pointer capture
  if (!(Element.prototype as unknown as { setPointerCapture?: unknown }).setPointerCapture) {
    (Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
    (Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
  }
});

function setup(value = "cubic-bezier(0.2, 0, 0, 1)") {
  const onChange = vi.fn();
  render(<EasingField token="--ease-standard" value={value} onChange={onChange} tokens={TOKENS} />);
  return { onChange };
}

describe("EasingField (curve editor)", () => {
  it("renders the canvas, two handles, four numeric inputs, presets, and the raw row", () => {
    setup();
    expect(screen.getByRole("img", { name: /easing curve/i })).toBeTruthy(); // svg role=img
    expect(screen.getAllByRole("spinbutton").length).toBe(4);                 // 4 number inputs
    expect(screen.getByLabelText(/--ease-standard raw value/i)).toBeTruthy(); // raw text row
    expect(screen.getByRole("button", { name: /ease-in-out/i })).toBeTruthy(); // a preset chip
  });

  it("dragging a handle emits exactly one onChange (a normalised cubic-bezier) on pointer-up, nothing mid-move", () => {
    const { onChange } = setup();
    const p1 = screen.getByTestId("ed-bezier-handle-1");
    fireEvent.pointerDown(p1, { pointerId: 1, clientX: 24, clientY: 210 });
    fireEvent.pointerMove(p1, { pointerId: 1, clientX: 120, clientY: 90 }); // -> x≈0.5, y≈1
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(p1, { pointerId: 1, clientX: 120, clientY: 90 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^cubic-bezier\(0\.5, 1, 0, 1\)$/);
  });

  it("drag clamps x into [0,1] even when dragged past the canvas edge", () => {
    const { onChange } = setup();
    const p2 = screen.getByTestId("ed-bezier-handle-2");
    fireEvent.pointerDown(p2, { pointerId: 1, clientX: 216, clientY: 90 });
    fireEvent.pointerMove(p2, { pointerId: 1, clientX: 99999, clientY: 90 });
    fireEvent.pointerUp(p2, { pointerId: 1, clientX: 99999, clientY: 90 });
    // Parse the emitted curve back to a tuple (don't number-extract the string —
    // "cubic-bezier" contains a hyphen that pollutes a naive /[-\d.]+/ match).
    const [x1, , x2] = parseBezier(onChange.mock.calls[0][0])!;
    expect(x1).toBeGreaterThanOrEqual(0);
    expect(x2).toBeLessThanOrEqual(1);
  });

  it("numeric input does not emit while typing; commits a merged curve on blur", () => {
    const { onChange } = setup();
    const startX = screen.getByLabelText(/--ease-standard start x/i) as HTMLInputElement;
    fireEvent.change(startX, { target: { value: "0.5" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(startX);
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.5, 0, 0, 1)");
  });

  it("rejects an out-of-range numeric x on blur", () => {
    const { onChange } = setup();
    const startX = screen.getByLabelText(/--ease-standard start x/i) as HTMLInputElement;
    fireEvent.change(startX, { target: { value: "5" } });
    fireEvent.blur(startX);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking a preset chip emits the converted cubic-bezier", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^ease-in-out$/i }));
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.42, 0, 0.58, 1)");
  });

  it("a steps()/var() value renders the raw string and emits NOTHING on mount", () => {
    const { onChange } = setup("steps(4, end)");
    expect((screen.getByLabelText(/--ease-standard raw value/i) as HTMLInputElement).value).toBe("steps(4, end)");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the raw row commits a valid value on Enter and rejects an invalid one", () => {
    const { onChange } = setup("steps(4, end)");
    const raw = screen.getByLabelText(/--ease-standard raw value/i) as HTMLInputElement;
    fireEvent.change(raw, { target: { value: "garbage" } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(raw, { target: { value: "var(--ease-in)" } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("var(--ease-in)");
  });

  it("re-seeds inputs when the external value changes (block-switch/undo)", () => {
    const onChange = vi.fn();
    const { rerender } = render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={TOKENS} />);
    const startX = screen.getByLabelText(/--ease-standard start x/i) as HTMLInputElement;
    expect(startX.value).toBe("0.2");
    rerender(<EasingField token="--ease-standard" value="cubic-bezier(0.4, 0, 1, 1)" onChange={onChange} tokens={TOKENS} />);
    expect(startX.value).toBe("0.4");
  });

  it("handles are aria-hidden (numeric inputs are the keyboard path)", () => {
    setup();
    expect(screen.getByTestId("ed-bezier-handle-1").getAttribute("aria-hidden")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/easing-field.test.tsx`
Expected: FAIL — the rewritten component doesn't exist yet (old one has a `<select>`, not handles/spinbuttons).

- [ ] **Step 3: Write the implementation**

Replace the contents of `components/editor/controls/easing-field.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import { useDraftField } from "@/lib/editor/use-draft-field";
import {
  type Cubic,
  parseBezier,
  formatBezier,
  clampX,
  clampY,
  toSvg,
  fromSvg,
  Y_MIN,
  Y_MAX,
  GEOM_DEFAULT as G,
} from "@/lib/editor/bezier";

interface EasingFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
  tokens: ManifestToken[];
}

const KEYWORDS = ["ease", "ease-in", "ease-out", "ease-in-out", "linear"];
// Raw escape-hatch validator: cubic-bezier | keyword | steps() | var().
const RAW_VALID =
  /^(cubic-bezier\(.+\)|linear|ease|ease-in|ease-out|ease-in-out|steps\(.+\)|var\(.+\))$/;
const DEFAULT_CURVE: Cubic = [0.25, 0.1, 0.25, 1]; // `ease`, last-resort fallback

function tokenValue(t: ManifestToken): string {
  return t.values.light ?? t.values.dark ?? "";
}

/** One numeric axis input (start/end × x/y) wired through useDraftField (commit on blur/Enter). */
function AxisInput({
  token,
  label,
  axisName,
  value,
  min,
  max,
  onCommit,
}: {
  token: string;
  label: string;
  axisName: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const field = useDraftField(
    String(value),
    (draft) => onCommit(Number(draft)),
    (draft) => {
      const n = Number(draft);
      return draft.trim() !== "" && Number.isFinite(n) && n >= min && n <= max;
    },
  );
  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {label}
      </span>
      <input
        type="number"
        step="0.01"
        aria-label={`${token} ${axisName}`}
        value={field.draft}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
    </div>
  );
}

/**
 * Draggable cubic-bezier curve editor for easing tokens. SVG canvas with two draggable handles
 * (committed once on pointer-up — one history entry, no preview strobe), four numeric x/y inputs
 * (commit on blur/Enter — the keyboard/a11y path), preset chips (token curves + CSS keywords),
 * an animated preview, and a raw-value escape-hatch row for steps()/var()/paste.
 *
 * The curve is derived from `value` each render; the only local state is a transient drag buffer.
 * Always emits a normalised `cubic-bezier(...)` (keywords are converted). Never emits on mount.
 */
export function EasingField({ token, value, onChange, tokens }: EasingFieldProps) {
  const parsed = parseBezier(value);
  const fallback =
    parseBezier(
      tokenValue(tokens.find((t) => t.name === "--ease-standard") ?? ({} as ManifestToken)) || "",
    ) ?? DEFAULT_CURVE;
  const [drag, setDrag] = useState<Cubic | null>(null);
  const display: Cubic = drag ?? parsed ?? fallback;
  const drawable = drag !== null || parsed !== null;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Cubic | null>(null);
  const activeHandle = useRef<1 | 2 | null>(null);

  function clientToCurve(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * G.width;
    const sy = ((e.clientY - rect.top) / rect.height) * G.height;
    return fromSvg(sx, sy, G);
  }

  function onHandleDown(handle: 1 | 2, e: React.PointerEvent) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activeHandle.current = handle;
    dragRef.current = display;
    setDrag(display);
  }
  function onHandleMove(e: React.PointerEvent) {
    if (activeHandle.current === null) return;
    const { x, y } = clientToCurve(e);
    const base = dragRef.current ?? display;
    const next: Cubic = [...base];
    if (activeHandle.current === 1) {
      next[0] = x;
      next[1] = y;
    } else {
      next[2] = x;
      next[3] = y;
    }
    dragRef.current = next;
    setDrag(next);
  }
  function onHandleUp(e: React.PointerEvent) {
    if (activeHandle.current === null) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    activeHandle.current = null;
    const final = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (final) onChange(formatBezier(final));
  }

  function commitAxis(index: 0 | 1 | 2 | 3, n: number) {
    const next: Cubic = [...display];
    next[index] = index === 0 || index === 2 ? clampX(n) : clampY(n);
    onChange(formatBezier(next));
  }

  // Preset chips: token curves + CSS keywords, deduped by normalised value.
  const seen = new Set<string>();
  const presets: { label: string; value: string }[] = [];
  for (const k of KEYWORDS) presets.push({ label: k, value: k });
  for (const t of tokens.filter((t) => t.group === "easing")) {
    const v = tokenValue(t);
    if (v) presets.push({ label: t.name.replace(/^--ease-?/, "") || t.name, value: v });
  }
  const dedupedPresets = presets.filter((p) => {
    const c = parseBezier(p.value);
    const key = c ? formatBezier(c) : p.value;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  function applyPreset(v: string) {
    const c = parseBezier(v);
    if (c) onChange(formatBezier(c));
  }

  // Preview: animation timing = committed curve; replay on commit (value change) + button.
  const previewEase = parsed ? formatBezier(parsed) : "linear";
  const [replay, setReplay] = useState(0);

  const pts = toSvg(display, G);
  const path = `M${pts.anchorStart.sx},${pts.anchorStart.sy} C${pts.p1.sx},${pts.p1.sy} ${pts.p2.sx},${pts.p2.sy} ${pts.anchorEnd.sx},${pts.anchorEnd.sy}`;
  const bandTop = G.padTop;
  const bandH = G.height - G.padTop - G.padBottom;

  const rawField = useDraftField(value, (draft) => onChange(draft.trim()), (d) =>
    RAW_VALID.test(d.trim()),
  );

  return (
    <div className="ed-bezier">
      <p className="ed-bezier-legend ed-label">X = time → · Y = progress ↑ · past 0–1 = overshoot</p>

      <svg
        ref={svgRef}
        className={`ed-bezier-canvas${drawable ? "" : " ed-bezier-canvas--fallback"}`}
        viewBox={`0 0 ${G.width} ${G.height}`}
        width={G.width}
        height={G.height}
        role="img"
        aria-label={`${token} easing curve`}
      >
        {/* [0,1] progress reference band */}
        <rect x={G.padX} y={bandTop} width={G.width - 2 * G.padX} height={bandH} className="ed-bezier-band" />
        {/* control arms */}
        <line x1={pts.anchorStart.sx} y1={pts.anchorStart.sy} x2={pts.p1.sx} y2={pts.p1.sy} className="ed-bezier-arm" />
        <line x1={pts.anchorEnd.sx} y1={pts.anchorEnd.sy} x2={pts.p2.sx} y2={pts.p2.sy} className="ed-bezier-arm" />
        {/* the curve */}
        <path d={path} className="ed-bezier-path" fill="none" />
        {/* anchors */}
        <circle cx={pts.anchorStart.sx} cy={pts.anchorStart.sy} r={4} className="ed-bezier-anchor" />
        <circle cx={pts.anchorEnd.sx} cy={pts.anchorEnd.sy} r={4} className="ed-bezier-anchor" />
        {/* draggable handles (pointer-only; numeric inputs are the keyboard path) */}
        <circle
          data-testid="ed-bezier-handle-1"
          aria-hidden="true"
          cx={pts.p1.sx}
          cy={pts.p1.sy}
          r={8}
          className="ed-bezier-handle"
          onPointerDown={(e) => onHandleDown(1, e)}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        />
        <circle
          data-testid="ed-bezier-handle-2"
          aria-hidden="true"
          cx={pts.p2.sx}
          cy={pts.p2.sy}
          r={8}
          className="ed-bezier-handle"
          onPointerDown={(e) => onHandleDown(2, e)}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        />
      </svg>

      {!drawable && (
        <p className="ed-bezier-note ed-label">Not a curve — drag or pick a preset to convert.</p>
      )}

      <div className="ed-bezier-inputs">
        <AxisInput token={token} label="start x" axisName="start x" value={display[0]} min={0} max={1} onCommit={(n) => commitAxis(0, n)} />
        <AxisInput token={token} label="start y" axisName="start y" value={display[1]} min={Y_MIN} max={Y_MAX} onCommit={(n) => commitAxis(1, n)} />
        <AxisInput token={token} label="end x" axisName="end x" value={display[2]} min={0} max={1} onCommit={(n) => commitAxis(2, n)} />
        <AxisInput token={token} label="end y" axisName="end y" value={display[3]} min={Y_MIN} max={Y_MAX} onCommit={(n) => commitAxis(3, n)} />
      </div>

      <div className="ed-reuse">
        <span className="ed-label" aria-hidden="true">
          presets
        </span>
        <div className="ed-reuse-strip">
          {dedupedPresets.map((p) => (
            <button key={p.label} type="button" className="ed-bezier-preset" onClick={() => applyPreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ed-bezier-preview-row">
        <div key={`${previewEase}-${replay}`} className="ed-bezier-preview" style={{ ["--ed-bezier-ease" as string]: previewEase }}>
          <span className="ed-bezier-dot" />
        </div>
        <button type="button" className="ed-bezier-preset" onClick={() => setReplay((r) => r + 1)}>
          replay
        </button>
      </div>

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          raw
        </span>
        <input
          type="text"
          aria-label={`${token} raw value`}
          placeholder="cubic-bezier() / steps() / var()"
          value={rawField.draft}
          onChange={rawField.onChange}
          onBlur={rawField.onBlur}
          onKeyDown={rawField.onKeyDown}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/easing-field.test.tsx`
Expected: PASS (all cases). If the drag test's emitted string differs, check the rect stub + `clientToCurve` math (client→viewBox identity since rect == viewBox).

- [ ] **Step 5: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add components/editor/controls/easing-field.tsx tests/editor/easing-field.test.tsx
git commit -m "feat(editor): draggable cubic-bezier curve editor (replaces easing select+text)"
```

---

## Task 3: Editor-chrome styles (`.ed-bezier-*`)

**Files:**
- Modify: `components/editor/editor-chrome.css` (append a `.ed-bezier-*` block)

No unit test (CSS); verified by `next build` (Task 4) + the screenshot checkpoint. `editor-chrome.css` is excluded from `npm run check`, so `cubic-bezier()`/`calc()`/hex are allowed here.

- [ ] **Step 1: Append the styles**

Add to the end of `components/editor/editor-chrome.css`:

```css
/* Bezier curve editor (easing control) */
.ed-bezier {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ed-bezier-legend {
  margin: 0;
}
.ed-bezier-canvas {
  width: 100%;
  height: auto;
  background: var(--ed-field);
  border: 1px solid var(--ed-border);
  border-radius: 8px;
  touch-action: none; /* let pointer drag own the gesture */
}
.ed-bezier-canvas--fallback {
  opacity: 0.5;
}
.ed-bezier-band {
  fill: var(--ed-panel-raised);
  stroke: var(--ed-border);
  stroke-dasharray: 3 3;
}
.ed-bezier-arm {
  stroke: var(--ed-muted);
  stroke-width: 1.5;
}
.ed-bezier-path {
  stroke: var(--ed-accent);
  stroke-width: 2.5;
}
.ed-bezier-anchor {
  fill: var(--ed-muted);
}
.ed-bezier-handle {
  fill: var(--ed-accent);
  stroke: var(--ed-panel);
  stroke-width: 2;
  cursor: grab;
}
.ed-bezier-handle:active {
  cursor: grabbing;
}
.ed-bezier-note {
  margin: 0;
  color: var(--ed-warn);
}
.ed-bezier-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
/* restore a focus ring (.ed-row input is all:unset) for keyboard users */
.ed-bezier .ed-row input:focus-visible {
  outline: 2px solid var(--ed-accent);
  outline-offset: 1px;
  border-radius: 3px;
}
.ed-bezier-preset {
  all: unset;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--ed-border);
  background: var(--ed-field);
  color: var(--ed-text);
  font-size: 11px;
  cursor: pointer;
}
.ed-bezier-preset:hover {
  background: var(--ed-field-hover);
  border-color: var(--ed-accent);
}
.ed-bezier-preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ed-bezier-preview {
  position: relative;
  flex: 1;
  height: 20px;
  border-radius: 6px;
  background: var(--ed-field);
  border: 1px solid var(--ed-border);
  overflow: hidden;
}
.ed-bezier-dot {
  position: absolute;
  top: 4px;
  left: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ed-accent);
  animation: ed-bezier-run 1.2s var(--ed-bezier-ease, linear) infinite alternate;
}
@keyframes ed-bezier-run {
  from {
    left: 6px;
  }
  to {
    left: calc(100% - 16px);
  }
}
```

- [ ] **Step 2: Verify the build compiles the CSS**

Run: `cd /Users/jason/Developer/vibe-design-system && npm run check`
Expected: PASS (editor-chrome.css is excluded; this confirms no accidental change elsewhere).

- [ ] **Step 3: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add components/editor/editor-chrome.css
git commit -m "style(editor): bezier curve editor chrome (--ed-bezier-*)"
```

---

## Task 4: Full verification + visual checkpoint

**Files:** none (verification only); a throwaway shot spec under `e2e/__shots__/` (gitignored).

- [ ] **Step 1: control-host still resolves the easing case**

Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run tests/editor/control-host.test.tsx`
Expected: PASS unchanged — the rewritten control renders `spinbutton`/`textbox` inputs, satisfying the "real editable control" assertion. If it fails on a removed `<select>` assertion, update only that assertion.

- [ ] **Step 2: Full suite**

Run: `cd /Users/jason/Developer/vibe-design-system && npx vitest run`
Expected: PASS (all editor + token suites).

- [ ] **Step 3: The non-negotiable merge gate**

Run: `cd /Users/jason/Developer/vibe-design-system && npm run verify`
Expected: `check && test && lint && build` all PASS. (`next build` is the only step that type-checks the app graph + compiles Tailwind — per memory `run-next-build-before-merge`.)

- [ ] **Step 4: e2e (token-tag invariants unaffected, but confirm)**

Run: `cd /Users/jason/Developer/vibe-design-system && npx playwright test`
Expected: PASS.

- [ ] **Step 5: Visual checkpoint**

Write a throwaway Playwright spec into `e2e/__shots__/bezier.shot.ts` (gitignored) that opens `/design-system`, enables the editor, selects an easing token (e.g. `--ease-standard`), and screenshots the panel — resting, and (if feasible) mid-drag. `Read` the PNGs; self-critique against `docs/DESIGN-BRIEF.md` (curve legibility, handle affordance, overshoot band clarity, preview readability, focus rings). Iterate on Task 3 CSS if needed.

- [ ] **Step 6: HUMAN CHECKPOINT**

Present the screenshots to the user. Do NOT declare done until the user approves the aesthetic (function is TDD'd; aesthetic is human-checkpointed — HANDOFF convention).

---

## Done criteria
- `npm run verify` green; `npx playwright test` green.
- Easing tokens edit via drag / numeric / preset / raw row; drag = one undo entry; emits normalised `cubic-bezier()`; `steps()`/`var()` survive (raw row), never clobbered on mount.
- User has approved the screenshots.
- Update `docs/HANDOFF.md` M4 fast-follows: mark the bezier curve editor ✅ DONE (2026-06-21), note the dark-block-easing-write limitation as documented/deferred. Commit. Then `superpowers:finishing-a-development-branch` (merge `--no-ff`, delete branch).
```
