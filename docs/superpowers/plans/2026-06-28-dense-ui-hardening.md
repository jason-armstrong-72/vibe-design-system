# Dense-UI Hardening Implementation Plan

> **For agentic workers:** REQUIRED: execute with superpowers:executing-plans **in-session** (project rule — TDD, commit per task, NOT via subagents). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the 8 dense-product-UI gaps — add a gated `--surface` role + a `2xs` micro type step (+ its gate fix) + activate the dormant `--accent` as hover, and ship Avatar/Badge/Separator/Code/Kbd primitives — so dense app UIs are buildable token-only.

**Architecture:** Tokens added to `app/globals.css` + all 3 theme files (`:root`+`.dark`), auto-wired via `npm run tokens`; primitives in `components/ui/*` (cva/`data-slot`/no-`forwardRef`, Radix-unified, token-only) with a `checkHardcodedColor`-based test restoring the dogfood coverage that dir's gate-exclusion drops.

**Tech Stack:** Tailwind v4 CSS-first tokens (OKLCH), `radix-ui` (unified pkg), cva, vitest/jsdom, `@untitled-ui/icons-react`.

**Spec:** [docs/superpowers/specs/2026-06-28-dense-ui-hardening-design.md](../specs/2026-06-28-dense-ui-hardening-design.md)

**Prereqs:** branch `dense-ui-hardening` (off main, clean). Baseline: `npm test` green (497), `npm run check` green.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `lib/check/off-token-scale.ts` | add `"2xs"` to `VOCAB.text` (gate fix) | 1 |
| `app/globals.css` + `themes/{neutral,swiss,brutalist}.css` | `--fs-2xs`/`--lh-2xs`; `--surface`/`--surface-foreground`; tune neutral `--accent` | 2,3,4 |
| `lib/tokens/schema.ts` | add `surface` to `COLOR_ROLES` | 3 |
| `components/ui/button.tsx` | rewire `hover:bg-muted` → `hover:bg-accent` | 4 |
| `components/ui/avatar.tsx` | Avatar/AvatarImage/AvatarFallback/AvatarGroup | 5 |
| `components/ui/badge.tsx` | Badge (cva variants) | 6 |
| `components/ui/separator.tsx` | Separator | 7 |
| `components/ui/code.tsx` | Code + Kbd | 8 |
| `tests/ui/no-hardcoded-color.test.ts` | token-only assertion over new primitives | 9 |
| `components/design-system/component-showcase.tsx` | consume Badge + show new primitives | 10 |
| `docs/NAMING-CONVENTION.md`, `AGENTS.md` | surface role / 2xs / accent-as-hover / icon note | 11 |
| `docs/HANDOFF.md` | mark milestone done | 12 |

---

## Task 1: Gate fix — `text-2xs` recognized

**Files:** Modify `lib/check/off-token-scale.ts:16`; Test `tests/check/off-token-scale-2xs.test.ts`

- [ ] **Step 1: failing test**
```ts
// tests/check/off-token-scale-2xs.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkOffTokenScale, parseThemeSteps } from "@/lib/check/off-token-scale";

describe("text-2xs is a recognized scale step", () => {
  it("flags text-2xs when --text-2xs is NOT defined in @theme", () => {
    const steps = parseThemeSteps(`@theme inline { --text-xs: 1px; }`); // no 2xs
    const f = checkOffTokenScale(steps, "a.tsx", `<div className="text-2xs" />`);
    expect(f.map((x) => x.rule)).toEqual(["off-token-scale"]);
  });
  it("does NOT flag text-2xs once --text-2xs IS defined", () => {
    const steps = parseThemeSteps(`@theme inline { --text-2xs: 1px; }`);
    const f = checkOffTokenScale(steps, "a.tsx", `<div className="text-2xs" />`);
    expect(f).toEqual([]);
  });
});
```

- [ ] **Step 2: run → FAIL** — `npx vitest run tests/check/off-token-scale-2xs.test.ts` (first test fails: `2xs` not in `VOCAB.text`, so it's silently unflagged).

- [ ] **Step 3: implement** — `lib/check/off-token-scale.ts:16`, prepend `"2xs"`:
```ts
  text: new Set(["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"]),
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: commit**
```bash
git add lib/check/off-token-scale.ts tests/check/off-token-scale-2xs.test.ts
git commit -m "fix(check): recognize text-2xs as a scale step (VOCAB.text)"
```

---

## Task 2: `--fs-2xs` / `--lh-2xs` micro type step

**Files:** Modify `app/globals.css`, `themes/{neutral,swiss,brutalist}.css` (`:root` only — type is not themed per-block); regenerate `design-system.{json,md}`.

Add the step next to `--fs-xs` in each `:root` (the `fs/lh` block). Value: `--fs-2xs: 0.6875rem; --lh-2xs: 0.875rem;`.

- [ ] **Step 1: failing test**
```ts
// tests/tokens/micro-type.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseThemeSteps } from "@/lib/check/off-token-scale";

describe("2xs micro type step", () => {
  it("--text-2xs is wired in globals @theme after tokens regen", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(parseThemeSteps(css).text.has("2xs")).toBe(true);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** — in EACH of `app/globals.css`, `themes/neutral.css`, `themes/swiss.css`, `themes/brutalist.css`, add to the `:root` fs/lh block (right before `--fs-xs`):
```css
  --fs-2xs: 0.6875rem; --lh-2xs: 0.875rem;
```
Then regenerate (auto-wires `--text-2xs` in `@theme` + manifest):
```bash
npm run tokens
```

- [ ] **Step 4: run → PASS.** Also `npm run check` (now green — Task 1 made `text-2xs` valid + the step is defined).

- [ ] **Step 5: commit**
```bash
git add app/globals.css themes/neutral.css themes/swiss.css themes/brutalist.css design-system.json design-system.md tests/tokens/micro-type.test.ts
git commit -m "feat(tokens): add 2xs micro type step (~11px) across themes"
```

---

## Task 3: `--surface` / `--surface-foreground` gated role

**Files:** Modify `lib/tokens/schema.ts` (COLOR_ROLES); `app/globals.css` + `themes/{neutral,swiss,brutalist}.css` (`:root`+`.dark`); regenerate manifest. Test `tests/tokens/surface-role.test.ts`.

Value guidance: `--surface` = a subtle step off that theme's `--background` (neutral: light `oklch(0.985 0 0)`, dark `oklch(0.19 0 0)`; swiss/brutalist: a hair off their `--background`, same hue/chroma). `--surface-foreground` = that theme's body text (`= --foreground` value).

- [ ] **Step 1: failing test**
```ts
// tests/tokens/surface-role.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupForName, partnerOf } from "@/lib/tokens/schema";
import { checkBothTheme } from "@/lib/check/both-theme";
import { checkContrast } from "@/lib/check/contrast";

describe("--surface role", () => {
  const globals = () => readFileSync(resolve("app/globals.css"), "utf8");
  it("classifies as color", () => {
    expect(groupForName("--surface")).toBe("color");
    expect(groupForName("--surface-foreground")).toBe("color");
  });
  it("pairs surface ↔ surface-foreground", () => {
    const present = new Set(["--surface", "--surface-foreground"]);
    expect(partnerOf("--surface", present)).toBe("--surface-foreground");
  });
  it("both-theme: present in both blocks (no findings for surface)", () => {
    expect(checkBothTheme(globals()).filter((f) => f.message.includes("surface"))).toEqual([]);
  });
  it("contrast: surface pair passes AA", () => {
    expect(checkContrast(globals()).filter((f) => f.message.includes("surface"))).toEqual([]);
  });
});
```

- [ ] **Step 2: run → FAIL** (`groupForName("--surface")` throws — not a known role).

- [ ] **Step 3: implement**
  1. `lib/tokens/schema.ts` — add to `COLOR_ROLES` set (after `"ring",`): `"surface", "surface-foreground",`.
  2. Add to BOTH `:root` and `.dark` color blocks (after `--ring`) in each file — **explicit values per theme** (all verified ≥17:1 AA; `tests/themes/contrast.test.ts` checks swiss+brutalist too, so don't guess):
     - **`app/globals.css` + `themes/neutral.css`:** `:root` `--surface: oklch(0.985 0 0); --surface-foreground: oklch(0.145 0 0);` · `.dark` `--surface: oklch(0.19 0 0); --surface-foreground: oklch(0.985 0 0);`
     - **`themes/swiss.css`:** `:root` `--surface: oklch(0.97 0 0); --surface-foreground: oklch(0.145 0 0);` · `.dark` `--surface: oklch(0.2 0 0); --surface-foreground: oklch(0.985 0 0);`
     - **`themes/brutalist.css`:** `:root` `--surface: oklch(0.96 0 0); --surface-foreground: oklch(0 0 0);` · `.dark` `--surface: oklch(0.21 0 0); --surface-foreground: oklch(1 0 0);`
  3. `npm run tokens` (regenerates from `app/globals.css` → auto-wires `--color-surface*` in `@theme` + manifest; theme files carry only `:root`/`.dark` defs, no `@theme`).

- [ ] **Step 4: run → PASS.** `npm run check` green (both-theme + contrast satisfied).

- [ ] **Step 5: commit**
```bash
git add lib/tokens/schema.ts app/globals.css themes/*.css design-system.json design-system.md tests/tokens/surface-role.test.ts
git commit -m "feat(tokens): add gated --surface/--surface-foreground role"
```

---

## Task 4: Activate `--accent` as the hover surface

**Files:** Modify `app/globals.css` + `themes/neutral.css` (tune `--accent`, both blocks); `components/ui/button.tsx`; regenerate manifest. Test `tests/ui/button-hover.test.tsx`.

- [ ] **Step 1: failing test**
```tsx
// tests/ui/button-hover.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("button hover uses the accent surface", () => {
  it("outline + ghost variants hover to bg-accent", () => {
    const { getByText } = render(<><Button variant="outline">O</Button><Button variant="ghost">G</Button></>);
    expect(getByText("O").className).toContain("hover:bg-accent");
    expect(getByText("G").className).toContain("hover:bg-accent");
  });
});
```

- [ ] **Step 2: run → FAIL** (`npx vitest run tests/ui/button-hover.test.tsx`).

- [ ] **Step 3: implement**
  1. `components/ui/button.tsx` — in `outline` (line 14) and `ghost` (line 18): replace `hover:bg-muted` → `hover:bg-accent`, `dark:hover:bg-muted/50` → `dark:hover:bg-accent/50`, **and** `aria-expanded:bg-muted` → `aria-expanded:bg-accent` (consistency with the un-overload goal). Note `swiss`/`brutalist`/neutral all keep `--accent` ≠ `--muted`, so this is a real visual change everywhere.
  2. `app/globals.css` + `themes/neutral.css` — tune `--accent` so it differs from `--muted` (visible hover): `:root` `--accent: oklch(0.94 0 0);` (was 0.97); `.dark` `--accent: oklch(0.32 0 0);` (was 0.269). Leave swiss/brutalist (already distinct).
  3. `npm run tokens` (accent value changed → manifest stale → regen).

- [ ] **Step 4: run → PASS.** `npm run check` green. Sanity: `--accent` ≠ `--muted` in neutral both blocks.

- [ ] **Step 5: commit**
```bash
git add components/ui/button.tsx app/globals.css themes/neutral.css design-system.json design-system.md tests/ui/button-hover.test.tsx
git commit -m "feat(ui): activate --accent as button hover surface (un-overload --muted)"
```

---

## Task 5: Avatar primitive

**Files:** Create `components/ui/avatar.tsx`; Test `tests/ui/avatar.test.tsx`.

- [ ] **Step 1: failing test**
```tsx
// tests/ui/avatar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("renders the initials fallback with an accessible name", () => {
    const { getByText, container } = render(
      <Avatar aria-label="Jane Doe"><AvatarFallback aria-hidden>JD</AvatarFallback></Avatar>
    );
    expect(getByText("JD")).toBeTruthy();
    expect(container.querySelector("[data-slot=avatar]")?.getAttribute("aria-label")).toBe("Jane Doe");
  });
  it("AvatarGroup is a group", () => {
    const { container } = render(<AvatarGroup><Avatar /></AvatarGroup>);
    expect(container.querySelector("[data-slot=avatar-group]")?.getAttribute("role")).toBe("group");
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement**
```tsx
// components/ui/avatar.tsx
import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root data-slot="avatar" className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)} {...props} />
}
function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image data-slot="avatar-image" className={cn("aspect-square size-full object-cover", className)} {...props} />
}
function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return <AvatarPrimitive.Fallback data-slot="avatar-fallback" className={cn("flex size-full items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground", className)} {...props} />
}
/** Stacked group; consumers pass an overflow Avatar with aria-label (e.g. "3 more"). */
function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="avatar-group" role="group" className={cn("flex -space-x-2 [&>[data-slot=avatar]]:ring-2 [&>[data-slot=avatar]]:ring-background", className)} {...props} />
}
export { Avatar, AvatarImage, AvatarFallback, AvatarGroup }
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: commit**
```bash
git add components/ui/avatar.tsx tests/ui/avatar.test.tsx
git commit -m "feat(ui): Avatar/AvatarImage/AvatarFallback/AvatarGroup (radix)"
```

---

## Task 6: Badge primitive (replaces faked status pills)

**Files:** Create `components/ui/badge.tsx`; Test `tests/ui/badge.test.tsx`.

- [ ] **Step 1: failing test**
```tsx
// tests/ui/badge.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("applies the variant data attribute + label text", () => {
    const { getByText } = render(<Badge variant="success">Done</Badge>);
    const el = getByText("Done");
    expect(el.getAttribute("data-variant")).toBe("success");
    expect(el.className).toContain("bg-success");
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement**
```tsx
// components/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        info: "bg-info text-info-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
)
function Badge({ className, variant, asChild = false, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return <Comp data-slot="badge" data-variant={variant ?? "default"} className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { Badge, badgeVariants }
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: commit**
```bash
git add components/ui/badge.tsx tests/ui/badge.test.tsx
git commit -m "feat(ui): Badge with semantic variants"
```

---

## Task 7: Separator primitive

**Files:** Create `components/ui/separator.tsx`; Test `tests/ui/separator.test.tsx`.

- [ ] **Step 1: failing test**
```tsx
// tests/ui/separator.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
  it("renders with the border surface + orientation data", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.querySelector("[data-slot=separator]")!;
    expect(el.getAttribute("data-orientation")).toBe("vertical");
    expect(el.className).toContain("bg-border");
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement**
```tsx
// components/ui/separator.tsx
import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function Separator({ className, orientation = "horizontal", decorative = true, ...props }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      orientation={orientation}
      decorative={decorative}
      className={cn("shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px", className)}
      {...props}
    />
  )
}
export { Separator }
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: commit**
```bash
git add components/ui/separator.tsx tests/ui/separator.test.tsx
git commit -m "feat(ui): Separator (radix)"
```

---

## Task 8: Code + Kbd primitives

**Files:** Create `components/ui/code.tsx`; Test `tests/ui/code.test.tsx`.

- [ ] **Step 1: failing test**
```tsx
// tests/ui/code.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Code, Kbd } from "@/components/ui/code";

describe("Code + Kbd", () => {
  it("Code is a <code> with mono + muted surface", () => {
    const { getByText } = render(<Code>x</Code>);
    const el = getByText("x");
    expect(el.tagName).toBe("CODE");
    expect(el.className).toContain("font-mono");
  });
  it("Kbd uses the 2xs micro step", () => {
    const { getByText } = render(<Kbd>⌘</Kbd>);
    expect(getByText("⌘").className).toContain("text-2xs");
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement**
```tsx
// components/ui/code.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Code({ className, ...props }: React.ComponentProps<"code">) {
  return <code data-slot="code" className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground", className)} {...props} />
}
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return <kbd data-slot="kbd" className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-2xs text-muted-foreground", className)} {...props} />
}
export { Code, Kbd }
```

- [ ] **Step 4: run → PASS.**

- [ ] **Step 5: commit**
```bash
git add components/ui/code.tsx tests/ui/code.test.tsx
git commit -m "feat(ui): Code + Kbd (Kbd consumes 2xs)"
```

---

## Task 9: Token-only dogfood test over new primitives

**Files:** Create `tests/ui/no-hardcoded-color.test.ts`.

`components/ui/` is gate-excluded (`run.ts` `EXCLUDE_DIRS`), so assert directly via the pure check fn.

- [ ] **Step 1: write test**
```ts
// tests/ui/no-hardcoded-color.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const FILES = ["avatar", "badge", "separator", "code"].map((n) => `components/ui/${n}.tsx`);

describe("new ui primitives are token-only (no hardcoded colors)", () => {
  for (const f of FILES) {
    it(f, () => {
      expect(checkHardcodedColor(f, readFileSync(resolve(f), "utf8"))).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: run → PASS** (the components above use only token utilities). If any fails, fix the component to use tokens.

- [ ] **Step 3: commit**
```bash
git add tests/ui/no-hardcoded-color.test.ts
git commit -m "test(ui): new primitives carry no hardcoded colors"
```

---

## Task 10: Showcase — consume Badge + show new primitives

**Files:** Modify `components/design-system/component-showcase.tsx`.

- [ ] **Step 1: implement** — replace the faked `Status (token utilities)` `<span>` block (lines 42-55) with `Badge` usage, and add Avatar / Separator / Code+Kbd groups:
```tsx
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Code, Kbd } from "@/components/ui/code";
// ...
<Group label="Badges">
  <Badge>Default</Badge>
  <Badge variant="secondary">Secondary</Badge>
  <Badge variant="success"><span className="size-1.5 rounded-full bg-current" />Done</Badge>
  <Badge variant="warning"><span className="size-1.5 rounded-full bg-current" />In progress</Badge>
  <Badge variant="info">Info</Badge>
  <Badge variant="destructive">Error</Badge>
  <Badge variant="outline">Outline</Badge>
</Group>
<Group label="Avatars">
  <Avatar aria-label="Jane Doe"><AvatarFallback aria-hidden>JD</AvatarFallback></Avatar>
  <AvatarGroup>
    <Avatar aria-label="A"><AvatarFallback aria-hidden>A</AvatarFallback></Avatar>
    <Avatar aria-label="B"><AvatarFallback aria-hidden>B</AvatarFallback></Avatar>
    <Avatar aria-label="2 more"><AvatarFallback aria-hidden>+2</AvatarFallback></Avatar>
  </AvatarGroup>
</Group>
<Group label="Inline code & keys">
  <span className="text-sm text-foreground">Run <Code>npm run tokens</Code> or press <Kbd>⌘</Kbd> <Kbd>K</Kbd></span>
</Group>
<Group label="Separator">
  <div className="flex h-5 items-center gap-3 text-sm text-muted-foreground">Docs <Separator orientation="vertical" /> API <Separator orientation="vertical" /> Blog</div>
</Group>
```
(Status dots use `bg-current` — inherits the badge's foreground, not a hardcoded color; the label always carries the meaning.)

- [ ] **Step 2: verify** — `npm run check` green (showcase is scanned; ensure no arbitrary/hardcoded classes — `size-1.5`/`bg-current` are fine). `npm run build` compiles.

- [ ] **Step 3: commit**
```bash
git add components/design-system/component-showcase.tsx
git commit -m "docs(design-system): showcase Badge/Avatar/Separator/Code+Kbd (Badge replaces faked pills)"
```

---

## Task 11: Docs — naming convention + icon note

**Files:** Modify `docs/NAMING-CONVENTION.md`, `AGENTS.md`.

- [ ] **Step 1: implement**
  - `NAMING-CONVENTION.md`: document the `surface`/`surface-foreground` role (subtle panel surface), the `2xs` step (extend bottom of the type scale), and that `--accent`/`--accent-foreground` is the **hover/active surface** (must differ from `--muted`).
  - `AGENTS.md` (inside the `design-system` block): add an **Icons** line — "Bundled icon set: `@untitled-ui/icons-react` (1173 icons), default `size-4`, color via `text-*` tokens. (`lucide-react` is present but a broken version — do not use.)"

- [ ] **Step 2: verify** — `npx vitest run tests/surfaces.test.ts` green (AGENTS.md edit stays inside the design-system block; doesn't break the inline-guard).

- [ ] **Step 3: commit**
```bash
git add docs/NAMING-CONVENTION.md AGENTS.md
git commit -m "docs: document surface role, 2xs step, accent-as-hover, icon set"
```

---

## Task 12: Verify + proof + HANDOFF

- [ ] **Step 1: full gate** — `npm run verify` (`check && test && lint && build`) → all green. Then `npx playwright test` → green (note the known `editor.spec.ts` flake under load; re-run isolated if needed).

- [ ] **Step 2: proof (the dogfood)** — build a throwaway token-only `/preview-app` page recreating the dense Linear-style layout using the REAL new primitives (Avatar/Badge/Separator/Code/Kbd) + `bg-surface`/`text-2xs`/`bg-accent` hovers — **no hand-rolled workarounds, no arbitrary classes**. Screenshot light+dark into `e2e/__shots__/` (gitignored). Read to self-critique; confirm the gaps are closed. **Do not commit the throwaway page** (explicit-path commits only).

- [ ] **Step 3: HANDOFF** — add a "Dense-UI hardening DONE 2026-06-28" entry to `docs/HANDOFF.md` (new tokens: `--surface`/`--surface-foreground`, `2xs`, `--accent` activated; new primitives; token count updated). Commit `docs/HANDOFF.md`.

- [ ] **Step 4: merge** — with user go-ahead, `npm run verify` once more on the merged result, `--no-ff` to main, delete branch. **Then the 5-theme suite is the next milestone** (each new theme must define `--surface`/`--surface-foreground`/`2xs` + keep `--accent` ≠ `--muted`).

---

## Notes for the executor
- **`npm run tokens` after ANY token edit** — value changes (like `--accent`) make the manifest stale → `manifest-fresh` red until regenerated; stage `design-system.{json,md}` with the change.
- **All 4 theme surfaces** (globals + neutral + swiss + brutalist) must carry every new COLOR token in BOTH blocks or `both-theme`/`parity`/`contrast` go red. Note: `npm run check`'s `both-theme`+`contrast` read **only `app/globals.css`**; the THEME files (swiss/brutalist) are gated by `tests/themes/{parity,contrast}.test.ts` (run via `npm test`) — so a missing/under-contrast theme token reds the **test suite**, not `npm run check`. The `2xs` type step is `:root`-only (type isn't themed per-block).
- **`npm run tokens` regenerates from `app/globals.css` alone** (the only file with an `@theme inline` block); theme files just hold `:root`/`.dark` value-sets applied later via `npm run theme`.
- **`next build` is load-bearing** — always `npm run verify`, never just check+test.
- **Radix unified import** — `import { Avatar } from "radix-ui"`, matching `button.tsx`'s `import { Slot } from "radix-ui"`. Not `@radix-ui/react-*`.
- **Shared-tree hazard** — never `git checkout <paths>` to discard; use `git restore` after confirming identity.
