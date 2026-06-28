# Primitive Coverage + Component Catalog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans. TDD, one commit per task, NOT via ad-hoc edits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship ~19 token-only interaction primitives (overlay/form/nav/feedback) + one new `--overlay` scrim token + an auto-generated, gate-enforced component catalog so an LLM reaches for `<Dialog>` instead of hand-rolling a div, proven by two permanent dogfood screens.

**Architecture:** Each primitive is a thin, hand-authored wrapper over the already-installed unified `radix-ui` (or `sonner`/`cmdk`), styled with design-system tokens only, following the house convention in `components/ui/button.tsx` (`cva` where variants exist, `data-slot`, `React.ComponentProps`, **no `forwardRef`**, `cn`). A typed catalog registry + generator emit `design-system.components.md`; a `catalog-fresh` gate (mirroring `manifest-fresh`) fails the build if any exported primitive lacks a registry entry. The `components/ui` dir is gate-excluded at the walk level, so a direct-scan test (`checkHardcodedColor`) keeps every primitive token-clean.

**Tech Stack:** Next 16 / React 19 / Tailwind v4 CSS-first OKLCH tokens, `radix-ui` (unified, v1.6.0), `sonner`, `cmdk`, `cva`, `vitest`/jsdom + `@testing-library/react`, `@untitled-ui/icons-react`, Playwright.

**Spec:** [docs/superpowers/specs/2026-06-28-primitive-coverage-design.md](../specs/2026-06-28-primitive-coverage-design.md)

**Prereqs:** branch `primitive-coverage` (off main; spec already committed there). Baseline: `npm test` green, `npm run check` green, `npm run verify` green.

---

## House conventions (every primitive task obeys these — DRY reference)

1. **Import Radix from the unified package:** `import { Dialog as DialogPrimitive } from "radix-ui"` — NEVER `@radix-ui/react-dialog`.
2. **No `forwardRef`.** Function components taking `React.ComponentProps<typeof X>` (or `React.ComponentProps<"tag">`). Spread `{...props}`.
3. **`data-slot="<kebab-name>"`** on every rendered element. `data-variant`/`data-size` when a cva variant/size exists.
4. **Token-only classes.** Allowed surfaces: `bg-background|card|popover|muted|secondary|accent|primary|destructive|surface`, text `text-foreground|muted-foreground|*-foreground`, borders `border-border|input`, focus `ring-ring`/`ring-[3px]`, scrim `bg-overlay`. **Never** a hardcoded color (`bg-black/50`, `#fff`, `oklch(...)`, `text-gray-500`) — the no-hardcoded-color test will fail. Animations via `tw-animate-css` (`animate-in`, `fade-in-0`, `data-[state=open]:...`) are class-only and fine.
5. **`cn` from `@/lib/utils`.**
6. **Each task:** failing test → run (FAIL) → implement component → add/extend its catalog registry entry → `npm run catalog` (regenerates `design-system.components.md`) → run test (PASS) → `npm run check` green (catalog-fresh + no-hardcoded via test) → commit (component + test + `lib/catalog/registry.ts` + `design-system.components.md`).
7. **Commit message footer (every commit):**
   ```
   Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
   ```

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `lib/tokens/schema.ts` | add `overlay` to `COLOR_ROLES` | 0 |
| `app/globals.css` + `themes/{neutral,swiss,brutalist}.css` | `--overlay` (both blocks) | 0 |
| `lib/catalog/registry.ts` | typed `CATALOG` array — one entry per primitive (lists its exports) | 1, every primitive |
| `lib/catalog/generate.ts` | `buildCatalogMarkdown(CATALOG)` pure fn | 1 |
| `lib/catalog/exports.ts` | `exportsOf(content)` — Capitalized exported symbols | 1 |
| `lib/check/catalog-fresh.ts` | `checkCatalogFresh(uiFiles, committedMd)` gate | 1 |
| `lib/check/run.ts` | wire `catalog-fresh` into `system[]` | 1 |
| `scripts/generate-catalog.ts` | writes `design-system.components.md` | 1 |
| `design-system.components.md` | generated catalog (committed) | 1, every primitive |
| `tests/ui/no-hardcoded-color.test.ts` | dir-glob ALL `components/ui/*.tsx` | 1 |
| `package.json` | `catalog` script; `sonner` + `cmdk` deps | 1, 18 |
| `components/ui/{dialog,alert-dialog,sheet,popover,tooltip,dropdown-menu}.tsx` | overlay batch | 2–7 |
| `components/ui/{label,checkbox,radio-group,switch,select,textarea,form}.tsx` | form batch | 8–14 |
| `components/ui/{tabs,accordion,table}.tsx` | nav batch | 15–17 |
| `components/ui/{sonner,skeleton,command}.tsx` | feedback batch | 19–21 |
| `components/design-system/component-showcase.tsx` | live demos | 22 |
| `app/settings/page.tsx` | permanent reference screen | 23 |
| `app/preview-app/page.tsx` | promote + rewire to real primitives | 24 |
| `docs/NAMING-CONVENTION.md`, `AGENTS.md`, `design-system.md` | `--overlay`, catalog pointer | 1, 25 |
| `docs/HANDOFF.md` | milestone done | 25 |

---

## Task 0: `--overlay` scrim token

**Files:** Modify `lib/tokens/schema.ts`; `app/globals.css` + `themes/{neutral,swiss,brutalist}.css` (both blocks); regenerate manifest. Test `tests/tokens/overlay-role.test.ts`.

- [ ] **Step 1: failing test**
```ts
// tests/tokens/overlay-role.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupForName } from "@/lib/tokens/schema";
import { checkBothTheme } from "@/lib/check/both-theme";

describe("--overlay scrim token", () => {
  it("classifies as color", () => {
    expect(groupForName("--overlay")).toBe("color");
  });
  it("both-theme: present in both blocks (no overlay findings)", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(checkBothTheme(css).filter((f) => f.message.includes("overlay"))).toEqual([]);
  });
  it("--color-overlay is wired in @theme after tokens regen", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(css).toContain("--color-overlay: var(--overlay)");
  });
});
```

- [ ] **Step 2: run → FAIL** — `npx vitest run tests/tokens/overlay-role.test.ts` (groupForName throws / not wired).

- [ ] **Step 3: implement**
  1. `lib/tokens/schema.ts` `COLOR_ROLES` — after `"surface", "surface-foreground",` add `"overlay",` (standalone role, no `-foreground` pair, like `border`/`input`/`ring`).
  2. Add to BOTH blocks of all 4 files, after the `--ring`/`--surface*` color block. **Values (dark translucent veil; light needs ~0.5, dark needs heavier ~0.7 to read against a dark page):**
     - **`app/globals.css` + `themes/neutral.css`:** `:root` `--overlay: oklch(0 0 0 / 0.5);` · `.dark` `--overlay: oklch(0 0 0 / 0.7);`
     - **`themes/swiss.css`:** `:root` `--overlay: oklch(0 0 0 / 0.5);` · `.dark` `--overlay: oklch(0 0 0 / 0.7);`
     - **`themes/brutalist.css`:** `:root` `--overlay: oklch(0 0 0 / 0.6);` · `.dark` `--overlay: oklch(0 0 0 / 0.75);` (brutalist runs higher-contrast)
  3. `npm run tokens` (auto-wires `--color-overlay` + manifest).

- [ ] **Step 4: run → PASS.** `npm run check` green. `npx vitest run tests/themes` green (parity: overlay now in all 3 theme files both blocks).

- [ ] **Step 5: commit**
```bash
git add lib/tokens/schema.ts app/globals.css themes/*.css design-system.json design-system.md tests/tokens/overlay-role.test.ts
git commit -m "feat(tokens): add --overlay scrim role for dialog/sheet backdrops"
```

---

## Task 1: Catalog infrastructure + `catalog-fresh` gate (against existing primitives)

Scaffold the catalog mechanism and make it **green against the current 8 primitives** before adding any new ones. Also convert the no-hardcoded-color test to dir-glob so every future primitive is auto-scanned.

**Files:** Create `lib/catalog/{registry,generate,exports}.ts`, `lib/check/catalog-fresh.ts`, `scripts/generate-catalog.ts`, `design-system.components.md`; Modify `lib/check/run.ts`, `package.json`, `tests/ui/no-hardcoded-color.test.ts`, `AGENTS.md`, `design-system.md`. Tests `tests/catalog/catalog-fresh.test.ts`.

- [ ] **Step 1: `exportsOf` + failing gate test**
```ts
// lib/catalog/exports.ts
/** Capitalized exported component symbols (ignores lowercase helpers like buttonVariants). */
export function exportsOf(content: string): string[] {
  const out = new Set<string>();
  // export function Foo / export const Foo
  for (const m of content.matchAll(/export\s+(?:function|const)\s+([A-Z][A-Za-z0-9]*)/g)) out.add(m[1]);
  // export { Foo, Bar as Baz, lowercaseHelper }
  for (const m of content.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Z]/.test(name)) out.add(name);
    }
  }
  return [...out];
}
```
```ts
// tests/catalog/catalog-fresh.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { exportsOf } from "@/lib/catalog/exports";
import { checkCatalogFresh } from "@/lib/check/catalog-fresh";
import { buildCatalogMarkdown } from "@/lib/catalog/generate";
import { CATALOG } from "@/lib/catalog/registry";

describe("exportsOf", () => {
  it("picks Capitalized exports, ignores lowercase helpers", () => {
    expect(exportsOf(`export { Badge, badgeVariants }`).sort()).toEqual(["Badge"]);
    expect(exportsOf(`export function Card() {}`)).toEqual(["Card"]);
  });
});

describe("checkCatalogFresh", () => {
  const md = buildCatalogMarkdown(CATALOG);
  it("is green for the committed registry + fresh doc", () => {
    const files = CATALOG.map((e) => ({ path: e.file, content: e.exports.map((x) => `export function ${x}() {}`).join("\n") }));
    expect(checkCatalogFresh(files, md)).toEqual([]);
  });
  it("flags an unregistered export", () => {
    const files = [{ path: "components/ui/zzz.tsx", content: "export function Zzz() {}" }];
    expect(checkCatalogFresh(files, md).map((f) => f.rule)).toContain("catalog-fresh");
  });
  it("flags a stale doc", () => {
    const files = CATALOG.map((e) => ({ path: e.file, content: e.exports.map((x) => `export function ${x}() {}`).join("\n") }));
    expect(checkCatalogFresh(files, md + "drift").map((f) => f.rule)).toContain("catalog-fresh");
  });
});
```

- [ ] **Step 2: run → FAIL** (modules missing).

- [ ] **Step 3: implement registry (existing 8 primitives), generator, gate, script, wiring**

`lib/catalog/registry.ts` — type + entries for the **current** primitives (Capitalized exports verified: Button, Input, Card+5, Avatar+3, Badge, Separator, Code, Kbd):
```ts
export type CatalogEntry = {
  name: string;        // logical primitive
  file: string;        // components/ui path
  exports: string[];   // every Capitalized export the file provides
  purpose: string;     // one line — what it's for
  whenToUse: string;   // when to reach for it
  import: string;      // copy-paste import line
  snippet: string;     // minimal usage
};

export const CATALOG: CatalogEntry[] = [
  { name: "Button", file: "components/ui/button.tsx", exports: ["Button"],
    purpose: "Clickable action — variants (default/secondary/outline/ghost/destructive/link) + sizes.",
    whenToUse: "Any action or submit. Use asChild to render a link as a button.",
    import: `import { Button } from "@/components/ui/button"`,
    snippet: `<Button variant="outline">Save</Button>` },
  { name: "Input", file: "components/ui/input.tsx", exports: ["Input"],
    purpose: "Single-line text field.",
    whenToUse: "Short text/email/number entry. Pair with Label.",
    import: `import { Input } from "@/components/ui/input"`,
    snippet: `<Input type="email" placeholder="you@example.com" />` },
  { name: "Card", file: "components/ui/card.tsx",
    exports: ["Card", "CardHeader", "CardTitle", "CardAction", "CardDescription", "CardContent", "CardFooter"],
    purpose: "Surface container with header/title/description/content/footer slots.",
    whenToUse: "Group related content into a panel.",
    import: `import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"`,
    snippet: `<Card><CardHeader><CardTitle>Plan</CardTitle></CardHeader><CardContent>…</CardContent></Card>` },
  { name: "Avatar", file: "components/ui/avatar.tsx",
    exports: ["Avatar", "AvatarImage", "AvatarFallback", "AvatarGroup"],
    purpose: "User image with initials fallback; AvatarGroup stacks with a +N overflow chip.",
    whenToUse: "Represent a person. Always give Avatar an aria-label (the name).",
    import: `import { Avatar, AvatarFallback } from "@/components/ui/avatar"`,
    snippet: `<Avatar aria-label="Jane Doe"><AvatarFallback aria-hidden>JD</AvatarFallback></Avatar>` },
  { name: "Badge", file: "components/ui/badge.tsx", exports: ["Badge"],
    purpose: "Small status/label pill — semantic variants (success/warning/info/destructive/…).",
    whenToUse: "Status or category. The label text must carry the meaning (never color alone).",
    import: `import { Badge } from "@/components/ui/badge"`,
    snippet: `<Badge variant="success">Done</Badge>` },
  { name: "Separator", file: "components/ui/separator.tsx", exports: ["Separator"],
    purpose: "Horizontal or vertical divider rule.",
    whenToUse: "Separate groups of content or toolbar items.",
    import: `import { Separator } from "@/components/ui/separator"`,
    snippet: `<Separator orientation="vertical" />` },
  { name: "Code", file: "components/ui/code.tsx", exports: ["Code", "Kbd"],
    purpose: "Code: inline <code> chip. Kbd: keyboard-cap glyph (uses the 2xs micro step).",
    whenToUse: "Inline command/code (Code) or a shortcut key (Kbd).",
    import: `import { Code, Kbd } from "@/components/ui/code"`,
    snippet: `Run <Code>npm run dev</Code> or press <Kbd>⌘</Kbd> <Kbd>K</Kbd>` },
];
```

`lib/catalog/generate.ts`:
```ts
import type { CatalogEntry } from "./registry";

/** Deterministic markdown — the LLM-facing component catalog. Stable order = the array order. */
export function buildCatalogMarkdown(catalog: CatalogEntry[]): string {
  const lines: string[] = [
    "# Component Catalog",
    "",
    "Generated by `npm run catalog` from `lib/catalog/registry.ts`. Do not edit by hand.",
    "",
    "These primitives already exist in `components/ui/*` — **import and use them; do not hand-roll equivalents.** All are token-only and accessible by default.",
    "",
  ];
  for (const e of catalog) {
    lines.push(`## ${e.name}`);
    lines.push("");
    lines.push(`- **Purpose:** ${e.purpose}`);
    lines.push(`- **When to use:** ${e.whenToUse}`);
    lines.push(`- **Exports:** ${e.exports.join(", ")}`);
    lines.push("");
    lines.push("```tsx");
    lines.push(e.import);
    lines.push("");
    lines.push(e.snippet);
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}
```

`lib/check/catalog-fresh.ts`:
```ts
import type { Finding } from "./types";
import { exportsOf } from "@/lib/catalog/exports";
import { buildCatalogMarkdown } from "@/lib/catalog/generate";
import { CATALOG } from "@/lib/catalog/registry";

/** Every Capitalized export under components/ui must have a catalog entry; the doc must be fresh. */
export function checkCatalogFresh(uiFiles: { path: string; content: string }[], committedMd: string): Finding[] {
  const out: Finding[] = [];
  const registered = new Set(CATALOG.flatMap((e) => e.exports));
  const actual = new Set(uiFiles.flatMap((f) => exportsOf(f.content)));
  for (const f of uiFiles)
    for (const sym of exportsOf(f.content))
      if (!registered.has(sym))
        out.push({ file: f.path, line: 0, rule: "catalog-fresh",
          message: `export ${sym} has no catalog entry — add it to lib/catalog/registry.ts and run npm run catalog` });
  for (const e of CATALOG)
    for (const sym of e.exports)
      if (!actual.has(sym))
        out.push({ file: e.file, line: 0, rule: "catalog-fresh",
          message: `registry lists ${sym} which is not exported — prune lib/catalog/registry.ts and run npm run catalog` });
  if (committedMd !== buildCatalogMarkdown(CATALOG))
    out.push({ file: "design-system.components.md", line: 0, rule: "catalog-fresh",
      message: "design-system.components.md is stale — run npm run catalog and commit" });
  return out;
}
```

`scripts/generate-catalog.ts`:
```ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCatalogMarkdown } from "../lib/catalog/generate";
import { CATALOG } from "../lib/catalog/registry";
writeFileSync(resolve("design-system.components.md"), buildCatalogMarkdown(CATALOG), "utf8");
console.log(`catalog: wrote design-system.components.md (${CATALOG.length} primitives)`);
```

`lib/check/run.ts` — add a reader for the excluded `components/ui` dir + wire the gate into `system[]`:
```ts
// near the other imports
import { readdirSync } from "node:fs";
import { checkCatalogFresh } from "./catalog-fresh";
// ...inside run(), build the ui file list (the dir is walk-excluded, so read it directly):
const uiDir = resolve("components/ui");
const uiFiles = readdirSync(uiDir)
  .filter((n) => n.endsWith(".tsx"))
  .map((n) => ({ path: `components/ui/${n}`, content: readFileSync(resolve(uiDir, n), "utf8") }));
// ...add to the `system` array:
const system = [
  ...checkBothTheme(globals),
  ...checkContrast(globals),
  ...checkManifestFresh(globals, readFileSync(resolve("design-system.json"), "utf8"), readFileSync(resolve("design-system.md"), "utf8")),
  ...checkCatalogFresh(uiFiles, readFileSync(resolve("design-system.components.md"), "utf8")),
];
```

`package.json` scripts — add `"catalog": "tsx scripts/generate-catalog.ts"`.

`tests/ui/no-hardcoded-color.test.ts` — replace the hardcoded FILES list with a dir glob so ALL primitives are covered:
```ts
// tests/ui/no-hardcoded-color.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const FILES = readdirSync(resolve("components/ui"))
  .filter((n) => n.endsWith(".tsx"))
  .map((n) => `components/ui/${n}`);

describe("all ui primitives are token-only (no hardcoded colors)", () => {
  for (const f of FILES) {
    it(f, () => {
      expect(checkHardcodedColor(f, readFileSync(resolve(f), "utf8"))).toEqual([]);
    });
  }
});
```

`AGENTS.md` (inside the `design-system` block, near the icon note) + `design-system.md` preamble — add a **Components** pointer:
> **Components:** the available UI primitives (with imports + usage) are catalogued in [`design-system.components.md`](design-system.components.md) (generated). **Import and use them — do not hand-roll dialogs, dropdowns, toggles, etc.** New primitives go in `components/ui/*` and MUST be registered in `lib/catalog/registry.ts` (the `catalog-fresh` gate enforces this).

- [ ] **Step 4: generate + run → PASS**
```bash
npm run catalog            # writes design-system.components.md
npx vitest run tests/catalog/catalog-fresh.test.ts tests/ui/no-hardcoded-color.test.ts
npm run check              # catalog-fresh now part of the gate; must be green
```
Expected: tests PASS, check green.

- [ ] **Step 5: commit**
```bash
git add lib/catalog scripts/generate-catalog.ts lib/check/catalog-fresh.ts lib/check/run.ts package.json design-system.components.md tests/catalog tests/ui/no-hardcoded-color.test.ts AGENTS.md design-system.md
git commit -m "feat(catalog): generated component catalog + catalog-fresh gate (covers existing primitives)"
```

---

## Overlay batch (Tasks 2–7)

> Each: failing render+a11y test (jsdom) → implement component (full code below) → add registry entry → `npm run catalog` → test PASS + `npm run check` green → commit. Radix overlay content is portalled; assert via `findByRole`/`getByText` after firing the trigger with `@testing-library/user-event` or `fireEvent.click`.

### Task 2: Dialog

**Files:** Create `components/ui/dialog.tsx`; Test `tests/ui/dialog.test.tsx`; registry entry.

- [ ] **Step 1: failing test**
```tsx
// tests/ui/dialog.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";

describe("Dialog", () => {
  it("opens on trigger and exposes an accessible dialog with a title", () => {
    const { getByText, getByRole } = render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent><DialogTitle>Hello</DialogTitle></DialogContent>
      </Dialog>
    );
    fireEvent.click(getByText("Open"));
    const dlg = getByRole("dialog");
    expect(dlg).toBeTruthy();
    expect(getByText("Hello")).toBeTruthy();
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement**
```tsx
// components/ui/dialog.tsx
import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XClose } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}
function DialogTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}
function DialogPortal(props: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}
function DialogClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn("fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
}
function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content data-slot="dialog-content" className={cn("fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
          <XClose className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
}
function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
}
function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-lg font-semibold", className)} {...props} />
}
function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}
export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }
```
Registry entry (append to `CATALOG`):
```ts
{ name: "Dialog", file: "components/ui/dialog.tsx",
  exports: ["Dialog","DialogTrigger","DialogPortal","DialogClose","DialogOverlay","DialogContent","DialogHeader","DialogFooter","DialogTitle","DialogDescription"],
  purpose: "Modal dialog over a dimmed (--overlay) scrim.",
  whenToUse: "Confirmations, short forms, focused tasks. Always include a DialogTitle (a11y).",
  import: `import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"`,
  snippet: `<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader></DialogContent></Dialog>` },
```

- [ ] **Step 4: `npm run catalog` → run test → PASS → `npm run check` green.**
- [ ] **Step 5: commit** `git add components/ui/dialog.tsx tests/ui/dialog.test.tsx lib/catalog/registry.ts design-system.components.md && git commit -m "feat(ui): Dialog (radix, --overlay scrim)"`

### Task 3: AlertDialog

Same structure as Dialog but no close-X, two-button footer, `role="alertdialog"`. Test asserts `getByRole("alertdialog")` after trigger click + an action button present.
```tsx
// components/ui/alert-dialog.tsx
import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}
function AlertDialogTrigger(props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}
function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay data-slot="alert-dialog-overlay" className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <AlertDialogPrimitive.Content data-slot="alert-dialog-content" className={cn("fixed top-1/2 left-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
    </AlertDialogPrimitive.Portal>
  )
}
function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
}
function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
}
function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title data-slot="alert-dialog-title" className={cn("text-lg font-semibold", className)} {...props} />
}
function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return <AlertDialogPrimitive.Description data-slot="alert-dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}
function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return <AlertDialogPrimitive.Action data-slot="alert-dialog-action" className={cn(buttonVariants(), className)} {...props} />
}
function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return <AlertDialogPrimitive.Cancel data-slot="alert-dialog-cancel" className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />
}
export { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel }
```
Registry: name "AlertDialog", all exports, purpose "Confirm a destructive/irreversible action (action + cancel).", snippet with Trigger/Content/Title/Footer/Action/Cancel. Commit `feat(ui): AlertDialog (radix)`.

### Task 4: Sheet (side panel)

Radix Dialog with a `side` cva (top/right/bottom/left). Test: opens, `getByRole("dialog")`, asserts `data-slot=sheet-content`.
```tsx
// components/ui/sheet.tsx
import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { XClose } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"

function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) { return <SheetPrimitive.Root data-slot="sheet" {...props} /> }
function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) { return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} /> }
function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) { return <SheetPrimitive.Close data-slot="sheet-close" {...props} /> }

const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 bg-popover p-6 text-popover-foreground shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out",
  { variants: { side: {
      top: "inset-x-0 top-0 border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
      bottom: "inset-x-0 bottom-0 border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      left: "inset-y-0 left-0 h-full w-3/4 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
      right: "inset-y-0 right-0 h-full w-3/4 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
    } }, defaultVariants: { side: "right" } }
)
function SheetContent({ className, children, side = "right", ...props }: React.ComponentProps<typeof SheetPrimitive.Content> & VariantProps<typeof sheetVariants>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay data-slot="sheet-overlay" className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content data-slot="sheet-content" className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
          <XClose className="size-4" /><span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5", className)} {...props} /> }
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2", className)} {...props} /> }
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) { return <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-lg font-semibold", className)} {...props} /> }
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) { return <SheetPrimitive.Description data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} /> }
export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
```
Registry + commit `feat(ui): Sheet (radix dialog, side variants)`.

### Task 5: Popover
```tsx
// components/ui/popover.tsx
import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) { return <PopoverPrimitive.Root data-slot="popover" {...props} /> }
function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) { return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} /> }
function PopoverAnchor(props: React.ComponentProps<typeof PopoverPrimitive.Anchor>) { return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} /> }
function PopoverContent({ className, align = "center", sideOffset = 4, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content data-slot="popover-content" align={align} sideOffset={sideOffset} className={cn("z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
    </PopoverPrimitive.Portal>
  )
}
export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
```
Test: open → `getByText` content visible. Registry + commit `feat(ui): Popover (radix)`.

### Task 6: Tooltip
```tsx
// components/ui/tooltip.tsx
import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function TooltipProvider({ delayDuration = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}
function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipProvider><TooltipPrimitive.Root data-slot="tooltip" {...props} /></TooltipProvider>
}
function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) { return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} /> }
function TooltipContent({ className, sideOffset = 4, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content data-slot="tooltip-content" sideOffset={sideOffset} className={cn("z-50 w-fit rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0", className)} {...props}>
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```
Test: render Tooltip with provider, assert trigger present + `data-slot=tooltip-trigger` (content is hover-driven; assert trigger to keep jsdom-stable). Registry + commit `feat(ui): Tooltip (radix)`.

### Task 7: DropdownMenu
```tsx
// components/ui/dropdown-menu.tsx
import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { Check, ChevronRight, Circle } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"
function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) { return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} /> }
function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) { return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} /> }
function DropdownMenuGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) { return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} /> }
function DropdownMenuContent({ className, sideOffset = 4, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn("z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  )
}
function DropdownMenuItem({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item" data-inset={inset} className={cn("relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset=true]:pl-8 [&_svg]:size-4", className)} {...props} />
}
function DropdownMenuCheckboxItem({ className, children, checked, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" checked={checked} className={cn("relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center"><DropdownMenuPrimitive.ItemIndicator><Check className="size-4" /></DropdownMenuPrimitive.ItemIndicator></span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}
function DropdownMenuRadioGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) { return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} /> }
function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn("relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground", className)} {...props}>
      <span className="absolute left-2 flex size-3.5 items-center justify-center"><DropdownMenuPrimitive.ItemIndicator><Circle className="size-2 fill-current" /></DropdownMenuPrimitive.ItemIndicator></span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}
function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" data-inset={inset} className={cn("px-2 py-1.5 text-sm font-medium data-[inset=true]:pl-8", className)} {...props} />
}
function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}
function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="dropdown-menu-shortcut" className={cn("ml-auto text-2xs tracking-widest text-muted-foreground", className)} {...props} />
}
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut }
```
Test: open → `getByRole("menuitem")` present. Registry + commit `feat(ui): DropdownMenu (radix)`.

---

## Form batch (Tasks 8–14)

### Task 8: Label
```tsx
// components/ui/label.tsx
import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn("flex items-center gap-2 text-sm font-medium leading-none select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
}
export { Label }
```
Test: renders `<Label htmlFor="x">` → `data-slot=label` + text. Commit `feat(ui): Label (radix)`.

### Task 9: Checkbox
```tsx
// components/ui/checkbox.tsx
import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { Check } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root data-slot="checkbox" className={cn("peer size-4 shrink-0 rounded-[4px] border border-input shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground", className)} {...props}>
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center text-current"><Check className="size-3.5" /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
export { Checkbox }
```
Test: render `<Checkbox defaultChecked />` → `getByRole("checkbox")` has `aria-checked="true"`. Commit `feat(ui): Checkbox (radix)`.

### Task 10: RadioGroup
```tsx
// components/ui/radio-group.tsx
import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"
import { Circle } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-2", className)} {...props} />
}
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item data-slot="radio-group-item" className={cn("aspect-square size-4 rounded-full border border-input text-primary shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props}>
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center"><Circle className="size-2 fill-current text-current" /></RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}
export { RadioGroup, RadioGroupItem }
```
Test: render group with two items, `getAllByRole("radio")` length 2. Commit `feat(ui): RadioGroup (radix)`.

### Task 11: Switch
```tsx
// components/ui/switch.tsx
import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root data-slot="switch" className={cn("peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input", className)} {...props}>
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  )
}
export { Switch }
```
Test: `<Switch defaultChecked />` → `getByRole("switch")` `aria-checked="true"`. Commit `feat(ui): Switch (radix)`.

### Task 12: Select
```tsx
// components/ui/select.tsx
import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { Check, ChevronDown, ChevronUp } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) { return <SelectPrimitive.Root data-slot="select" {...props} /> }
function SelectGroup(props: React.ComponentProps<typeof SelectPrimitive.Group>) { return <SelectPrimitive.Group data-slot="select-group" {...props} /> }
function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) { return <SelectPrimitive.Value data-slot="select-value" {...props} /> }
function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm whitespace-nowrap shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground [&_svg]:size-4", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="size-4 opacity-50" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}
function SelectContent({ className, children, position = "popper", ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content data-slot="select-content" position={position} className={cn("relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", position === "popper" && "data-[side=bottom]:translate-y-1", className)} {...props}>
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className={cn("p-1", position === "popper" && "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)")}>{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}
function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} />
}
function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={cn("relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props}>
      <span className="absolute right-2 flex size-3.5 items-center justify-center"><SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator></span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}
function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator data-slot="select-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}
export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator }
```
Test: render Select with a trigger + placeholder Value → `getByRole("combobox")` present (radix Select trigger has role combobox). Commit `feat(ui): Select (radix)`.

### Task 13: Textarea
```tsx
// components/ui/textarea.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn("flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
}
export { Textarea }
```
Test: render → `getByRole("textbox")` is a `TEXTAREA`. Commit `feat(ui): Textarea`.

### Task 14: Form (lib-agnostic styled wrappers — NO react-hook-form)
```tsx
// components/ui/form.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="form-item" className={cn("flex flex-col gap-2", className)} {...props} />
}
function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="form-label" className={className} {...props} />
}
function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="form-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}
/** Renders nothing when empty; show validation/help error text in the destructive color. */
function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null
  return <p data-slot="form-message" className={cn("text-sm font-medium text-destructive", className)} {...props}>{children}</p>
}
export { FormItem, FormLabel, FormDescription, FormMessage }
```
Test: `<FormMessage>Required</FormMessage>` renders text in `text-destructive`; `<FormMessage />` renders nothing (`container.querySelector("[data-slot=form-message]")` is null). Commit `feat(ui): Form-layout wrappers (lib-agnostic, no react-hook-form)`.

---

## Nav/structure batch (Tasks 15–17)

### Task 15: Tabs
```tsx
// components/ui/tabs.tsx
import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-2", className)} {...props} />
}
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" className={cn("inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)} {...props} />
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn("inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm [&_svg]:size-4", className)} {...props} />
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
}
export { Tabs, TabsList, TabsTrigger, TabsContent }
```
Test: render Tabs with two triggers/contents, default value → active panel text visible, click second → second visible. Commit `feat(ui): Tabs (radix)`.

### Task 16: Accordion
```tsx
// components/ui/accordion.tsx
import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { ChevronDown } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"
function Accordion(props: React.ComponentProps<typeof AccordionPrimitive.Root>) { return <AccordionPrimitive.Root data-slot="accordion" {...props} /> }
function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item data-slot="accordion-item" className={cn("border-b border-border last:border-b-0", className)} {...props} />
}
function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger data-slot="accordion-trigger" className={cn("flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium outline-none transition-all hover:underline focus-visible:ring-[3px] focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180", className)} {...props}>
        {children}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}
function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content data-slot="accordion-content" className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down" {...props}>
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```
> **Note:** `animate-accordion-up/down` come from `tw-animate-css` (already imported in globals); no token/keyframe work needed. Verify the class compiles in `npm run build` (Task 26).

Test: render `type="single" collapsible` with one item, trigger text present + `getByRole("button")`. Commit `feat(ui): Accordion (radix)`.

### Task 17: Table (styled native elements)
```tsx
// components/ui/table.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <div data-slot="table-container" className="relative w-full overflow-x-auto"><table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props} /></div>
}
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) { return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} /> }
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) { return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} /> }
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) { return <tfoot data-slot="table-footer" className={cn("border-t border-border bg-muted/50 font-medium", className)} {...props} /> }
function TableRow({ className, ...props }: React.ComponentProps<"tr">) { return <tr data-slot="table-row" className={cn("border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className)} {...props} /> }
function TableHead({ className, ...props }: React.ComponentProps<"th">) { return <th data-slot="table-head" className={cn("h-10 px-2 text-left align-middle font-medium text-muted-foreground", className)} {...props} /> }
function TableCell({ className, ...props }: React.ComponentProps<"td">) { return <td data-slot="table-cell" className={cn("p-2 align-middle", className)} {...props} /> }
function TableCaption({ className, ...props }: React.ComponentProps<"caption">) { return <caption data-slot="table-caption" className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} /> }
export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
```
Test: render a Table with one header/row/cell → `getByRole("table")` + cell text. Commit `feat(ui): Table (styled native)`.

---

## Task 18: Install Sonner + cmdk

**Files:** Modify `package.json` + lockfile.

- [ ] **Step 1:** `npm install sonner cmdk`
- [ ] **Step 2:** verify `node -e "require.resolve('sonner'); require.resolve('cmdk'); console.log('ok')"` → `ok`.
- [ ] **Step 3:** `npm run check` + `npm test` still green (no consumers yet).
- [ ] **Step 4: commit** `git add package.json package-lock.json && git commit -m "build(deps): add sonner + cmdk for Toast + Command"`

---

## Feedback batch (Tasks 19–21)

### Task 19: Toaster (Sonner) — token-styled, no next-themes

Sonner's default styling is theme-via-`next-themes`, which this repo does NOT use (class-based dark). Style the toasts with token utilities via `toastOptions.classNames` so they're correct in both themes without `next-themes`.
```tsx
// components/ui/sonner.tsx
"use client"
import { Toaster as Sonner, toast } from "sonner"
type ToasterProps = React.ComponentProps<typeof Sonner>
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      data-slot="toaster"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg",
          description: "text-muted-foreground",
          actionButton: "rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground",
          cancelButton: "rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}
export { Toaster, toast }
```
> **Note:** `toast` is re-exported so consumers do `import { toast } from "@/components/ui/sonner"`. The `<Toaster />` mounts once (in a screen/layout). `"use client"` is required (Sonner is client-only).

Test (jsdom): render `<Toaster />` → `document.querySelector("[data-slot=toaster]")` (or the sonner section) exists; `expect(typeof toast).toBe("function")`. Registry entry name "Toaster", exports `["Toaster"]` (note: `toast` is lowercase → not gate-tracked, but mention it in the snippet). Commit `feat(ui): Toaster (sonner, token-styled)`.

### Task 20: Skeleton
```tsx
// components/ui/skeleton.tsx
import * as React from "react"
import { cn } from "@/lib/utils"
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}
export { Skeleton }
```
Test: render → `data-slot=skeleton` present + `animate-pulse` in className. Commit `feat(ui): Skeleton`.

### Task 21: Command (cmdk)
```tsx
// components/ui/command.tsx
import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchSm } from "@untitled-ui/icons-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className)} {...props} />
}
function CommandDialog({ title = "Command Palette", description = "Search for a command to run...", children, ...props }: React.ComponentProps<typeof Dialog> & { title?: string; description?: string }) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-muted-foreground">{children}</Command>
      </DialogContent>
    </Dialog>
  )
}
function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center gap-2 border-b border-border px-3" cmdk-input-wrapper="">
      <SearchSm className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input data-slot="command-input" className={cn("flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />
    </div>
  )
}
function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return <CommandPrimitive.List data-slot="command-list" className={cn("max-h-80 overflow-y-auto overflow-x-hidden", className)} {...props} />
}
function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm" {...props} />
}
function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn("overflow-hidden p-1 text-foreground", className)} {...props} />
}
function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return <CommandPrimitive.Separator data-slot="command-separator" className={cn("-mx-1 h-px bg-border", className)} {...props} />
}
function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return <CommandPrimitive.Item data-slot="command-item" className={cn("relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4", className)} {...props} />
}
function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="command-shortcut" className={cn("ml-auto text-2xs tracking-widest text-muted-foreground", className)} {...props} />
}
export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator, CommandShortcut }
```
Test: render a Command with an Input + two Items, type into the input → filtered item matches (`fireEvent.change(getByRole("combobox"), { target: { value: "..." } })`; assert the matching item remains). Keep it simple: assert both items render initially + `data-slot=command`. Commit `feat(ui): Command palette (cmdk, token-styled)`.

> **Icon name check:** verify `SearchSm` / `XClose` / `Check` / `Circle` / `ChevronDown`/`ChevronUp`/`ChevronRight` exist in `@untitled-ui/icons-react` before use (`node -e "const i=require('@untitled-ui/icons-react'); console.log(['SearchSm','XClose','Check','Circle','ChevronDown','ChevronUp','ChevronRight'].filter(n=>!i[n]))"` → prints any missing; substitute the nearest, e.g. `SearchMd`, `X`, `XCircle`).

---

## Task 22: `/design-system` live demos

**Files:** Modify `components/design-system/component-showcase.tsx`.

- [ ] **Step 1: implement** — add interactive `Group`s for the new primitives (a real Dialog, DropdownMenu, Tabs, Select, Switch/Checkbox/Radio, Tooltip-in-Provider, Accordion, Table, Skeleton, a "Show toast" Button wired to `toast()` with a `<Toaster />` mounted, a Command demo). Token-only; `size-*`/`gap-*` on scale. Keep each demo minimal (2–3 items).
- [ ] **Step 2: verify** — `npm run check` green (showcase is scanned — no arbitrary/hardcoded classes); `npm run build` compiles.
- [ ] **Step 3: commit** `git add components/design-system/component-showcase.tsx && git commit -m "docs(design-system): live demos for the new primitives"`

---

## Task 23: `/settings` reference screen (permanent dogfood)

**Files:** Create `app/settings/page.tsx`; Test `e2e/settings.spec.ts` (render/no-overflow, mirrors `e2e/themes.spec.ts`).

- [ ] **Step 1:** build a token-only Settings page exercising the most primitives: **Tabs** (Account / Notifications / Danger), **FormItem/FormLabel/Input/Textarea**, **Switch** + **Checkbox** rows, a **Select** (timezone), a **Separator**, a **DropdownMenu** (account menu), a save **Button** that fires a **toast()** ("Saved ✓"), and an **AlertDialog** under a Danger "Delete account" button. Mount `<Toaster />`. No arbitrary classes; all spacing on-scale.
- [ ] **Step 2:** `npm run check` green; `npm run build` compiles; add a minimal Playwright spec that loads `/settings`, asserts no horizontal overflow + the tab triggers are visible (pattern from `e2e/themes.spec.ts`).
- [ ] **Step 3: commit** `git add app/settings/page.tsx e2e/settings.spec.ts && git commit -m "feat(app): permanent token-only /settings reference screen (dogfoods new primitives)"`

---

## Task 24: Promote `/preview-app` + rewire to real primitives

**Files:** Modify `app/preview-app/page.tsx` (currently an untracked throwaway in the working tree); Test `e2e/preview-app.spec.ts`.

- [ ] **Step 1:** Rewire the faked bits to the real primitives now that they exist: the top-bar Settings/Bell buttons → **DropdownMenu**; section/issue hovers keep `bg-accent`; the avatar-group + badges stay; wrap icon-only buttons in **Tooltip**; the agent-panel "beta" stays a Badge; add a **Separator**-based toolbar. Keep it token-only, no arbitrary classes.
- [ ] **Step 2:** `npm run check` green; `npm run build` compiles; add a minimal Playwright spec (load `/preview-app`, no horizontal overflow).
- [ ] **Step 3: commit** `git add app/preview-app/page.tsx e2e/preview-app.spec.ts && git commit -m "feat(app): promote /preview-app to a permanent dogfood; rewire fakes to real primitives"`

---

## Task 25: Docs — `--overlay`, catalog pointer, HANDOFF

**Files:** Modify `docs/NAMING-CONVENTION.md`, `AGENTS.md` (if not fully done in Task 1), `design-system.md` preamble, `docs/HANDOFF.md`.

- [ ] **Step 1:**
  - `NAMING-CONVENTION.md`: document `overlay` (scrim role, alpha, no `-foreground` pair — like `border`/`input`/`ring`).
  - Confirm the **Components** catalog pointer is present in `AGENTS.md` + `design-system.md` (added in Task 1); tidy wording if needed.
  - `docs/HANDOFF.md`: add a "Primitive coverage DONE 2026-06-28" entry — ~19 new primitives, `--overlay` token, generated catalog + `catalog-fresh` gate, `/settings` + permanent `/preview-app`, new deps (sonner, cmdk), updated token + test counts.
- [ ] **Step 2:** `npx vitest run tests/surfaces.test.ts` green (AGENTS.md edits stay inside the design-system block).
- [ ] **Step 3: commit** `git add docs/NAMING-CONVENTION.md AGENTS.md design-system.md docs/HANDOFF.md && git commit -m "docs: document --overlay, component catalog, milestone done"`

---

## Task 26: Verify + proof

- [ ] **Step 1: full gate** — `npm run verify` (`check && test && lint && build`) → all green. Then `npx playwright test` → green (note the known `editor.spec.ts --primary` flake under load; re-run isolated if needed).
- [ ] **Step 2: proof** — screenshot `/settings` and `/preview-app` in **light + dark across all 3 themes** (`npm run theme swiss|brutalist|neutral` + a throwaway Playwright shot spec into `e2e/__shots__/`, gitignored). `Read` the PNGs to self-critique: every primitive renders on-token, overlays use the `--overlay` scrim, nothing flat or clipped. Restore `neutral` theme after.
- [ ] **Step 3: catalog sanity** — open `design-system.components.md`; confirm all ~19 new primitives appear with import + snippet, and `npm run check` is green (catalog-fresh covers every export).
- [ ] **Step 4: stop + ask the human** before merging `--no-ff` to `main`. On go-ahead: `npm run verify` once more on the merged result, `--no-ff`, delete the branch.

---

## Notes for the executor
- **Catalog discipline per primitive:** every primitive task adds its `lib/catalog/registry.ts` entry + runs `npm run catalog` + stages `design-system.components.md` in the same commit. Skipping it reds `catalog-fresh` at pre-commit. The gate keys on **Capitalized exported symbols**, not files (Code+Kbd, Avatar+Group, the Form set, etc. — register all of a file's exports).
- **`components/ui` is gate-excluded at the walk level**, so the primitives' own token-cleanliness is enforced by `tests/ui/no-hardcoded-color.test.ts` (now dir-globbed). After each primitive, that test must stay green — a stray `bg-black/50`/`#fff`/`oklch(...)` fails it.
- **Radix unified import only** — `import { X as XPrimitive } from "radix-ui"`. Never `@radix-ui/react-*`.
- **`--overlay` after Task 0** — Dialog/Sheet/AlertDialog/Command overlays use `bg-overlay`; never `bg-black/50`.
- **Icon names** — verify each `@untitled-ui/icons-react` import resolves before use (names carry suffixes: `SearchMd`, `XClose`, `ChevronDown`); substitute the nearest if missing.
- **`next build` is load-bearing** — always `npm run verify`, never just check+test. Tailwind v4 scans `tests/` so class fixtures can leak; keep test JSX minimal.
- **Shared-tree hazard** — never `git checkout <paths>` to discard; use `git restore` after confirming identity to HEAD.
- **jsdom + portals** — Radix portals render to `document.body`; query with `getByRole`/`getByText` (they search the whole document), and fire the trigger (`fireEvent.click`) before asserting portalled content.
```
