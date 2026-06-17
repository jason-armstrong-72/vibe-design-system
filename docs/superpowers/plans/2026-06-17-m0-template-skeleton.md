# M0 — Template Skeleton + Naming Convention Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Next.js 16 + Tailwind v4 + shadcn starter whose `globals.css` is the single source of truth for an OKLCH token system, with default palettes/scales cleared so off-token utilities fail to compile, and a written naming convention every later milestone keys on.

**Architecture:** Tailwind v4 CSS-first. `globals.css` holds two layers — (1) runtime token vars in `:root`/`.dark` (the editable source of truth), (2) an `@theme inline` block that clears default namespaces and maps each token into Tailwind's utility namespace *through* `var()` so runtime edits repaint with no rebuild. Colors are OKLCH. Spacing is a single `--spacing-base` multiplier knob (v4 model).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui (v4 CLI), `tw-animate-css`, Vitest, Playwright, Node 20+.

**Scope note:** This is M0 of the spec at [docs/specs/2026-06-16-design-system-starter-design.md](../../specs/2026-06-16-design-system-starter-design.md). M1–M6 are separate plans, written once M0 lands. M0's done-criteria (spec §10): `npm run dev` shows a themed shadcn app, `bg-red-500` fails to compile, the naming convention is documented.

**Repo note:** Code home = **this repo** (`vibe-design-system`) — it is empty except `docs/`, clean, and aptly named. The spec's "new standalone repo" language predates this repo; treat this as that repo. If the user instead wants a separate repo, only Task 1's location changes.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts` | scaffold config (generated) |
| `app/globals.css` | **SOURCE OF TRUTH** — token vars (`:root`/`.dark`) + `@theme inline` (clears + mapping) + `tw-animate-css` import |
| `app/layout.tsx`, `app/page.tsx` | minimal themed shell that proves tokens render |
| `components/ui/*` | shadcn components installed by CLI (token-themed) |
| `lib/utils.ts` | shadcn `cn()` helper (generated) |
| `lib/fonts.ts` | bundled next/font setup (shared font set the themes draw from — §13) |
| `docs/NAMING-CONVENTION.md` | **the written token-naming contract** every later milestone keys on |
| `tests/compile-gate.test.ts` | asserts `bg-red-500` fails / `bg-primary` succeeds under the real Tailwind build |
| `tailwind.config.ts` | optional, near-empty (content globs only — NO token mapping) |
| `vitest.config.ts` | test runner config |

Decomposition rationale: `globals.css` is the one load-bearing file; the naming doc and the compile-gate test exist to *lock and prove* its structure so M1–M6 build on a fixed contract.

---

## Task 1: Scaffold Next.js 16 + Tailwind v4 + shadcn

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `lib/utils.ts` (all via CLI)

- [ ] **Step 1: Scaffold the Next app (non-interactive)**

Run from repo root (the dir already contains `docs/`, `README.md`, `.gitignore` — scaffold in place):

```bash
npx create-next-app@latest . \
  --ts --eslint --app --tailwind --src-dir=false \
  --import-alias "@/*" --use-npm --no-turbopack --yes
```

Expected: Next 16.x installed, `app/`, `tailwind` v4 wired, `app/globals.css` present with `@import "tailwindcss";`. If the CLI refuses because the dir is non-empty, move `docs/` aside, scaffold, move it back — do NOT delete `docs/`.

- [ ] **Step 2: Pin and verify versions**

Run:

```bash
node -e "const p=require('./package.json');console.log(p.dependencies.next, p.dependencies.react, p.devDependencies.tailwindcss)"
```

Expected: `next` `16.x`, `react` `19.x`, `tailwindcss` `4.x`. If Tailwind is v3, stop — the whole plan assumes v4; re-scaffold or upgrade per https://tailwindcss.com/docs/upgrade-guide before continuing.

- [ ] **Step 3: Init shadcn (v4) + install the base components**

```bash
npx shadcn@latest init --yes --base-color neutral
npx shadcn@latest add button input card --yes
```

Expected: `components/ui/{button,input,card}.tsx`, `lib/utils.ts`, and shadcn's OKLCH token block written into `app/globals.css`. `tw-animate-css` added as a dependency and `@import "tw-animate-css";` added to `globals.css` (shadcn v4 default). If it instead added `tailwindcss-animate`, remove it and install `tw-animate-css` (Task 3 Step 4 covers this).

- [ ] **Step 4: Confirm dev server boots**

Run:

```bash
npm run dev &
sleep 6 && curl -sf http://localhost:3000 >/dev/null && echo "BOOT OK"; kill %1
```

Expected: `BOOT OK`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): scaffold Next 16 + Tailwind v4 + shadcn base"
```

---

## Task 2: Write the naming-convention contract

This task is **documentation that locks the API** (spec §3: "token names are the contract"). No code yet — but everything downstream keys on it, so it comes before authoring tokens.

**Files:**
- Create: `docs/NAMING-CONVENTION.md`

- [ ] **Step 1: Write the convention doc**

Create `docs/NAMING-CONVENTION.md` verbatim:

```markdown
# Token Naming Convention (the contract)

The lint, manifest generator, schema, and editor all key on these names. Changing a
name is a breaking change to the design system's API. Pin once; change deliberately.

## Layers
- **Runtime layer** (`:root`, `.dark` in `app/globals.css`): the authored, editable
  values. Base names below. The editor and manifest read/write ONLY this layer.
- **Utility layer** (`@theme inline` in `app/globals.css`): maps a base name into a
  Tailwind namespace, e.g. `--color-primary: var(--primary)`. Never edited at runtime.

## Rules
1. **Colors** use shadcn semantic names, kebab-case: `--<role>` and its paired
   `--<role>-foreground`. Roles: background, foreground, card, popover, primary,
   secondary, muted, accent, destructive, success, warning, info, border, input, ring.
   Color VALUES are always `oklch(...)`.
2. **Ramps** (open-ended scales) use numeric steps: `--<name>-<step>`,
   steps 50,100,200,…,900,950. Ramps in v1: `--brand-*`.
3. **Charts**: `--chart-1 … --chart-5`.
4. **Type size**: base name `--fs-<step>` (xs,sm,base,lg,xl,2xl,3xl,4xl), mapped to
   `--text-<step>`. Each size has a paired line-height `--lh-<step>` mapped to
   `--text-<step>--line-height`.
5. **Font family**: `--font-sans`, `--font-mono` (mapped 1:1 to the `--font-*` namespace).
6. **Font weight**: `--fw-<name>` (normal,medium,semibold,bold) → `--font-weight-<name>`.
7. **Radius**: single knob `--radius`; sm/md/lg/xl are DERIVED via calc in `@theme inline`
   (shadcn pattern) — not authored.
8. **Border width**: `--border-width-<size>` (thin,base,thick) → `border-<size>` utility.
    Plain `:root` vars + `@utility` helpers; not a Tailwind namespace.
9. **Shadow**: `--elevation-<size>` (sm,md,lg) → `--shadow-<size>`.
10. **Motion**: `--duration-<speed>` (fast,base,slow); easing `--ease-<name>`
    (standard,in,out) → `--ease-<name>`.
11. **Spacing**: ONE knob, `--spacing-base`, mapped to the `--spacing` multiplier.
    There is NO discrete `--space-N`. The whole numeric scale derives from it.
12. **Z-index**: `--z-<role>` (dropdown,sticky,modal,toast). Plain `:root` vars +
    `@utility` helpers; not a Tailwind namespace.
13. **Opacity**: `--opacity-<role>` (disabled,muted). Same treatment as z-index.
14. **Container**: `--container-<size>` (sm,md,lg) → `--container-<size>` namespace.
15. **Breakpoints**: `--breakpoint-<size>` in `@theme` — documented reference, NOT
    runtime-editable (CSS media queries can't read runtime vars).

## fg/bg pairing
Every color with a `-foreground` counterpart is a pair. The schema (M1) models these as
pairs so a WCAG contrast check (fast-follow) needs no re-modeling.
```

- [ ] **Step 2: Commit**

```bash
git add docs/NAMING-CONVENTION.md
git commit -m "docs(m0): pin token naming convention (the contract)"
```

---

## Task 2.5: Bundle the shared fonts (next/font)

M0 introduces the shared bundled-font setup (§13 / DESIGN-BRIEF.md). The Neutral default uses a clean sans + mono; M3a adds serif/display faces for other themes. The `--font-sans`/`--font-mono` tokens reference next/font CSS variables, so a theme swap can repoint them.

**Files:**
- Create: `lib/fonts.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Declare the bundled fonts**

Create `lib/fonts.ts` (Inter for sans, Geist Mono — both Google fonts via next/font; expose stable CSS-var names the tokens reference):

```ts
import { Inter, Geist_Mono } from "next/font/google";

export const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-bundled-sans",
  display: "swap",
});

export const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-bundled-mono",
  display: "swap",
});

/** className string applied to <html> so the --font-bundled-* vars exist globally. */
export const fontVars = `${fontSans.variable} ${fontMono.variable}`;
```

- [ ] **Step 2: Apply the font vars on `<html>`**

In `app/layout.tsx`, import `fontVars` and add it to the `<html>` className (alongside any existing class):

```tsx
import { fontVars } from "@/lib/fonts";
// ...
<html lang="en" className={fontVars}>
```

- [ ] **Step 3: Verify the font vars resolve**

Run:

```bash
npm run build
```

Expected: build succeeds. (Visual font proof comes with the smoke page, Task 5.) If next/font errors on the font name, swap to an available Google font (e.g. `Geist` for sans) and update `lib/fonts.ts` + the token fallback names to match.

- [ ] **Step 4: Commit**

```bash
git add lib/fonts.ts app/layout.tsx
git commit -m "feat(m0): bundle shared fonts (next/font) — sans + mono"
```

---

## Task 3: Author `globals.css` — the source of truth

Replace shadcn's generated token block with the full curated v1 token set, the cleared namespaces, and the `@theme inline` mapping. This is the load-bearing file.

**Files:**
- Modify: `app/globals.css` (full rewrite of everything after the imports)

- [ ] **Step 1: Write the runtime token layer (`:root` + `.dark`)**

Set `app/globals.css` to (top of file; mapping/clears added next step). OKLCH values below are a coherent neutral-slate light/dark theme — adjust hues later via the editor, names are the contract:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* ---- color: semantic (OKLCH) ---- */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  /* ---- color: status (fills shadcn gap) ---- */
  --success: oklch(0.62 0.17 145);
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.79 0.16 80);
  --warning-foreground: oklch(0.205 0 0);
  --info: oklch(0.62 0.17 250);
  --info-foreground: oklch(0.985 0 0);
  /* ---- color: form/border ---- */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  /* ---- color: brand ramp ---- */
  --brand-50: oklch(0.97 0.02 250);
  --brand-100: oklch(0.93 0.04 250);
  --brand-200: oklch(0.88 0.07 250);
  --brand-300: oklch(0.81 0.10 250);
  --brand-400: oklch(0.72 0.14 250);
  --brand-500: oklch(0.62 0.17 250);
  --brand-600: oklch(0.54 0.16 250);
  --brand-700: oklch(0.46 0.14 250);
  --brand-800: oklch(0.39 0.11 250);
  --brand-900: oklch(0.33 0.08 250);
  --brand-950: oklch(0.24 0.05 250);
  /* ---- color: charts ---- */
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);

  /* ---- typography (font vars come from next/font, see Task 2.5) ---- */
  --font-sans: var(--font-bundled-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-bundled-mono), ui-monospace, SFMono-Regular, monospace;
  --fs-xs: 0.75rem;   --lh-xs: 1rem;
  --fs-sm: 0.875rem;  --lh-sm: 1.25rem;
  --fs-base: 1rem;    --lh-base: 1.5rem;
  --fs-lg: 1.125rem;  --lh-lg: 1.75rem;
  --fs-xl: 1.25rem;   --lh-xl: 1.75rem;
  --fs-2xl: 1.5rem;   --lh-2xl: 2rem;
  --fs-3xl: 1.875rem; --lh-3xl: 2.25rem;
  --fs-4xl: 2.25rem;  --lh-4xl: 2.5rem;
  --fw-normal: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;

  /* ---- radius (single knob; sm/md/lg derived in @theme) ---- */
  --radius: 0.625rem;

  /* ---- border widths ---- */
  --border-width-thin: 1px;
  --border-width-base: 2px;
  --border-width-thick: 4px;

  /* ---- shadow ---- */
  --elevation-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
  --elevation-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
  --elevation-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);

  /* ---- motion ---- */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 400ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);

  /* ---- spacing knob (v4 multiplier) ---- */
  --spacing-base: 0.25rem;

  /* ---- z-index ---- */
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-modal: 1300;
  --z-toast: 1400;

  /* ---- opacity ---- */
  --opacity-disabled: 0.5;
  --opacity-muted: 0.7;

  /* ---- container widths ---- */
  --container-sm: 40rem;
  --container-md: 48rem;
  --container-lg: 64rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --success: oklch(0.7 0.16 145);
  --success-foreground: oklch(0.205 0 0);
  --warning: oklch(0.83 0.15 80);
  --warning-foreground: oklch(0.205 0 0);
  --info: oklch(0.7 0.15 250);
  --info-foreground: oklch(0.205 0 0);
  --border: oklch(1 0 0 / 0.1);
  --input: oklch(1 0 0 / 0.15);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  /* brand ramp, type, radius, shadow, motion, spacing, z, opacity, container
     inherit from :root unless a dark override is needed. Add overrides here as needed. */
}
```

- [ ] **Step 2: Append the `@theme inline` layer (clears + mapping)**

Append to `app/globals.css`:

```css
@theme inline {
  /* clear default namespaces so off-token utilities fail to compile */
  --color-*: initial;
  --text-*: initial;
  --font-weight-*: initial;
  --shadow-*: initial;
  --radius-*: initial;
  --ease-*: initial;
  --container-*: initial;

  /* color mapping */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-brand-50: var(--brand-50);
  --color-brand-100: var(--brand-100);
  --color-brand-200: var(--brand-200);
  --color-brand-300: var(--brand-300);
  --color-brand-400: var(--brand-400);
  --color-brand-500: var(--brand-500);
  --color-brand-600: var(--brand-600);
  --color-brand-700: var(--brand-700);
  --color-brand-800: var(--brand-800);
  --color-brand-900: var(--brand-900);
  --color-brand-950: var(--brand-950);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  /* type mapping (size + paired line-height) */
  --text-xs: var(--fs-xs);     --text-xs--line-height: var(--lh-xs);
  --text-sm: var(--fs-sm);     --text-sm--line-height: var(--lh-sm);
  --text-base: var(--fs-base); --text-base--line-height: var(--lh-base);
  --text-lg: var(--fs-lg);     --text-lg--line-height: var(--lh-lg);
  --text-xl: var(--fs-xl);     --text-xl--line-height: var(--lh-xl);
  --text-2xl: var(--fs-2xl);   --text-2xl--line-height: var(--lh-2xl);
  --text-3xl: var(--fs-3xl);   --text-3xl--line-height: var(--lh-3xl);
  --text-4xl: var(--fs-4xl);   --text-4xl--line-height: var(--lh-4xl);

  --font-weight-normal: var(--fw-normal);
  --font-weight-medium: var(--fw-medium);
  --font-weight-semibold: var(--fw-semibold);
  --font-weight-bold: var(--fw-bold);

  /* radius: knob + derived steps (shadcn pattern) */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* shadow */
  --shadow-sm: var(--elevation-sm);
  --shadow-md: var(--elevation-md);
  --shadow-lg: var(--elevation-lg);

  /* motion easings */
  --ease-standard: var(--ease-standard);
  --ease-in: var(--ease-in);
  --ease-out: var(--ease-out);

  /* spacing multiplier (single knob) */
  --spacing: var(--spacing-base);

  /* container widths */
  --container-sm: var(--container-sm);
  --container-md: var(--container-md);
  --container-lg: var(--container-lg);

  /* breakpoints: documented reference, not runtime-editable */
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
}

/* border-width + z-index + opacity: not Tailwind namespaces — expose as utilities */
@utility border-thin  { border-width: var(--border-width-thin); }
@utility border-base  { border-width: var(--border-width-base); }
@utility border-thick { border-width: var(--border-width-thick); }
@utility z-dropdown { z-index: var(--z-dropdown); }
@utility z-sticky   { z-index: var(--z-sticky); }
@utility z-modal    { z-index: var(--z-modal); }
@utility z-toast    { z-index: var(--z-toast); }
@utility opacity-disabled { opacity: var(--opacity-disabled); }
@utility opacity-muted    { opacity: var(--opacity-muted); }

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
}
```

> NOTE on the `--container-*` and `--ease-*` self-references (`--container-sm: var(--container-sm)`): the LEFT side is the `@theme` namespace var; the RIGHT side is the runtime `:root` var of the same name. This works because `@theme inline` resolves the right side against `:root`. If the build errors on a circular reference, rename the runtime vars to `--ctr-sm` / `--motion-ease-standard` and update the mapping. Verify in Task 4.

- [ ] **Step 3: Verify the build compiles and tokens resolve**

```bash
npm run build
```

Expected: build SUCCEEDS. If it fails on a circular `@theme inline` self-reference, apply the rename in the NOTE above and rebuild.

- [ ] **Step 4: Confirm `tw-animate-css`, not the deprecated package**

```bash
grep -q 'tw-animate-css' app/globals.css && echo "ANIMATE OK"
! grep -q 'tailwindcss-animate' package.json app/globals.css && echo "NO DEPRECATED ANIMATE"
```

Expected: both lines print. If `tailwindcss-animate` is present, run `npm rm tailwindcss-animate && npm i tw-animate-css` and fix the `@import`.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css package.json package-lock.json
git commit -m "feat(m0): author globals.css token source of truth (OKLCH, cleared namespaces)"
```

---

## Task 4: Compile-gate test — off-token utilities fail, tokens succeed

Proves the load-bearing claim: cleared namespaces make `bg-red-500` a build error, while `bg-primary` compiles. This test is the executable contract for spec §6.2's compile-gate.

**Files:**
- Create: `tests/compile-gate.test.ts`
- Create/Modify: `vitest.config.ts`, `package.json` (add `test` script)

- [ ] **Step 1: Add Vitest + minimal config**

```bash
npm i -D vitest @tailwindcss/node
```

Add to `package.json` `scripts`: `"test": "vitest run"`. Create `vitest.config.ts`. **The `@` alias is required** — later milestones (M1+) import via `@/lib/...`, and Vitest does NOT read `tsconfig.json` `paths` by default. Without this alias every future test fails with `Cannot find package '@/...'`:

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: { include: ["tests/**/*.test.ts"] },
});
```

- [ ] **Step 2: Write the failing test**

The test invokes the real Tailwind compiler against two tiny source snippets and asserts the class presence in output. Create `tests/compile-gate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { compile } from "@tailwindcss/node";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve("app/globals.css"), "utf8");

async function utilitiesFor(classes: string[]): Promise<string> {
  // compile globals.css, then ask Tailwind to generate the given candidate classes
  const compiler = await compile(css, { base: process.cwd() });
  return compiler.build(classes);
}

describe("compile gate", () => {
  it("generates a utility for an in-system token class", async () => {
    const out = await utilitiesFor(["bg-primary"]);
    expect(out).toContain("--color-primary");
  });

  it("does NOT generate a utility for a cleared default-palette class", async () => {
    const out = await utilitiesFor(["bg-red-500"]);
    expect(out).not.toContain("bg-red-500");
  });
});
```

- [ ] **Step 3: Run — expect a FAIL first (TDD: prove the test can fail)**

Run:

```bash
npx vitest run tests/compile-gate.test.ts
```

Expected: the FIRST run may fail if the `@tailwindcss/node` `compile` API signature differs in the installed v4 version. If so, fix the harness against the installed API (check `node_modules/@tailwindcss/node`), not the assertions. The assertions encode the requirement; keep them. Re-run until the test executes and the `bg-primary` assertion PASSES and — temporarily comment the second test, prove the first passes, then restore.

> If `@tailwindcss/node`'s programmatic API proves unstable, fall back to a CLI-based harness: write the two candidate sets to temp files, run `npx @tailwindcss/cli -i app/globals.css --content <tmp> -o <out>`, and grep the output. Same assertions.

- [ ] **Step 4: Run to verify both pass**

Run:

```bash
npm test
```

Expected: 2 passed. `bg-primary` → output contains `--color-primary`; `bg-red-500` → output contains no `red`.

- [ ] **Step 5: Commit**

```bash
git add tests/compile-gate.test.ts vitest.config.ts package.json package-lock.json
git commit -m "test(m0): compile-gate — off-token utilities fail, tokens compile"
```

---

## Task 5: Themed smoke page + M0 done-check

Prove `npm run dev` shows a themed shadcn app driven by the tokens, in both light and dark.

**Files:**
- Modify: `app/page.tsx`, `app/layout.tsx`

- [ ] **Step 1: Render a minimal token-driven page**

Set `app/page.tsx` to render shadcn components that exercise the new tokens (primary button, status colors, card, type scale):

```tsx
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="p-8 flex flex-col gap-6">
      <h1 className="text-4xl font-bold text-foreground">Design System Starter</h1>
      <p className="text-base text-muted-foreground">Themed entirely from globals.css tokens.</p>
      <div className="flex gap-3">
        <Button>Primary</Button>
        <Button className="bg-success text-success-foreground">Success</Button>
        <Button className="bg-warning text-warning-foreground">Warning</Button>
        <Button className="bg-info text-info-foreground">Info</Button>
      </div>
      <Card className="p-6 shadow-md rounded-lg max-w-md">
        <p className="text-lg">Card on <code className="font-mono">--card</code>, radius from <code className="font-mono">--radius</code>.</p>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Verify dev render + a token actually drives a color**

Run:

```bash
npm run dev &
sleep 6
curl -sf http://localhost:3000 | grep -q "Design System Starter" && echo "RENDER OK"
kill %1
```

Expected: `RENDER OK`. (Visual/repaint proof is M4's Playwright job; M0 only needs the page to render.)

- [ ] **Step 3: Run the full M0 gate**

Run:

```bash
npm run build && npm test
```

Expected: build succeeds (so `bg-success`/`bg-warning`/`bg-info` are real utilities — proves status tokens wired) AND 2 tests pass (proves `bg-red-500` would NOT). This is the M0 done-criteria, mechanized.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat(m0): themed smoke page; M0 done — themed app, off-token fails, convention documented"
```

---

## M0 Done Criteria (spec §10)

- [ ] `npm run dev` shows a themed shadcn app (Task 5 Step 2).
- [ ] `bg-red-500` fails to compile / generates nothing; `bg-primary` compiles (Task 4).
- [ ] Naming convention documented at `docs/NAMING-CONVENTION.md` (Task 2).
- [ ] `globals.css` holds all token groups, light + dark, OKLCH, with `@theme inline` mapping + cleared namespaces + `tw-animate-css` (Task 3).

## Hand-off to M1

M1 (Token write-core) parses/rewrites the `:root` and `.dark` blocks authored here. The base-name convention (Task 2) and the exact block structure (Task 3) are M1's fixtures. Do not change token names after M0 without updating `docs/NAMING-CONVENTION.md` and every downstream fixture.
