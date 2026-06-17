# M3 — Design-System Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/design-system` route — a living style guide that **auto-iterates every token** from the generated manifest (truthful by construction, never stale) with each token `data-token`-tagged for the editor, plus a hand-authored shadcn **component showcase**, themed entirely by the design system's own tokens.

**Architecture:** Two parts. (1) **Token reference** — render from `design-system.json` (the committed, CI-fresh manifest); group tokens by their `group`, render one `data-token`-tagged item per token with a group-appropriate preview. A completeness test asserts every manifest token appears exactly once, so a token can never silently fall out of the UI. (2) **Component showcase** — hand-authored shadcn components in their variants (can't be meaningfully auto-generated). The page itself is built from design-system utilities (`bg-card`, `text-foreground`…), so it re-themes when the theme is swapped. **Function is TDD'd; visual polish is a separate brief-driven pass.**

**Tech Stack:** Next 16 App Router, React 19, the M2 manifest (`design-system.json` + `Manifest` types), shadcn components, Playwright (new in M3), Vitest.

**Scope note:** M3 of the spec at [docs/specs/2026-06-16-design-system-starter-design.md](../../specs/2026-06-16-design-system-starter-design.md) (§4). Depends on **M0/M1/M2 landed** (globals.css tokens, `lib/tokens`, `design-system.json`). The editor that consumes `data-token` is M4; M3 only *tags*. The other 7 theme screenshots are M3a (this page is what they capture). M3 done-criteria (spec §10): living style guide, truthful by construction.

**Design-quality method (per the spec's design discussion + `docs/DESIGN-BRIEF.md`):** Tasks 1–5 build and TEST the *contract* (what renders, tagging, no overflow, a11y). Task 6 is the *aesthetic* pass — it does NOT hardcode a layout from this plan; it works to the master brief, screenshots, critiques against the brief, and iterates. This keeps visual quality high without capping it at the plan author's taste.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/design-system/sections.ts` | `groupedSections(manifest)` → ordered sections (group → its tokens); the render model |
| `components/design-system/token-item.tsx` | one token: `data-token`-tagged, group-appropriate preview + name + value + utilities |
| `components/design-system/token-section.tsx` | a titled section rendering a group's `TokenItem`s |
| `components/design-system/component-showcase.tsx` | hand-authored shadcn variants (buttons, inputs, cards, …) |
| `app/design-system/page.tsx` | assembles token sections (auto) + showcase + page chrome |
| `tests/design-system/sections.test.ts` | completeness: disjoint + exhaustive over the manifest |
| `e2e/design-system.spec.ts` | Playwright: sections present, every token tagged, no overflow, a11y |
| `playwright.config.ts` | Playwright config (webServer = next dev) |

Decomposition: the render *model* (`sections.ts`) is pure and unit-tested for completeness; the *components* are small and individually verifiable for `data-token` + value rendering; the *page* assembles; Playwright proves it in a real browser; the visual pass refines.

---

## Task 0: Playwright setup

**Files:**
- Create: `playwright.config.ts`
- Modify: `package.json` (scripts + dep)

- [ ] **Step 1: Install Playwright + browser**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Config with a dev webServer**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "next dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

Add to `package.json` `scripts`: `"e2e": "playwright test"`. (Keep `vitest.config.ts`'s `test.include` scoped to `tests/**` so Vitest never tries to run the Playwright specs in `e2e/`.)

- [ ] **Step 3: Verify Playwright runs (no tests yet = passes trivially)**

Run: `npx playwright test` → expect "no tests found" / exit 0 (or skip until Task 5). Commit.

```bash
git add playwright.config.ts package.json package-lock.json
git commit -m "chore(m3): add Playwright + config"
```

---

## Task 1: `sections.ts` — the render model (completeness-tested)

**Files:**
- Create: `lib/design-system/sections.ts`
- Create: `tests/design-system/sections.test.ts`

- [ ] **Step 1: Write the failing test**

The contract: every manifest token lands in exactly one section; sections are ordered; empty groups are omitted. Create `tests/design-system/sections.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupedSections } from "@/lib/design-system/sections";
import type { Manifest } from "@/lib/tokens/generate";

const manifest: Manifest = JSON.parse(readFileSync(resolve("design-system.json"), "utf8"));

describe("groupedSections", () => {
  const sections = groupedSections(manifest);

  it("covers every token exactly once (disjoint + exhaustive)", () => {
    const seen = sections.flatMap((s) => s.tokens.map((t) => t.name));
    expect(seen.slice().sort()).toEqual(manifest.tokens.map((t) => t.name).sort());
    expect(new Set(seen).size).toBe(seen.length); // no token in two sections
  });

  it("omits empty groups and titles each section", () => {
    for (const s of sections) {
      expect(s.tokens.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.group).toBeTruthy();
    }
  });

  it("orders color first", () => {
    expect(sections[0].group).toBe("color");
  });
});
```

- [ ] **Step 2: Run — verify it fails** (`npx vitest run tests/design-system/sections.test.ts` → module not found).

- [ ] **Step 3: Implement `sections.ts`**

```ts
import type { Manifest, ManifestToken } from "@/lib/tokens/generate";
import type { TokenGroup } from "@/lib/tokens/types";

export interface Section {
  group: TokenGroup;
  title: string;
  tokens: ManifestToken[];
}

const ORDER: TokenGroup[] = [
  "color", "fontFamily", "fontSize", "lineHeight", "fontWeight",
  "spacing", "radius", "borderWidth", "shadow", "duration", "easing",
  "zIndex", "opacity", "container",
];

const TITLES: Record<TokenGroup, string> = {
  color: "Color", fontFamily: "Font family", fontSize: "Type scale",
  lineHeight: "Line height", fontWeight: "Font weight", spacing: "Spacing",
  radius: "Radius", borderWidth: "Border width", shadow: "Shadow",
  duration: "Duration", easing: "Easing", zIndex: "Z-index",
  opacity: "Opacity", container: "Container",
};

/** Group manifest tokens into ordered, titled sections. Empty groups omitted. */
export function groupedSections(manifest: Manifest): Section[] {
  return ORDER.map((group) => ({
    group,
    title: TITLES[group],
    tokens: manifest.tokens.filter((t) => t.group === group),
  })).filter((s) => s.tokens.length > 0);
}
```

- [ ] **Step 4: Run — verify pass.** Commit.

```bash
git add lib/design-system/sections.ts tests/design-system/sections.test.ts
git commit -m "feat(m3): grouped-sections render model (completeness-tested)"
```

---

## Task 2: `TokenItem` + `TokenSection` components

Each token renders `data-token="--name"` (the editor's hook — spec §4/§6) with a group-appropriate preview. Function only; styling refined in Task 6.

**Files:**
- Create: `components/design-system/token-item.tsx`
- Create: `components/design-system/token-section.tsx`
- Create: `tests/design-system/token-item.test.tsx`

- [ ] **Step 1: Add a DOM test runner for component tests**

```bash
npm i -D @testing-library/react @testing-library/dom jsdom
```

Two required config changes (Vitest v4 — do NOT use `environmentMatchGlobs`, it was removed in v3):
1. **Broaden the test glob** in `vitest.config.ts`: `test.include` is currently `["tests/**/*.test.ts"]`, which will NOT collect `.test.tsx`. Change it to `["tests/**/*.test.{ts,tsx}"]` — otherwise the component test silently isn't run and appears to "pass" by not existing.
2. **Select jsdom per-file** (keeps `.test.ts` in fast `node`): put a docblock at the TOP of each component `.test.tsx`:

```ts
// @vitest-environment jsdom
```

Verify with a trivial `render(<div/>)` test before proceeding — if it throws `document is not defined`, the docblock/glob isn't taking effect.

- [ ] **Step 2: Write the failing test**

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TokenItem } from "@/components/design-system/token-item";

const colorTok = { name: "--primary", group: "color" as const, values: { light: "oklch(0.205 0 0)", dark: "oklch(0.922 0 0)" }, utilities: ["bg-primary", "text-primary", "border-primary"] };

describe("TokenItem", () => {
  it("tags the item with data-token", () => {
    const { container } = render(<TokenItem token={colorTok} />);
    expect(container.querySelector('[data-token="--primary"]')).not.toBeNull();
  });
  it("shows the token name, a value, and its utilities", () => {
    const { getByText, container } = render(<TokenItem token={colorTok} />);
    expect(getByText("--primary")).toBeTruthy();
    expect(container.textContent).toContain("oklch(0.205 0 0)");
    expect(container.textContent).toContain("bg-primary");
  });
  it("renders a color preview swatch backed by the token var", () => {
    const { container } = render(<TokenItem token={colorTok} />);
    const sw = container.querySelector('[data-token="--primary"] [data-preview="swatch"]') as HTMLElement;
    expect(sw).not.toBeNull();
    expect(sw.style.background).toContain("var(--primary)");
  });
});
```

- [ ] **Step 3: Run — verify it fails.**

- [ ] **Step 4: Implement `TokenItem` (group-appropriate preview) + `TokenSection`**

`token-item.tsx` — switch on `group` for the preview; **always tag `data-token` on the item root, regardless of group**, and show name (mono), value(s), utilities. Color → swatch (`style={{ background: 'var(' + name + ')' }}` with `data-preview="swatch"`); fontSize → text sample at `var(--text-…)`; fontFamily → sample in family; fontWeight → sample at weight; radius/borderWidth/shadow → a box with the corresponding utility; spacing → a bar; duration/easing → a small animated demo; zIndex/opacity/container → the value rendered plainly. **The switch MUST have a `default` branch that still renders the tagged wrapper + name + value** — so every group (including lineHeight, easing, etc.) is covered and the Task 5 completeness e2e holds by construction, not by remembering each group. Keep each preview minimal and correct (the point is *truthful*, not pretty — Task 6 makes it pretty). Use the token's own utilities where possible so the preview tracks edits live.

`token-section.tsx` — a titled region (`<section>` with a heading = `title`) mapping its tokens to `TokenItem`.

- [ ] **Step 5: Run — verify pass.** Commit.

```bash
git add components/design-system/token-item.tsx components/design-system/token-section.tsx tests/design-system/token-item.test.tsx vitest.config.ts package.json package-lock.json
git commit -m "feat(m3): TokenItem (data-token tagged) + TokenSection"
```

---

## Task 3: `/design-system` page — auto-iterate sections

**Files:**
- Create: `app/design-system/page.tsx`

- [ ] **Step 1: Build the page**

Import `design-system.json`, call `groupedSections`, render a `TokenSection` per section. Wrap in page chrome built from design-system tokens (`bg-background text-foreground`, a heading, intro). Add the `data-token` reference sections first; the component showcase (Task 4) slots in after. Gate behind the dev/showcase intent per spec §4 (a config flag can come later; for now it's a normal route).

```tsx
import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { groupedSections } from "@/lib/design-system/sections";
import { TokenSection } from "@/components/design-system/token-section";

export default function DesignSystemPage() {
  const sections = groupedSections(designSystem as Manifest);
  return (
    <main className="bg-background text-foreground p-8 flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">Design System</h1>
        <p className="text-base text-muted-foreground">
          Every token, rendered from <code className="font-mono">app/globals.css</code>. Edit a token and it ripples everywhere.
        </p>
      </header>
      {sections.map((s) => (
        <TokenSection key={s.group} section={s} />
      ))}
      {/* component showcase added in Task 4 */}
    </main>
  );
}
```

- [ ] **Step 2: Verify it renders**

```bash
npx next dev & sleep 7
curl -sf http://localhost:3000/design-system | grep -q 'Design System' && echo "PAGE OK"
curl -sf http://localhost:3000/design-system | grep -oE 'data-token="--[a-z0-9-]+"' | sort -u | wc -l | xargs echo "data-token count:"
kill %1
```

Expected: `PAGE OK`, and the data-token count is in the ballpark of the manifest token count.

- [ ] **Step 3: Commit.**

```bash
git add app/design-system/page.tsx
git commit -m "feat(m3): /design-system page auto-iterates token sections"
```

---

## Task 4: Component showcase (hand-authored)

**Files:**
- Create: `components/design-system/component-showcase.tsx`
- Modify: `app/design-system/page.tsx` (include it)

- [ ] **Step 1: Author the showcase**

A `ComponentShowcase` rendering the installed shadcn components in their meaningful variants — Buttons (default/secondary/destructive/outline/ghost + sizes + disabled), Inputs (default/disabled/with label), Cards (header/content/footer), plus status usage (success/warning/info via the tokens). Use only token utilities (no hardcoded colors). Each variant labeled. This section is curated, not generated (spec §4) — but uses ONLY design-system tokens so it re-themes. **The showcase intentionally does NOT add `data-token` attributes** (it demonstrates components via token *utilities*, not editable token swatches), so it does not affect the Task 5 per-token `toHaveCount(1)` — `data-token` lives only in the reference sections.

- [ ] **Step 2: Include it on the page** (after the token sections), in its own titled `<section>`.

- [ ] **Step 3: Verify build + render**

```bash
npm run build 2>&1 | tail -5
npx next dev & sleep 7; curl -sf http://localhost:3000/design-system | grep -q 'Components' && echo "SHOWCASE OK"; kill %1
```

- [ ] **Step 4: Commit.**

```bash
git add components/design-system/component-showcase.tsx app/design-system/page.tsx
git commit -m "feat(m3): hand-authored shadcn component showcase"
```

---

## Task 5: Playwright e2e — the truthful-by-construction proof

**Files:**
- Create: `e2e/design-system.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```ts
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("design-system.json"), "utf8"));

test.describe("/design-system", () => {
  test("renders a data-token element for every manifest token (nothing falls out of the UI)", async ({ page }) => {
    await page.goto("/design-system");
    for (const t of manifest.tokens) {
      await expect(page.locator(`[data-token="${t.name}"]`)).toHaveCount(1);
    }
  });

  test("shows every token group as a section heading", async ({ page }) => {
    await page.goto("/design-system");
    for (const title of ["Color", "Type scale", "Spacing", "Radius", "Shadow", "Components"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("no horizontal overflow at any breakpoint", async ({ page }) => {
    for (const width of [375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/design-system");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow, `overflow at ${width}px`).toBe(false);
    }
  });

  test("has one h1 and a main landmark", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
});
```

- [ ] **Step 2: Run** `npx playwright test` → all pass. The first test is the load-bearing one: **every manifest token has exactly one tagged element** — proves truthful-by-construction and that the editor (M4) can find every token.

- [ ] **Step 3: Commit.**

```bash
git add e2e/design-system.spec.ts
git commit -m "test(m3): e2e — every token tagged, all groups shown, no overflow, a11y"
```

---

## Task 6: Visual pass (brief-driven, NOT hardcoded here)

This task makes the page look professional. It is deliberately under-specified in JSX — the implementer works to the brief and iterates on screenshots, per the spec's design-quality method.

**Inputs:** `docs/DESIGN-BRIEF.md` (master brief + the **Neutral** mini-brief — the page ships Neutral) and the `document-skills:frontend-design` skill.

**Files:** refine `app/design-system/page.tsx`, `components/design-system/*` styling (token utilities only — never hardcoded values; the page must itself pass the design system's rules).

- [ ] **Step 1: Invoke `document-skills:frontend-design`** and read `docs/DESIGN-BRIEF.md` (master + Neutral).

- [ ] **Step 2: Restyle the page to the brief** — strong hierarchy, dense-but-readable token grids (the sidebar-doc density principles apply: hairlines, muted section labels, consistent grids), generous sectioning, sticky section nav optional. **Token utilities only** — run `npm run build` to confirm no off-token classes crept in (they'd no-op).

- [ ] **Step 3: Screenshot + self-critique loop.** Capture desktop (1280) and mobile (375) with Playwright; grade against the brief's checklist (contrast pass, coherence, distinctiveness, liveability). Revise. Repeat until it passes.

```ts
// e2e/_shot.spec.ts (throwaway) — capture for review
import { test } from "@playwright/test";
for (const [w, name] of [[1280, "desktop"], [375, "mobile"]] as const) {
  test(`shot ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 1200 });
    await page.goto("/design-system");
    await page.screenshot({ path: `e2e/__shots__/${name}.png`, fullPage: true });
  });
}
```

- [ ] **Step 4: Re-run Task 5's e2e** (function must still pass after restyle) + `npm test`.

- [ ] **Step 5: HUMAN CHECKPOINT.** Present the screenshots. Aesthetic is subjective — get a thumbs-up or specific direction before declaring M3 done. Then remove the throwaway shot spec.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(m3): visual pass — design-system page styled to the brief"
```

---

## M3 Done Criteria (spec §10 / §4)

- [ ] `/design-system` renders, themed by the design system's own tokens (Task 3/4).
- [ ] Token sections **auto-iterate** the manifest; **every token has exactly one `data-token` element** (Task 1 + Task 5 — truthful by construction, nothing falls out of the UI).
- [ ] Hand-authored shadcn component showcase present, token-only (Task 4).
- [ ] No horizontal overflow at sm/md/lg/xl; one `h1`; `main` landmark (Task 5).
- [ ] Visual pass approved against `DESIGN-BRIEF.md` Neutral (Task 6, human checkpoint).

## Hand-off to M3a / M4

M3a screenshots THIS page under each of the 3 v1 themes (Neutral already; Swiss, Brutalist authored there) for the README gallery. M4's editor attaches to the `data-token` elements this page tags — the completeness test (Task 5) guarantees the editor can find every token. The Figma-style sidebar design language ([docs/figma-style-sidebar-design-language.md](../../figma-style-sidebar-design-language.md)) is M4's visual input; its density/section/control-row patterns also informed this page's token grids (Task 6).
