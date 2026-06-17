# M1 — Token Write-Core Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A robust, exhaustively-tested `lib/tokens` module that can read every token out of `globals.css` and rewrite exactly one declaration — in the correct theme block, preserving formatting/comments/ordering, validating the value, rejecting CSS injection, and writing atomically.

**Architecture:** PostCSS AST, not regex (regex-hex patching was the prototype's load-bearing flaw — spec §5/§12). `parse.ts` walks the `:root`/`.dark` rules into a typed `Token[]`. `schema.ts` infers a token's group from its name (per the M0 naming convention) and maps group→control-type. `write.ts` validates a value against its group, re-reads the file, updates one `decl.value` in the AST, and writes temp-then-rename. The `@theme inline` block is never touched.

**Tech Stack:** TypeScript 5, PostCSS, Vitest. (Next/Tailwind from M0 unchanged.)

**Scope note:** M1 of the spec at [docs/specs/2026-06-16-design-system-starter-design.md](../../specs/2026-06-16-design-system-starter-design.md). Depends on **M0 landed** — `app/globals.css` exists with the `:root`/`.dark` block structure and base-name convention from [docs/NAMING-CONVENTION.md](../../NAMING-CONVENTION.md). M1 done-criteria (spec §10): can programmatically change any token in `globals.css` safely, preserving formatting, in either theme. No editor UI, no API route, no manifest — those are M2/M4.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/tokens/types.ts` | `Token`, `Theme`, `TokenGroup`, `ControlType` types — the shared vocabulary |
| `lib/tokens/schema.ts` | `groupForName()` (name→group, enforces convention), `controlForGroup()`, fg/bg pairing |
| `lib/tokens/parse.ts` | `parseTokens(css)` → `Token[]` from `:root`/`.dark` only |
| `lib/tokens/validate.ts` | `validateValue(group, value)` — injection rejection + per-group shape |
| `lib/tokens/write.ts` | `writeToken(filePath, edit)` — re-read, AST update one decl, atomic write |
| `tests/tokens/*.test.ts` | one test file per module + a round-trip integration test |
| `tests/tokens/fixtures/sample.css` | a small hand-authored `:root`+`.dark` fixture mirroring M0's structure |

Decomposition rationale: pure functions (`schema`, `validate`) are isolated and trivially TDD'd first; `parse` reads; `write` composes validate+parse-shape+atomic-IO and is the integration point. Each file has one responsibility and is independently testable.

---

## Task 0: Precondition — verify the `@` alias resolves

M1 tests import via `@/lib/tokens/...`. Vitest does NOT read `tsconfig.json` `paths`; it needs an explicit `resolve.alias`. M0 Task 4 Step 1 sets this up. **Verify it before writing any test** — otherwise the TDD "module not found" red is indistinguishable from a broken alias, and every task blocks.

- [ ] **Step 1: Confirm `vitest.config.ts` has the `@` alias**

Run:

```bash
grep -q 'alias' vitest.config.ts && grep -q '"@"' vitest.config.ts && echo "ALIAS OK"
```

Expected: `ALIAS OK`. If absent, add to `vitest.config.ts`:

```ts
import { resolve } from "node:path";
// inside defineConfig({...}):
resolve: { alias: { "@": resolve(__dirname, ".") } },
```

Then verify with a throwaway: `echo 'import {describe,it} from "vitest";describe("x",()=>it("y",()=>{}))' > tests/_alias.test.ts && npx vitest run tests/_alias.test.ts && rm tests/_alias.test.ts`.

---

## Task 1: Types + a fixture mirroring M0

**Files:**
- Create: `lib/tokens/types.ts`
- Create: `tests/tokens/fixtures/sample.css`

- [ ] **Step 1: Write the shared types**

Create `lib/tokens/types.ts`:

```ts
export type Theme = "light" | "dark"; // :root = light, .dark = dark

export type TokenGroup =
  | "color"
  | "fontFamily"
  | "fontSize"
  | "lineHeight"
  | "fontWeight"
  | "radius"
  | "borderWidth"
  | "shadow"
  | "duration"
  | "easing"
  | "spacing"
  | "zIndex"
  | "opacity"
  | "container";

export type ControlType =
  | "color"
  | "select"
  | "length-slider"
  | "duration-slider"
  | "easing"
  | "number"
  | "opacity-slider"
  | "text";

export interface Token {
  name: string;   // e.g. "--primary"
  value: string;  // e.g. "oklch(0.205 0 0)"
  theme: Theme;
  group: TokenGroup;
}

export interface TokenEdit {
  name: string;
  value: string;
  theme: Theme;
}
```

- [ ] **Step 2: Write a fixture mirroring M0's block shape**

Create `tests/tokens/fixtures/sample.css` — small but exercises every parse/write concern (comments, multiple groups, both themes, a value-with-spaces, a value-with-commas):

```css
@import "tailwindcss";

:root {
  /* color: semantic */
  --background: oklch(1 0 0);
  --primary: oklch(0.205 0 0); /* trailing comment kept */
  --primary-foreground: oklch(0.985 0 0);
  --success: oklch(0.62 0.17 145);
  /* type */
  --fs-base: 1rem;
  --lh-base: 1.5rem;
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --fw-bold: 700;
  /* geometry + motion */
  --radius: 0.625rem;
  --border-width-base: 2px;
  --elevation-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
  --duration-base: 250ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --spacing-base: 0.25rem;
  --z-modal: 1300;
  --opacity-muted: 0.7;
  --container-md: 48rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
}

@theme inline {
  /* MUST NOT be parsed as runtime tokens or written to */
  --color-primary: var(--primary);
  --spacing: var(--spacing-base);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/tokens/types.ts tests/tokens/fixtures/sample.css
git commit -m "feat(m1): token types + parse/write fixture"
```

---

## Task 2: `schema.ts` — group inference + control mapping + pairing

Pure functions. `groupForName` enforces the naming convention by **throwing on unknown names** — drift surfaces loudly rather than silently defaulting.

**Files:**
- Create: `lib/tokens/schema.ts`
- Create: `tests/tokens/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tokens/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupForName, controlForGroup, foregroundFor } from "@/lib/tokens/schema";

describe("groupForName", () => {
  it.each([
    ["--background", "color"],
    ["--primary", "color"],
    ["--primary-foreground", "color"],
    ["--success", "color"],
    ["--brand-500", "color"],
    ["--chart-3", "color"],
    ["--font-sans", "fontFamily"],
    ["--fs-lg", "fontSize"],
    ["--lh-lg", "lineHeight"],
    ["--fw-bold", "fontWeight"],
    ["--radius", "radius"],
    ["--border-width-thick", "borderWidth"],
    ["--elevation-md", "shadow"],
    ["--duration-base", "duration"],
    ["--ease-standard", "easing"],
    ["--spacing-base", "spacing"],
    ["--z-modal", "zIndex"],
    ["--opacity-muted", "opacity"],
    ["--container-md", "container"],
  ])("maps %s -> %s", (name, group) => {
    expect(groupForName(name)).toBe(group);
  });

  it("throws on a name outside the convention", () => {
    expect(() => groupForName("--mystery")).toThrow(/unknown token/i);
  });
});

describe("controlForGroup", () => {
  it.each([
    ["color", "color"],
    ["fontFamily", "select"],
    ["fontSize", "length-slider"],
    ["lineHeight", "length-slider"],
    ["borderWidth", "length-slider"],
    ["spacing", "length-slider"],
    ["duration", "duration-slider"],
    ["easing", "easing"],
    ["zIndex", "number"],
    ["opacity", "opacity-slider"],
    ["shadow", "text"],
  ] as const)("maps %s -> %s", (group, control) => {
    expect(controlForGroup(group)).toBe(control);
  });
});

describe("foregroundFor", () => {
  it("pairs a bg token with its -foreground", () => {
    expect(foregroundFor("--primary")).toBe("--primary-foreground");
  });
  it("returns null for a token that has no foreground pair", () => {
    expect(foregroundFor("--primary-foreground")).toBeNull();
    expect(foregroundFor("--radius")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/tokens/schema.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tokens/schema'`.

- [ ] **Step 3: Implement `schema.ts`**

Create `lib/tokens/schema.ts`:

```ts
import type { TokenGroup, ControlType } from "./types";

// Semantic color roles (shadcn + status). Ramp/chart handled by prefix below.
const COLOR_ROLES = new Set([
  "background", "foreground", "card", "card-foreground",
  "popover", "popover-foreground", "primary", "primary-foreground",
  "secondary", "secondary-foreground", "muted", "muted-foreground",
  "accent", "accent-foreground", "destructive", "destructive-foreground",
  "success", "success-foreground", "warning", "warning-foreground",
  "info", "info-foreground", "border", "input", "ring",
]);

export function groupForName(name: string): TokenGroup {
  if (!name.startsWith("--")) throw new Error(`unknown token: ${name}`);
  const bare = name.slice(2);

  if (name === "--radius") return "radius";
  if (/^border-width-/.test(bare)) return "borderWidth";
  if (name === "--spacing-base") return "spacing";
  if (/^brand-/.test(bare) || /^chart-/.test(bare)) return "color";
  if (/^font-(sans|mono|serif)$/.test(bare)) return "fontFamily";
  if (/^fs-/.test(bare)) return "fontSize";
  if (/^lh-/.test(bare)) return "lineHeight";
  if (/^fw-/.test(bare)) return "fontWeight";
  if (/^elevation-/.test(bare)) return "shadow";
  if (/^duration-/.test(bare)) return "duration";
  if (/^ease-/.test(bare)) return "easing";
  if (/^z-/.test(bare)) return "zIndex";
  if (/^opacity-/.test(bare)) return "opacity";
  if (/^container-/.test(bare)) return "container";
  if (COLOR_ROLES.has(bare)) return "color";

  throw new Error(`unknown token: ${name} (not in naming convention)`);
}

const CONTROL: Record<TokenGroup, ControlType> = {
  color: "color",
  fontFamily: "select",
  fontSize: "length-slider",
  lineHeight: "length-slider",
  fontWeight: "select",
  radius: "length-slider",
  borderWidth: "length-slider",
  shadow: "text",
  duration: "duration-slider",
  easing: "easing",
  spacing: "length-slider",
  zIndex: "number",
  opacity: "opacity-slider",
  container: "length-slider",
};

export function controlForGroup(group: TokenGroup): ControlType {
  return CONTROL[group];
}

/** The -foreground partner of a bg color token, or null if none / if this IS a foreground. */
export function foregroundFor(name: string): string | null {
  if (name.endsWith("-foreground")) return null;
  const bare = name.slice(2);
  return COLOR_ROLES.has(`${bare}-foreground`) ? `${name}-foreground` : null;
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/tokens/schema.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/schema.ts tests/tokens/schema.test.ts
git commit -m "feat(m1): token schema — group inference, control map, fg/bg pairing"
```

---

## Task 3: `parse.ts` — `:root`/`.dark` → `Token[]`

**Files:**
- Create: `lib/tokens/parse.ts`
- Create: `tests/tokens/parse.test.ts`

- [ ] **Step 1: Ensure PostCSS is available**

```bash
npm i postcss
```

(Likely already transitive via Tailwind; install explicitly so it's a direct dependency.)

- [ ] **Step 2: Write the failing tests**

Create `tests/tokens/parse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";

const css = readFileSync(resolve("tests/tokens/fixtures/sample.css"), "utf8");

describe("parseTokens", () => {
  const tokens = parseTokens(css);

  it("reads light tokens from :root", () => {
    const primary = tokens.find((t) => t.name === "--primary" && t.theme === "light");
    expect(primary?.value).toBe("oklch(0.205 0 0)");
    expect(primary?.group).toBe("color");
  });

  it("reads dark tokens from .dark", () => {
    const primary = tokens.find((t) => t.name === "--primary" && t.theme === "dark");
    expect(primary?.value).toBe("oklch(0.922 0 0)");
  });

  it("keeps comma/space values intact", () => {
    const shadow = tokens.find((t) => t.name === "--elevation-md");
    expect(shadow?.value).toContain("0 4px 6px -1px");
    expect(shadow?.value).toContain(", 0 2px 4px -2px");
    const font = tokens.find((t) => t.name === "--font-sans");
    expect(font?.value).toBe("ui-sans-serif, system-ui, sans-serif");
  });

  it("does NOT parse @theme inline declarations as tokens", () => {
    expect(tokens.find((t) => t.name === "--color-primary")).toBeUndefined();
    // --spacing inside @theme must not appear; only the :root --spacing-base does
    expect(tokens.some((t) => t.name === "--spacing")).toBe(false);
    expect(tokens.some((t) => t.name === "--spacing-base")).toBe(true);
  });

  it("tags every token with a group", () => {
    expect(tokens.every((t) => typeof t.group === "string")).toBe(true);
  });
});
```

- [ ] **Step 3: Run — verify it fails**

Run: `npx vitest run tests/tokens/parse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `parse.ts`**

Create `lib/tokens/parse.ts`:

```ts
import postcss from "postcss";
import type { Token, Theme } from "./types";
import { groupForName } from "./schema";

const THEME_FOR_SELECTOR: Record<string, Theme> = {
  ":root": "light",
  ".dark": "dark",
};

/** Parse only the :root and .dark rule blocks into typed tokens. @theme is ignored. */
export function parseTokens(css: string): Token[] {
  const root = postcss.parse(css);
  const tokens: Token[] = [];

  root.walkRules((rule) => {
    const theme = THEME_FOR_SELECTOR[rule.selector.trim()];
    if (!theme) return; // skip @theme (an at-rule anyway) and any other selector
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) return;
      tokens.push({
        name: decl.prop,
        value: decl.value.trim(),
        theme,
        group: groupForName(decl.prop),
      });
    });
  });

  return tokens;
}
```

- [ ] **Step 5: Run — verify pass**

Run: `npx vitest run tests/tokens/parse.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/tokens/parse.ts tests/tokens/parse.test.ts package.json package-lock.json
git commit -m "feat(m1): parse :root/.dark into typed tokens (postcss, @theme ignored)"
```

---

## Task 4: `validate.ts` — injection rejection + per-group shape

Security boundary (spec §5): the value flows into a CSS declaration. Reject delimiter break-outs first, then check the value matches its group's shape.

**Files:**
- Create: `lib/tokens/validate.ts`
- Create: `tests/tokens/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tokens/validate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateValue } from "@/lib/tokens/validate";

describe("validateValue — injection", () => {
  it.each([
    "red; } body { display:none",
    "oklch(1 0 0) } .x{",
    "1rem /* nope */",
    "url(x);",
  ])("rejects injection payload %s", (bad) => {
    expect(() => validateValue("color", bad)).toThrow(/invalid|injection|delimiter/i);
  });
});

describe("validateValue — per group", () => {
  it("accepts oklch / var / color-mix / hex for color", () => {
    expect(() => validateValue("color", "oklch(0.2 0 0)")).not.toThrow();
    expect(() => validateValue("color", "var(--primary)")).not.toThrow();
    expect(() => validateValue("color", "color-mix(in oklch, var(--a), var(--b))")).not.toThrow();
    expect(() => validateValue("color", "#1a2b3c")).not.toThrow();
  });
  it("rejects a non-color for color", () => {
    expect(() => validateValue("color", "1rem")).toThrow();
  });
  it("accepts length units for length groups", () => {
    expect(() => validateValue("fontSize", "1.125rem")).not.toThrow();
    expect(() => validateValue("spacing", "0.25rem")).not.toThrow();
    expect(() => validateValue("radius", "calc(var(--radius) - 4px)")).not.toThrow();
  });
  it("validates duration / zIndex / opacity / fontWeight shapes", () => {
    expect(() => validateValue("duration", "250ms")).not.toThrow();
    expect(() => validateValue("duration", "blue")).toThrow();
    expect(() => validateValue("zIndex", "1300")).not.toThrow();
    expect(() => validateValue("zIndex", "1.5")).toThrow();
    expect(() => validateValue("opacity", "0.7")).not.toThrow();
    expect(() => validateValue("opacity", "2")).toThrow();
    expect(() => validateValue("fontWeight", "700")).not.toThrow();
    expect(() => validateValue("fontWeight", "950")).toThrow();
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/tokens/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `validate.ts`**

Create `lib/tokens/validate.ts`:

```ts
import type { TokenGroup } from "./types";

// Characters that would let a value break out of `--name: value;`
const INJECTION = /[;{}]|\/\*|\*\//;

const LENGTH = /^-?(\d*\.?\d+)(rem|px|em|%)$/;
const CALC = /^calc\(.+\)$/;
const isLength = (v: string) => LENGTH.test(v) || CALC.test(v) || /^var\(--[\w-]+\)$/.test(v);

function checkGroup(group: TokenGroup, v: string): boolean {
  switch (group) {
    case "color":
      return /^(oklch|rgb|rgba|hsl|hsla|color-mix|var)\(.+\)$/.test(v) || /^#[0-9a-fA-F]{3,8}$/.test(v);
    case "fontSize":
    case "lineHeight":
    case "radius":
    case "borderWidth":
    case "spacing":
    case "container":
      return isLength(v);
    case "fontFamily":
      return v.length > 0; // any font stack; injection already screened
    case "fontWeight": {
      const n = Number(v);
      return Number.isInteger(n) && n >= 100 && n <= 900 && n % 100 === 0;
    }
    case "shadow":
      return v.length > 0;
    case "duration":
      return /^(\d*\.?\d+)(ms|s)$/.test(v);
    case "easing":
      return /^(cubic-bezier\(.+\)|linear|ease|ease-in|ease-out|ease-in-out|steps\(.+\))$/.test(v);
    case "zIndex": {
      const n = Number(v);
      return Number.isInteger(n);
    }
    case "opacity": {
      const n = Number(v);
      return !Number.isNaN(n) && n >= 0 && n <= 1;
    }
  }
}

/** Throws if `value` is unsafe or wrong-shaped for `group`. */
export function validateValue(group: TokenGroup, value: string): void {
  const v = value.trim();
  if (INJECTION.test(v)) throw new Error(`invalid value (delimiter / injection): ${value}`);
  if (!checkGroup(group, v)) throw new Error(`invalid value for ${group}: ${value}`);
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/tokens/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/validate.ts tests/tokens/validate.test.ts
git commit -m "feat(m1): value validation — injection rejection + per-group shape"
```

---

## Task 5: `write.ts` — re-read, update one decl, atomic write

Composes validate + AST update + atomic IO. Must: re-read the file (catch external edits), update exactly one declaration in the right theme block, preserve everything else, write temp-then-rename, and refuse unknown tokens (no creation via the editor — spec §5).

**Files:**
- Create: `lib/tokens/write.ts`
- Create: `tests/tokens/write.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tokens/write.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { writeToken } from "@/lib/tokens/write";
import { parseTokens } from "@/lib/tokens/parse";

const FIXTURE = resolve("tests/tokens/fixtures/sample.css");
let file: string;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "ds-write-"));
  file = join(dir, "globals.css");
  copyFileSync(FIXTURE, file);
});

describe("writeToken", () => {
  it("updates exactly one declaration in :root", async () => {
    await writeToken(file, { name: "--primary", value: "oklch(0.5 0.1 250)", theme: "light" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--primary" && t.theme === "light")?.value)
      .toBe("oklch(0.5 0.1 250)");
    // dark --primary untouched
    expect(tokens.find((t) => t.name === "--primary" && t.theme === "dark")?.value)
      .toBe("oklch(0.922 0 0)");
  });

  it("writes to the .dark block when theme=dark", async () => {
    await writeToken(file, { name: "--primary", value: "oklch(0.8 0 0)", theme: "dark" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--primary" && t.theme === "dark")?.value)
      .toBe("oklch(0.8 0 0)");
  });

  it("preserves comments and surrounding declarations", async () => {
    await writeToken(file, { name: "--primary", value: "oklch(0.5 0.1 250)", theme: "light" });
    const out = readFileSync(file, "utf8");
    expect(out).toContain("/* trailing comment kept */");
    expect(out).toContain("/* color: semantic */");
    expect(out).toContain("--background: oklch(1 0 0);");
  });

  it("never writes into the @theme inline block", async () => {
    await writeToken(file, { name: "--spacing-base", value: "0.3rem", theme: "light" });
    const out = readFileSync(file, "utf8");
    expect(out).toContain("--spacing: var(--spacing-base);"); // @theme line intact
    expect(out).toContain("--spacing-base: 0.3rem;");
  });

  it("rejects an unknown token (no creation via editor)", async () => {
    await expect(
      writeToken(file, { name: "--does-not-exist", value: "oklch(0 0 0)", theme: "light" }),
    ).rejects.toThrow(/not found/i);
  });

  it("rejects an injection value before touching the file", async () => {
    const before = readFileSync(file, "utf8");
    await expect(
      writeToken(file, { name: "--primary", value: "red; } body{", theme: "light" }),
    ).rejects.toThrow(/invalid/i);
    expect(readFileSync(file, "utf8")).toBe(before); // unchanged
  });

  it("picks up an external edit (re-reads before writing)", async () => {
    // simulate the LLM/human adding a token to the file after load
    const edited = readFileSync(file, "utf8").replace(
      "--background: oklch(1 0 0);",
      "--background: oklch(1 0 0);\n  --accent: oklch(0.97 0 0);",
    );
    writeFileSync(file, edited);
    await writeToken(file, { name: "--accent", value: "oklch(0.5 0 0)", theme: "light" });
    const tokens = parseTokens(readFileSync(file, "utf8"));
    expect(tokens.find((t) => t.name === "--accent")?.value).toBe("oklch(0.5 0 0)");
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/tokens/write.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `write.ts`**

Create `lib/tokens/write.ts`:

```ts
import postcss from "postcss";
import { readFile, writeFile, rename } from "node:fs/promises";
import type { TokenEdit } from "./types";
import { groupForName } from "./schema";
import { validateValue } from "./validate";

const SELECTOR_FOR_THEME = { light: ":root", dark: ".dark" } as const;

/**
 * Update exactly one CSS custom property in the correct theme block of `filePath`,
 * preserving all formatting/comments/ordering, validating the value, writing atomically.
 * Re-reads the file first so it never writes against a stale snapshot. Throws if the
 * token does not already exist (the editor edits, it does not create).
 */
export async function writeToken(filePath: string, edit: TokenEdit): Promise<void> {
  const { name, value, theme } = edit;

  // 1. validate (throws before any IO)
  validateValue(groupForName(name), value);

  // 2. re-read current file
  const css = await readFile(filePath, "utf8");
  const root = postcss.parse(css);
  const selector = SELECTOR_FOR_THEME[theme];

  // 3. update exactly one declaration
  let updated = 0;
  root.walkRules((rule) => {
    if (rule.selector.trim() !== selector) return;
    rule.walkDecls(name, (decl) => {
      decl.value = value;
      updated += 1;
    });
  });
  if (updated === 0) throw new Error(`token ${name} not found in ${selector}`);

  // 4. atomic write: temp then rename (Next watcher never sees a half-written file)
  const out = root.toString();
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, out, "utf8");
  await rename(tmp, filePath);
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/tokens/write.test.ts`
Expected: PASS (all cases, including injection-leaves-file-unchanged and external-edit-re-read).

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/write.ts tests/tokens/write.test.ts
git commit -m "feat(m1): atomic single-declaration writeback with re-read + validation"
```

---

## Task 6: Round-trip integration + M1 done-check

Prove the load-bearing property against the **real** `app/globals.css`: parse → write every token → re-parse → values match, file still parses, formatting stable.

**Files:**
- Create: `tests/tokens/roundtrip.test.ts`

- [ ] **Step 1: Write the round-trip test**

Create `tests/tokens/roundtrip.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { writeToken } from "@/lib/tokens/write";

const REAL = resolve("app/globals.css");

describe("round-trip against the real globals.css", () => {
  it("every token can be rewritten and re-read losslessly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-rt-"));
    const file = join(dir, "globals.css");
    copyFileSync(REAL, file);

    const before = parseTokens(readFileSync(file, "utf8"));
    expect(before.length).toBeGreaterThan(20); // sanity: full token set present

    // rewrite each token with its OWN value — must be a no-op-equivalent that still parses
    for (const t of before) {
      await writeToken(file, { name: t.name, value: t.value, theme: t.theme });
    }

    const after = parseTokens(readFileSync(file, "utf8"));
    expect(after).toEqual(before); // same names, values, themes, groups
  });

  it("a changed token lands and nothing else moves", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-rt2-"));
    const file = join(dir, "globals.css");
    copyFileSync(REAL, file);
    const before = readFileSync(file, "utf8");

    await writeToken(file, { name: "--radius", value: "0.75rem", theme: "light" });
    const after = readFileSync(file, "utf8");

    // exactly one line differs
    const diff = after.split("\n").filter((l, i) => l !== before.split("\n")[i]);
    expect(diff.length).toBe(1);
    expect(diff[0]).toContain("--radius: 0.75rem;");
  });
});
```

- [ ] **Step 2: Run the full M1 suite**

Run:

```bash
npx vitest run tests/tokens
```

Expected: ALL pass. If the round-trip `toEqual` fails, the failure names the token whose value changed under re-write — fix `write.ts` formatting handling, not the assertion. If "one line differs" fails with >1, postcss reformatted untouched nodes — investigate `decl.value` assignment vs replacing the decl.

- [ ] **Step 3: Commit**

```bash
git add tests/tokens/roundtrip.test.ts
git commit -m "test(m1): round-trip parse/write against real globals.css (lossless)"
```

---

## M1 Done Criteria (spec §10)

- [ ] Can programmatically change **any** token in `globals.css` safely, preserving formatting, in either theme (Task 5 + round-trip Task 6).
- [ ] `:root` and `.dark` parsed; `@theme inline` never parsed or written (Task 3, Task 5).
- [ ] All value types handled; malformed/injection input rejected before IO (Task 4, Task 5).
- [ ] Writes are atomic (temp-then-rename) and re-read before writing (Task 5).
- [ ] Group inference + control mapping + fg/bg pairing exist and are tested (Task 2).

## Hand-off to M2

M2 (manifest generation) consumes `parseTokens()` + `schema.ts` to emit `design-system.{md,json}`. The `Token` shape (Task 1) and `groupForName`/`controlForGroup` (Task 2) are M2's inputs — stable API. M4 (editor) consumes `writeToken()` behind the dev-only API route; the route owns write-then-regenerate ordering (spec §5), `write.ts` owns the atomic single-declaration rewrite.
