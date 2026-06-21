# F6 slip-throughs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gate's off-token blind spots — text/placeholder palette, arbitrary radius/border/ring widths, CSS named colors (bracket + inline), and variant-prefixed (`md:`/`hover:`/`dark:`) classes that bypass every rule.

**Architecture:** Extend the existing `lib/check/` checks (no new check-family). One new data module `css-colors.ts` (shared CSS-named-color vocabulary). `checkArbitrary` gains a bracket-aware variant-stripper (`baseUtil`) applied at the loop boundary — match on the base utility, report the original class. `checkHardcodedColor` gains an inline color-keyword pass. All reuse existing rules/messages.

**Tech Stack:** TypeScript, Vitest, the `lib/check/` harness.

**Spec:** [docs/superpowers/specs/2026-06-21-f6-slip-throughs-design.md](../specs/2026-06-21-f6-slip-throughs-design.md)

**Branch:** `f6-slip-throughs` (already created).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `lib/check/css-colors.ts` | CSS named-color vocabulary + `has()` | Create |
| `lib/check/arbitrary-tailwind.ts` | variant-strip + palette/length/bracket-color fixes | Modify |
| `lib/check/hardcoded-color.ts` | inline keyword-color pass | Modify |
| `tests/check/css-colors.test.ts` | membership/exclusion unit test | Create |
| `tests/check/arbitrary-tailwind.test.ts` | new holes + variants + regression twins + FP guards | Extend |
| `tests/check/hardcoded-color.test.ts` | inline keyword cases + FP guards | Extend |
| `AGENTS.md` | preamble "variants don't exempt" note | Modify |
| `docs/M6-DOGFOOD.md` | mark F6 slip-throughs done | Modify |

---

## Task 1: `css-colors.ts` + unit test

**Files:** Create `lib/check/css-colors.ts`, `tests/check/css-colors.test.ts`.

- [ ] **Step 1: Write the failing test** — `tests/check/css-colors.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { isNamedColor } from "@/lib/check/css-colors";

describe("css-colors", () => {
  it("recognizes named colors (case-insensitive)", () => {
    for (const c of ["red", "RED", "Blue", "gold", "tan", "rebeccapurple", "tomato"])
      expect(isNamedColor(c), c).toBe(true);
  });
  it("excludes CSS-wide keywords and non-colors", () => {
    for (const c of ["transparent", "currentcolor", "inherit", "initial", "unset", "none", "revert", "revert-layer"])
      expect(isNamedColor(c), c).toBe(false);
  });
  it("is exact, not prefix/substring", () => {
    for (const c of ["reddish", "rebecca", "redbg", ""]) expect(isNamedColor(c), c).toBe(false);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** — `npx vitest run tests/check/css-colors.test.ts` (module missing).

- [ ] **Step 3: Create `lib/check/css-colors.ts`**

```ts
// The 148 CSS Color Module Level 4 <named-color> keywords (incl. rebeccapurple), lowercased.
// Deliberately EXCLUDES the CSS-wide keywords transparent/currentColor/inherit/initial/unset/none/
// revert/revert-layer — those are legitimate values, not hardcoded colors. This list does not contain
// them. Static spec data; does not change.
const NAMED = new Set<string>([
  "aliceblue","antiquewhite","aqua","aquamarine","azure","beige","bisque","black","blanchedalmond",
  "blue","blueviolet","brown","burlywood","cadetblue","chartreuse","chocolate","coral","cornflowerblue",
  "cornsilk","crimson","cyan","darkblue","darkcyan","darkgoldenrod","darkgray","darkgreen","darkgrey",
  "darkkhaki","darkmagenta","darkolivegreen","darkorange","darkorchid","darkred","darksalmon",
  "darkseagreen","darkslateblue","darkslategray","darkslategrey","darkturquoise","darkviolet","deeppink",
  "deepskyblue","dimgray","dimgrey","dodgerblue","firebrick","floralwhite","forestgreen","fuchsia",
  "gainsboro","ghostwhite","gold","goldenrod","gray","green","greenyellow","grey","honeydew","hotpink",
  "indianred","indigo","ivory","khaki","lavender","lavenderblush","lawngreen","lemonchiffon","lightblue",
  "lightcoral","lightcyan","lightgoldenrodyellow","lightgray","lightgreen","lightgrey","lightpink",
  "lightsalmon","lightseagreen","lightskyblue","lightslategray","lightslategrey","lightsteelblue",
  "lightyellow","lime","limegreen","linen","magenta","maroon","mediumaquamarine","mediumblue",
  "mediumorchid","mediumpurple","mediumseagreen","mediumslateblue","mediumspringgreen","mediumturquoise",
  "mediumvioletred","midnightblue","mintcream","mistyrose","moccasin","navajowhite","navy","oldlace",
  "olive","olivedrab","orange","orangered","orchid","palegoldenrod","palegreen","paleturquoise",
  "palevioletred","papayawhip","peachpuff","peru","pink","plum","powderblue","purple","rebeccapurple",
  "red","rosybrown","royalblue","saddlebrown","salmon","sandybrown","seagreen","seashell","sienna",
  "silver","skyblue","slateblue","slategray","slategrey","snow","springgreen","steelblue","tan","teal",
  "thistle","tomato","turquoise","violet","wheat","white","whitesmoke","yellow","yellowgreen",
]);

/** True if `v` is exactly a CSS named color (case-insensitive). */
export function isNamedColor(v: string): boolean {
  return NAMED.has(v.toLowerCase());
}
```

- [ ] **Step 4: Run it — expect PASS** — `npx vitest run tests/check/css-colors.test.ts`. Also sanity-check the count: the Set should have 148 entries (optional inline assertion `expect(NAMED.size).toBe(148)` not exported — skip).

- [ ] **Step 5: Commit**

```bash
cd /Users/jason/Developer/vibe-design-system
git add lib/check/css-colors.ts tests/check/css-colors.test.ts
git commit -m "feat(f6): css-colors.ts — CSS named-color vocabulary (isNamedColor)"
```

---

## Task 2: Variant-stripping in `checkArbitrary` (hole #4)

**Files:** Modify `lib/check/arbitrary-tailwind.ts`; extend `tests/check/arbitrary-tailwind.test.ts`.

This task ONLY adds `baseUtil` + threads it through the loop. The palette/length/bracket-color additions are Task 3. After this task, variant-prefixed forms of the **existing** rules must flag.

- [ ] **Step 1: Add failing tests** — append to `tests/check/arbitrary-tailwind.test.ts` (uses the existing `find()` helper which wraps as `const c = "<s>"`)

```ts
  it("strips variant prefixes so existing rules still fire (hole #4 / regression twins)", () => {
    expect(find("md:bg-red-500")).toContain("default-palette");
    expect(find("hover:p-13")).toContain("off-scale-spacing");
    expect(find("md:text-[10px]")).toContain("arbitrary-length");
    expect(find("md:hover:bg-red-500")).toContain("default-palette"); // stacked
  });
  it("variant strip is bracket-aware (colon inside [] is not a variant separator)", () => {
    expect(find("bg-[url(http://x)]")).toEqual([]); // not a color/length → no finding, no misparse
  });
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run tests/check/arbitrary-tailwind.test.ts` (variant forms currently don't match the `^`-anchored regexes).

- [ ] **Step 3: Implement** — edit `lib/check/arbitrary-tailwind.ts`: add `baseUtil`, compute `base` once per token, switch every regex input to `base`, keep every `MSG.*(cls)` on the original `cls`. New loop body:

```ts
/** Strip leading variant segments (md:, hover:, dark:, stacked) to the base utility. Bracket-aware:
 *  only colons BEFORE the first "[" are variant separators (arbitrary values can contain ":",
 *  e.g. bg-[url(http://x)]). */
function baseUtil(cls: string): string {
  const br = cls.indexOf("[");
  const scan = br === -1 ? cls : cls.slice(0, br);
  const lastColon = scan.lastIndexOf(":");
  return lastColon === -1 ? cls : cls.slice(lastColon + 1);
}

export function checkArbitrary(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  for (const m of content.matchAll(STRING_LIT)) {
    const line = lineOf(content, m.index!);
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      const base = baseUtil(cls);
      const arb = base.match(reArbitrary);
      if (arb) {
        const inner = arb[1];
        if (/var\(|color-mix\(|calc\(|min\(|max\(|clamp\(/.test(inner)) continue;
        if (reArbColorPrefix.test(base) && /^(#|rgba?\(|hsla?\(|oklch\(|oklab\()/.test(inner))
          out.push({ file: path, line, rule: "arbitrary-color", message: MSG.arbitraryColor(cls) });
        else if (reArbLengthPrefix.test(base) && /^\d*\.?\d+(px|rem|em|%)$/.test(inner))
          out.push({ file: path, line, rule: "arbitrary-length", message: MSG.arbitraryLength(cls) });
        continue;
      }
      const sp = base.match(reSpacingNum);
      if (sp && !ALLOWED_SPACING_STEPS.has(Number(sp[1]))) {
        out.push({ file: path, line, rule: "off-scale-spacing", message: MSG.offScaleSpacing(cls) });
        continue;
      }
      if (rePalette.test(base))
        out.push({ file: path, line, rule: "default-palette", message: MSG.defaultPalette(cls) });
    }
  }
  return out;
}
```

(No regex constants change in this task — only `base` threading.)

- [ ] **Step 4: Run — expect PASS** — `npx vitest run tests/check/arbitrary-tailwind.test.ts` (new + all existing cases green; the existing non-variant cases are unaffected because `baseUtil` returns the class unchanged when there's no leading `variant:`).

- [ ] **Step 5: Commit**

```bash
git add lib/check/arbitrary-tailwind.ts tests/check/arbitrary-tailwind.test.ts
git commit -m "feat(f6): variant-strip in checkArbitrary (bracket-aware) — closes md:/hover:/dark: bypass"
```

---

## Task 3: Palette + arbitrary-width + bracket-named-color (holes #1, #2, #3a)

**Files:** Modify `lib/check/arbitrary-tailwind.ts`; extend `tests/check/arbitrary-tailwind.test.ts`.

- [ ] **Step 1: Add failing tests** — append to `tests/check/arbitrary-tailwind.test.ts`

```ts
  it("flags text/placeholder palette (hole #1)", () => {
    expect(find("text-gray-500")).toContain("default-palette");
    expect(find("placeholder-gray-500")).toContain("default-palette");
    expect(find("md:text-gray-500")).toContain("default-palette");
  });
  it("flags arbitrary radius/border/ring widths (hole #2)", () => {
    for (const c of ["rounded-[5px]", "border-[3px]", "ring-[3px]", "outline-[2px]", "hover:rounded-[5px]"])
      expect(find(c), c).toContain("arbitrary-length");
  });
  it("flags bracket named colors (hole #3a)", () => {
    for (const c of ["bg-[red]", "border-[gold]", "ring-[blue]", "dark:bg-[red]"])
      expect(find(c), c).toContain("arbitrary-color");
  });
  it("does not false-positive on tokens/keywords/legit utilities", () => {
    for (const c of [
      "text-primary", "text-lg", "text-brand-700", "rounded-full", "rounded-lg",
      "rounded-[var(--radius)]", "rounded-[min(var(--radius-md),10px)]", "bg-[var(--x)]",
      "bg-[url(tan.png)]", "border-[currentColor]", "bg-[transparent]",
    ]) expect(find(c), c).toEqual([]);
    expect(find("bg-[oklch(0.5_0.2_30)]")).toContain("arbitrary-color"); // still flags via hex/func test
  });
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run tests/check/arbitrary-tailwind.test.ts`.

- [ ] **Step 3: Implement** — three small edits to `lib/check/arbitrary-tailwind.ts`:

(a) import the vocabulary at the top:
```ts
import { isNamedColor } from "./css-colors";
```
(b) extend two regex constants:
```ts
const reArbLengthPrefix = new RegExp(`^-?(?:text|leading|rounded|border|ring|outline|ring-offset|${SPACING})-\\[`);
const rePalette = new RegExp(`^-?(?:bg|text|placeholder|border|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|ring-offset)-(?:${PALETTES})-\\d{2,3}$`);
```
(c) extend the color-branch inner test (the `if` at the arbitrary branch) to also flag exact named colors:
```ts
        if (reArbColorPrefix.test(base) && (/^(#|rgba?\(|hsla?\(|oklch\(|oklab\()/.test(inner) || isNamedColor(inner)))
          out.push({ file: path, line, rule: "arbitrary-color", message: MSG.arbitraryColor(cls) });
```

Routing check: `border-[3px]` → color branch (border in `reArbColorPrefix`), inner `3px` not a color → falls to length branch (border now in `reArbLengthPrefix`) → `arbitrary-length`. `border-[currentColor]` → `isNamedColor("currentColor")` is false (excluded) and not hex → neither branch → no finding. `bg-[transparent]` → same, no finding.

- [ ] **Step 4: Run — expect PASS** — `npx vitest run tests/check/arbitrary-tailwind.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/check/arbitrary-tailwind.ts tests/check/arbitrary-tailwind.test.ts
git commit -m "feat(f6): text/placeholder palette + rounded/border/ring arbitrary width + bracket named colors"
```

---

## Task 4: Inline keyword color in `checkHardcodedColor` (hole #3b)

**Files:** Modify `lib/check/hardcoded-color.ts`; extend `tests/check/hardcoded-color.test.ts`.

- [ ] **Step 1: Add failing tests** — append to `tests/check/hardcoded-color.test.ts` (the `find()` here returns a COUNT)

```ts
  it("flags inline keyword colors on color-valued property keys", () => {
    expect(find(`<div style={{color:"red"}}/>`)).toBe(1);
    expect(find(`const s={ borderColor: 'blue' };`)).toBe(1);
    expect(find(`const s={ background: "RED" };`)).toBe(1);            // case-insensitive
    expect(find(`const s={ borderTopColor: "red", stopColor: "blue" };`)).toBe(2); // *Color branch
  });
  it("does not false-positive on var()/non-colors/shorthands/identifiers", () => {
    expect(find(`<div style={{borderColor:"var(--foreground)"}}/>`)).toBe(0);
    expect(find(`const s={ boxShadow: shadow };`)).toBe(0);
    expect(find(`const s={ border: "1px solid red" };`)).toBe(0);     // shorthand residual
    expect(find(`const x="decoration-color"; const orange = 1;`)).toBe(0);
    expect(find(`// red is a nice color`)).toBe(0);
  });
  it("flags exactly once per literal (no double-report with hex on same line)", () => {
    expect(find(`const s={ color:"red", background:"#fff" };`)).toBe(2); // 1 keyword + 1 hex
  });
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run tests/check/hardcoded-color.test.ts`.

- [ ] **Step 3: Implement** — edit `lib/check/hardcoded-color.ts`: import `isNamedColor`, add the `KEYWORD` regex, add a `matchAll` pass in the per-line loop.

```ts
import { isNamedColor } from "./css-colors";

// color-valued property key (background|fill|stroke|*Color) at a property position, then a quoted
// EXACT word. Iterate with matchAll (never .test/.exec on this /g regex).
const KEYWORD = /(?:^|[\s{;,(])(?:background|fill|stroke|[a-zA-Z]*[cC]olor)\s*:\s*(['"])([a-zA-Z]+)\1/g;
```

In the `forEach` line loop, after the HEX/FUNC loops, add:
```ts
    for (const kw of ln.matchAll(KEYWORD))
      if (isNamedColor(kw[2]))
        out.push({ file: path, line: i + 1, rule: "hardcoded-color", message: MSG.hardcodedColor(kw[2]) });
```

Note: the existing `if (EXEMPT.test(ln)) return;` stays first — it drops `url(`/`href=`/`id=` lines (so `background:"url() red"` is exempted, consistent with the shorthand residual). The value backref `\1` anchors to the closing quote, so `"var(--foreground)"`/`"1px solid red"` (extra chars before close) don't match.

- [ ] **Step 4: Run — expect PASS** — `npx vitest run tests/check/hardcoded-color.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/check/hardcoded-color.ts tests/check/hardcoded-color.test.ts
git commit -m "feat(f6): inline keyword-color detection (color-prop key + exact named color)"
```

---

## Task 5: Docs — AGENTS preamble note + M6 ledger

**Files:** Modify `AGENTS.md`, `docs/M6-DOGFOOD.md`.

- [ ] **Step 1: AGENTS.md preamble note.** In the `design-system` block (after the "Law:" / off-token sentence, before the table), add one line:

```
**Variant prefixes don't exempt a class** — `md:bg-[red]`, `hover:rounded-[5px]`, `dark:text-gray-500` are rejected exactly like their unprefixed forms.
```

Do NOT add a recovery-table row (the generic "hardcoded color / off-token class" row already covers these).

- [ ] **Step 2: M6 ledger.** In `docs/M6-DOGFOOD.md`, mark the F6 row's slip-throughs done (text-palette/keyword-color/arbitrary-radius closed + variant-prefix bypass closed + border/ring widths), noting the **baseline/incremental mode is still deferred**.

- [ ] **Step 3: Verify gate still green** — `npm run check` → `✓ design-system check passed (4 ds-disable in use)`. (Docs only; no manifest change.)

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/M6-DOGFOOD.md
git commit -m "docs(f6): AGENTS 'variants don't exempt' note; M6 ledger slip-throughs done (baseline deferred)"
```

---

## Task 6: Self-pass grep + full verification + merge

**Files:** none (verification + integration).

- [ ] **Step 1: Explicit grep (self.test.ts is blind to variant regressions).** Run from repo root over `app` + `components`, expecting **no output** (excluding `components/ui`):

```bash
cd /Users/jason/Developer/vibe-design-system
grep -rnE '(text|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}' app components --include=*.tsx --include=*.ts | grep -v 'components/ui/'
grep -rnE '(rounded|border|ring|outline)-\[' app components --include=*.tsx --include=*.ts | grep -v 'components/ui/'
grep -rnE '(background|[a-zA-Z]*[cC]olor|fill|stroke)\s*:\s*["'"'"'][a-zA-Z]+["'"'"']' app components --include=*.tsx --include=*.ts | grep -v 'components/ui/'
```
If any line is a real off-token usage, fix it (use a token utility) as F3 did with `rounded-2xl`. Expected: clean (per spec §5).

- [ ] **Step 2: Full gate** — `npm run check && npm test && npm run lint`
Expected: check ✓ (4 ds-disable); all tests pass incl. the new `css-colors`/`arbitrary-tailwind`/`hardcoded-color` cases + `self.test.ts` green; lint 0.

- [ ] **Step 3: Verify before claiming done** — @superpowers:verification-before-completion. Confirm the three gate commands green + tree clean (`git status`).

- [ ] **Step 4: Merge to main** — @superpowers:finishing-a-development-branch. `--no-ff`, full suite green before merge, delete branch after.

```bash
git checkout main && git merge --no-ff f6-slip-throughs && git branch -d f6-slip-throughs
```

---

## Done =

`npm run check` rejects `text-gray-500`/`placeholder-gray-500`, `rounded-[5px]`/`border-[3px]`/`ring-[3px]`, `bg-[red]`, inline `color:"red"`, **and** their `md:`/`hover:`/`dark:`(+stacked) forms — with the existing rule messages; never false-positives on `var()`/token values, `rounded-full`, `text-brand-*`, `rounded-[var(--radius)]`, `bg-[url(http://x)]`, shorthands, or bare identifiers; the variant-strip also hardens the pre-existing rules (proved by regression-twin tests); the repo passes its own gate (explicit grep + `self.test.ts`); AGENTS.md gains the "variants don't exempt" note; merged to main.
