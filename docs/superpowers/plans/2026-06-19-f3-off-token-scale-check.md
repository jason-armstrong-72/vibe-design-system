# F3 — Off-token scale-step check Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `npm run check` sub-check that flags named scale-step utilities (`rounded-2xl`, `text-8xl`, `shadow-xl`, `font-black`) whose step isn't defined in `@theme` — closing the M6 F3 silent-no-op hole.

**Architecture:** A new pure sub-check `lib/check/off-token-scale.ts` mirroring `lib/check/arbitrary-tailwind.ts`. It holds a static **vocab** of Tailwind v4 theme-var-based scale steps per family (radius/shadow/text/font-weight) and a parser that reads the **defined** steps live from the `@theme` block of `app/globals.css`. A class is flagged iff its step ∈ vocab and ∉ defined. Wired into `lib/check/run.ts` with `definedSteps` computed once (like `both-theme` reads globals once).

**Tech Stack:** TypeScript, Vitest (`tests/check/*`), the existing `lib/check/` harness (`run.ts`, `messages.ts`, `ds-disable.ts`, `walkSource`).

**Spec:** [docs/superpowers/specs/2026-06-19-f3-off-token-scale-check-design.md](../specs/2026-06-19-f3-off-token-scale-check-design.md)

---

## Context for the implementer (read once)

- The design system clears Tailwind namespaces in `@theme` (`--radius-*: initial`, etc.) and redefines only a subset → a named scale-step utility for a cleared-but-not-redefined step silently produces **no CSS**. This check makes that loud.
- **Source of truth = `@theme`** (NOT the manifest): if someone extends the scale in `@theme`, the check must stop flagging. (M6 F4: `@theme`-only steps don't reach the manifest.)
- **Vocab gating** is what keeps it false-positive-safe: vocab holds ONLY scale steps, so `text-center`/`rounded-full`/`font-mono` (not scale steps) are never matched.
- **Variant prefixes** (`md:`, `hover:`) must be stripped before matching, or `md:rounded-2xl` slips.
- Existing check pattern: each sub-check scans quoted string-literals in a file for class tokens. Reuse the same `STRING_LIT` tokenizer shape from `arbitrary-tailwind.ts`.
- **The repo already trips this in 2 places** (`app/design-system/page.tsx:34`, `components/design-system/token-section.tsx:60`, both `rounded-2xl`). They're a pre-existing silent bug (flat corners since M3). Task 4 fixes them — do NOT wire the check into `run.ts` (Task 3) and leave Task 4 undone, or `tests/check/self.test.ts` goes red.

---

## Task 1: Defined-step parser (`parseThemeSteps`)

**Files:**
- Create: `lib/check/off-token-scale.ts` (parser half only this task)
- Test: `tests/check/off-token-scale.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseThemeSteps } from "@/lib/check/off-token-scale";

// NOTE the decoy: a `:root` block AND a comment mentioning "@theme" come BEFORE the real
// `@theme inline {` — exactly like the real globals.css (which has `… derived in @theme …` in a
// comment on line 79). The parser must anchor on `@theme inline`, not the first "@theme".
const THEME = `
/* radius (single knob; sm/md/lg/xl derived in @theme) */
:root { --text-decoy: 1; --radius-decoy: 2; }
@theme inline {
  --color-primary: var(--primary);
  --text-xs: var(--fs-xs);     --text-xs--line-height: var(--lh-xs);
  --text-7xl: var(--fs-7xl);   --text-7xl--line-height: var(--lh-7xl);
  --font-weight-bold: var(--fw-bold);
  --radius-sm: max(0px, calc(var(--radius) - 4px));
  --radius-xl: calc(var(--radius) + 4px);
  --shadow-md: var(--elevation-md);
}
`;

describe("parseThemeSteps", () => {
  it("parses defined steps per family from the @theme block", () => {
    const s = parseThemeSteps(THEME);
    expect([...s.radius].sort()).toEqual(["sm", "xl"]);
    expect([...s.shadow]).toEqual(["md"]);
    expect([...s.text].sort()).toEqual(["7xl", "xs"]);
    expect([...s.fontWeight]).toEqual(["bold"]);
  });
  it("excludes the --text-xs--line-height sub-property form", () => {
    expect(parseThemeSteps(THEME).text.has("xs")).toBe(true);
    expect([...parseThemeSteps(THEME).text]).not.toContain("line"); // no mis-capture
  });
  it("anchors on `@theme inline`, ignoring the earlier comment + :root decoys", () => {
    const s = parseThemeSteps(THEME);
    expect(s.text.has("decoy")).toBe(false);
    expect(s.radius.has("decoy")).toBe(false);
    expect([...s.radius].sort()).toEqual(["sm", "xl"]); // proves it didn't slice empty
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/check/off-token-scale.test.ts`
Expected: FAIL — `parseThemeSteps is not a function`.

- [ ] **Step 3: Implement `parseThemeSteps`**

In `lib/check/off-token-scale.ts`:

```ts
export type ThemeSteps = { radius: Set<string>; shadow: Set<string>; text: Set<string>; fontWeight: Set<string> };

/** Read the steps actually defined in the `@theme` block of globals.css.
 *  Source of truth for "what compiles" — keys the check on @theme, not the manifest. */
export function parseThemeSteps(globalsCss: string): ThemeSteps {
  // Anchor on the actual at-rule `@theme inline {`, NOT the first "@theme" — the real globals.css
  // mentions "@theme" in a comment (line ~79) before the block; anchoring on "@theme" would slice the
  // wrong region and return empty sets → ~75 false positives. (Caught in plan review.)
  const start = globalsCss.indexOf("@theme inline");
  const block = start === -1 ? "" : globalsCss.slice(start, globalsCss.indexOf("\n}", start));
  const out: ThemeSteps = { radius: new Set(), shadow: new Set(), text: new Set(), fontWeight: new Set() };
  const key = { radius: "radius", shadow: "shadow", "font-weight": "fontWeight", text: "text" } as const;
  // step is [a-z0-9]+ ended by a single `:` (not `-`), so `--text-xs--line-height:` does NOT match.
  for (const m of block.matchAll(/--(radius|shadow|font-weight|text)-([a-z0-9]+)\s*:/g)) {
    out[key[m[1] as keyof typeof key]].add(m[2]);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/check/off-token-scale.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/check/off-token-scale.ts tests/check/off-token-scale.test.ts
git commit -m "feat(f3): parseThemeSteps — read defined scale steps from @theme block"
```

---

## Task 2: The check core (`checkOffTokenScale`)

**Files:**
- Modify: `lib/check/off-token-scale.ts`
- Modify: `lib/check/messages.ts`
- Test: `tests/check/off-token-scale.test.ts`

- [ ] **Step 1: Add the message (in `lib/check/messages.ts`, inside the `MSG` object)**

```ts
  offTokenScale: (cls: string, family: string, defined: string[]) =>
    `off-token scale step "${cls}" produces no styles — the ${family} scale is ${defined.join("/")}. Use a defined step, or extend the scale in @theme (see design-system.md)`,
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/check/off-token-scale.test.ts`:

```ts
import { checkOffTokenScale, parseThemeSteps as _p } from "@/lib/check/off-token-scale";

// realistic defined sets (the repo's actual scale)
const DEF = {
  radius: new Set(["sm", "md", "lg", "xl"]),
  shadow: new Set(["sm", "md", "lg"]),
  text: new Set(["xs","sm","base","lg","xl","2xl","3xl","4xl","5xl","6xl","7xl"]),
  fontWeight: new Set(["normal", "medium", "semibold", "bold"]),
};
const rules = (s: string) => checkOffTokenScale(DEF, "x.tsx", `const c = "${s}";`).map((f) => f.rule);

describe("checkOffTokenScale", () => {
  it("flags scale steps not defined in @theme", () => {
    for (const c of ["rounded-2xl","rounded-3xl","rounded-4xl","rounded-xs","shadow-xl","shadow-2xs",
      "text-8xl","text-9xl","font-black","font-thin","font-extrabold"])
      expect(rules(c), c).toEqual(["off-token-scale"]);
  });
  it("flags side-variant radius (step is the final segment)", () => {
    expect(rules("rounded-t-2xl")).toEqual(["off-token-scale"]);
    expect(rules("rounded-tl-3xl")).toEqual(["off-token-scale"]);
    expect(rules("rounded-t-lg")).toEqual([]); // lg defined
  });
  it("flags through variant prefixes (md:/hover:/stacked)", () => {
    expect(rules("md:rounded-2xl")).toEqual(["off-token-scale"]);
    expect(rules("md:hover:shadow-xl")).toEqual(["off-token-scale"]);
  });
  it("does NOT flag defined steps", () => {
    for (const c of ["rounded-xl","rounded-md","shadow-md","text-7xl","text-base","font-bold","font-medium"])
      expect(rules(c), c).toEqual([]);
  });
  it("does NOT flag non-scale utilities or static survivors", () => {
    for (const c of ["rounded-full","rounded-none","shadow-none","shadow-inner","text-center","text-balance",
      "text-pretty","text-accent","text-muted-foreground","font-mono","font-sans","shadow-brand-500","rounded"])
      expect(rules(c), c).toEqual([]);
  });
  it("does NOT flag arbitraries (handled by arbitrary-tailwind)", () => {
    expect(rules("rounded-[5px]")).toEqual([]);
    expect(rules("text-[10px]")).toEqual([]);
  });
  it("is self-maintaining: a step added to defined is no longer flagged", () => {
    const def2 = { ...DEF, radius: new Set([...DEF.radius, "2xl"]) };
    expect(checkOffTokenScale(def2, "x.tsx", `const c = "rounded-2xl";`)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/check/off-token-scale.test.ts`
Expected: FAIL — `checkOffTokenScale is not a function`.

- [ ] **Step 4: Implement `checkOffTokenScale`**

Add to `lib/check/off-token-scale.ts`:

```ts
import type { Finding } from "./types";
import { MSG } from "./messages";

const STRING_LIT = /["'`]([^"'`]*)["'`]/g;
const lineOf = (content: string, idx: number) => content.slice(0, idx).split("\n").length;

// Tailwind v4 theme-var-based scale steps per family (the steps the namespace-clear can turn off).
// Verified against tailwindcss v4 theme.css. Safe-omission rule: when unsure, leave a step OUT
// (a missed no-op is acceptable; a wrongly-included static step would false-positive).
const VOCAB: Record<keyof ThemeSteps, Set<string>> = {
  radius: new Set(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]),
  shadow: new Set(["2xs", "xs", "sm", "md", "lg", "xl", "2xl"]),
  text: new Set(["xs","sm","base","lg","xl","2xl","3xl","4xl","5xl","6xl","7xl","8xl","9xl"]),
  fontWeight: new Set(["thin","extralight","light","normal","medium","semibold","bold","extrabold","black"]),
};
const RADIUS_SIDE = "t|r|b|l|tl|tr|bl|br|s|e|ss|se|ee|es";
const reRadius = new RegExp(`^rounded(?:-(?:${RADIUS_SIDE}))?-([a-z0-9]+)$`);
const reShadow = /^shadow-([a-z0-9]+)$/;
const reText = /^text-([a-z0-9]+)$/;
const reFont = /^font-([a-z0-9]+)$/;
const FAMILY_LABEL: Record<keyof ThemeSteps, string> = {
  radius: "radius", shadow: "shadow", text: "text-size", fontWeight: "font-weight",
};

/** Match a (variant-stripped) utility to (family, step), or null if it's not a guarded scale class. */
function classify(util: string): { family: keyof ThemeSteps; step: string } | null {
  let m: RegExpMatchArray | null;
  if ((m = util.match(reRadius))) return { family: "radius", step: m[1] };
  if ((m = util.match(reShadow))) return { family: "shadow", step: m[1] };
  if ((m = util.match(reText))) return { family: "text", step: m[1] };
  if ((m = util.match(reFont))) return { family: "fontWeight", step: m[1] };
  return null;
}

export function checkOffTokenScale(defined: ThemeSteps, path: string, content: string): Finding[] {
  const out: Finding[] = [];
  for (const m of content.matchAll(STRING_LIT)) {
    const line = lineOf(content, m.index!);
    for (const cls of m[1].split(/\s+/).filter(Boolean)) {
      if (cls.includes("[")) continue;          // arbitraries → arbitrary-tailwind's job
      const util = cls.split(":").pop()!;        // strip variant chain (md:hover:rounded-2xl → rounded-2xl)
      const hit = classify(util);
      if (!hit) continue;
      if (VOCAB[hit.family].has(hit.step) && !defined[hit.family].has(hit.step)) {
        out.push({
          file: path, line, rule: "off-token-scale",
          message: MSG.offTokenScale(cls, FAMILY_LABEL[hit.family], [...defined[hit.family]]),
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/check/off-token-scale.test.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
git add lib/check/off-token-scale.ts lib/check/messages.ts tests/check/off-token-scale.test.ts
git commit -m "feat(f3): checkOffTokenScale — flag undefined scale steps (vocab-gated, variant-aware)"
```

---

## Task 3: Wire into the check runner

**Files:**
- Modify: `lib/check/run.ts`

- [ ] **Step 1: Add the import + compute defined steps + call the check in the file loop**

In `lib/check/run.ts`:
- add `import { checkOffTokenScale, parseThemeSteps } from "./off-token-scale";`
- read globals **before** the file loop (move the existing `const globals = readFileSync(...)` up, or add an earlier read) and `const definedSteps = parseThemeSteps(globals);`
- in the per-file `raw` array, add the new check:

```ts
    const raw = [
      ...checkHardcodedColor(f.path, f.content),
      ...checkArbitrary(f.path, f.content),
      ...checkOffTokenScale(definedSteps, f.path, f.content),
    ];
```

Ensure `globals` is read once and reused by both `definedSteps` and the later `checkBothTheme(globals)` / `checkManifestFresh(globals, …)` calls (don't read it twice).

- [ ] **Step 2: Verify the unit suite still passes**

Run: `npx vitest run tests/check/`
Expected: PASS (all check tests, including the new file).

- [ ] **Step 3: Run the real gate — expect it to RED on the 2 pre-existing offenders**

Run: `npm run check`
Expected: **FAIL** with two `off-token-scale` findings on `app/design-system/page.tsx` + `components/design-system/token-section.tsx` (both `rounded-2xl`). This is correct — Task 4 fixes them. (If `tests/check/self.test.ts` is run now it will also fail — expected until Task 4.)

- [ ] **Step 4: Commit**

```bash
git add lib/check/run.ts
git commit -m "feat(f3): wire off-token-scale into the check runner (defined steps parsed once)"
```

---

## Task 4: Fix the 2 pre-existing offenders + restore self-pass (+ visual checkpoint)

**Files:**
- Modify: `app/design-system/page.tsx:34`, `components/design-system/token-section.tsx:60`

These two cards use `rounded-2xl`, a silent no-op (flat corners) since M3. Fix to the defined max `rounded-xl`. (Per spec §4: `rounded-xl` is recommended — no scale change, no new token. The alternative — adding `--radius-2xl` to `@theme` — is a visual call; default to `rounded-xl` unless the visual checkpoint says the cards want to be rounder.)

- [ ] **Step 1: Confirm the exact current offenders**

Run: `grep -rn 'rounded-2xl\|rounded-3xl\|rounded-4xl\|text-8xl\|text-9xl\|shadow-xl\|shadow-2xl\|font-thin\|font-light\|font-extrabold\|font-black' app components --include=*.tsx | grep -v 'components/ui/'`
Expected: exactly the 2 `rounded-2xl` lines (the spec's named blast radius). If MORE appear, fix each the same way.

- [ ] **Step 2: Capture BEFORE screenshot (visual checkpoint)**

Write a throwaway spec `e2e/__f3_shot__.spec.ts` that screenshots `/design-system` (light) to `e2e/__shots__/f3-before.png`; run `npx playwright test e2e/__f3_shot__.spec.ts`. `Read` the PNG and note the card corners (currently flat — confirms the latent bug).

- [ ] **Step 3: Fix both usages**

Change `rounded-2xl` → `rounded-xl` in both files (the card container class only; leave everything else).

- [ ] **Step 4: Capture AFTER screenshot + self-critique**

Re-run the throwaway spec to `e2e/__shots__/f3-after.png`; `Read` it. Confirm the cards now have (slightly) rounded corners and nothing else shifted. **Present before/after to the user at the checkpoint** (this is the visual gate before declaring done).

- [ ] **Step 5: Verify the gate is green again**

Run: `npm run check`
Expected: ✓ design-system check passed.

- [ ] **Step 6: Remove the throwaway shot spec + commit**

```bash
rm e2e/__f3_shot__.spec.ts
git add app/design-system/page.tsx components/design-system/token-section.tsx
git commit -m "fix(f3): rounded-2xl -> rounded-xl on DS cards (were silently flat since M3)"
```

---

## Task 5: Docs — recovery table + ledgers

**Files:**
- Modify: `AGENTS.md`, `docs/M6-DOGFOOD.md`, `docs/HANDOFF.md`

- [ ] **Step 1: Add the `off-token-scale` row to the AGENTS.md failure→fix table**

In `AGENTS.md`'s design-system gate table, add a row:

```
| off-token scale step (`rounded-2xl`, `text-8xl`, …) | use a defined step, or extend that scale in `@theme` (`app/globals.css`) then `npm run tokens` |
```

- [ ] **Step 2: Mark F3 done in the M6 ledger + HANDOFF**

In `docs/M6-DOGFOOD.md` findings ledger, mark F3 **DONE (2026-06-19)** with a one-line pointer to this work. In `docs/HANDOFF.md`'s M6 fast-follows block, strike F3 (done) and note the new `off-token-scale` check in the M5 check list (the line describing `npm run check` sub-checks).

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md docs/M6-DOGFOOD.md docs/HANDOFF.md
git commit -m "docs(f3): AGENTS recovery row + mark F3 done in ledgers"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full green gate**

Run: `npm run check && npm test && npm run lint && npm run build`
Expected: check ✓ (4 ds-disable), vitest all passing (new off-token-scale tests included), lint 0, build ok.

- [ ] **Step 2: Sanity — the new check actually bites**

Run: add `rounded-3xl` to a scratch line in `app/page.tsx`, `npm run check` → expect a red `off-token-scale` finding; revert it; `npm run check` → ✓. (Manual confidence check; revert the scratch edit.)

- [ ] **Step 3: Confirm clean tree, ready to finish**

Run: `git status` → clean. Then use **superpowers:finishing-a-development-branch** to merge `f3-off-token-scale` → `main` (`--no-ff`) and delete the branch.
