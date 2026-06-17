# M2 — Manifest Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the LLM-facing manifest — `design-system.md` (human/LLM brief: token table, usage rules, extension procedure) and `design-system.json` (machine-clean: every token, both theme values, group, Tailwind utilities) — deterministically from `globals.css`, runnable via `npm run tokens` and a dev watcher, so the manifest never goes stale.

**Architecture:** Cold-path generation (spec §2). `generate.ts` is a pure transform: `Token[]` (from M1's `parseTokens`) → a per-name manifest object (light+dark values merged) → JSON + Markdown. A thin CLI script reads `app/globals.css`, calls the transform, writes both files. A chokidar watcher reruns it on save. Output ordering is **deterministic** (group order, then name) so M5's CI freshness-diff is stable.

**Tech Stack:** TypeScript 5, M1's `lib/tokens` (parse/schema/types), chokidar, `tsx` (run TS scripts), Vitest.

**Scope note:** M2 of the spec at [docs/specs/2026-06-16-design-system-starter-design.md](../../specs/2026-06-16-design-system-starter-design.md) (§6.4 manifest, §2 cold path, §10 M2). Depends on **M1 landed** (`lib/tokens/parse.ts`, `schema.ts`, `types.ts`). The CI freshness *gate* itself is M5 (lint); M2 only builds the generator + `npm run tokens` + watch. M2 done-criteria (spec §10): manifest always reflects the vars.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/tokens/utilities.ts` | `utilitiesForToken()` — token → the Tailwind utility/utilities an LLM should use |
| `lib/tokens/generate.ts` | `buildManifest(tokens)` → `{ json, markdown }`; pure, deterministic |
| `scripts/generate-tokens.ts` | CLI: read `app/globals.css` → write `design-system.{md,json}` (the `npm run tokens` entry) |
| `scripts/watch-tokens.ts` | chokidar watcher → rerun generation on `globals.css` change |
| `tests/tokens/utilities.test.ts` | utility-mapping cases |
| `tests/tokens/generate.test.ts` | fixture in → manifest out (spec §9: "fixture-defined") |
| `design-system.md`, `design-system.json` | generated artifacts (committed; regenerated on save) |

Decomposition rationale: `utilitiesForToken` is the one piece of new domain logic — isolate and test it alone. `generate.ts` is a deterministic assembler over M1 types. The scripts are thin IO wrappers (one for one-shot, one for watch) so the transform stays pure and testable.

---

## Task 0: Precondition — confirm prefixes + group union match M1

`utilitiesForToken` strips the M0/M1 base-name prefixes (`fs-`, `lh-`, `fw-`, `elevation-`, `border-width-`, etc.). These come from [docs/NAMING-CONVENTION.md](../../NAMING-CONVENTION.md). Before implementing:

- [ ] **Step 1: Verify the `TokenGroup` union and prefixes**

Run:

```bash
grep -c 'borderWidth' lib/tokens/types.ts && echo "GROUP OK"
grep -q -- '--fs-' app/globals.css && grep -q -- '--border-width-' app/globals.css && echo "PREFIX OK"
```

Expected: `GROUP OK` and `PREFIX OK`. If a prefix differs from what `utilitiesForToken` strips (e.g. M0 named type tokens `--text-*` instead of `--fs-*`), update the regex in Task 1 Step 3 to match the actual convention — the fixture would otherwise pass while the real `globals.css` emits broken utilities like `text-text-lg`. The `default:` exhaustiveness guard in Task 1 will throw loudly if any group is unhandled, so a missed group fails fast rather than producing `undefined`.

---

## Task 1: `utilitiesForToken` — token → Tailwind utilities

The manifest's value to an LLM is telling it *which class to type*. This maps each token to its utility(ies), per the M0 wiring.

**Files:**
- Create: `lib/tokens/utilities.ts`
- Create: `tests/tokens/utilities.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tokens/utilities.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { utilitiesForToken } from "@/lib/tokens/utilities";
import type { Token } from "@/lib/tokens/types";

const tok = (name: string, group: Token["group"]): Token =>
  ({ name, value: "x", theme: "light", group });

describe("utilitiesForToken", () => {
  it("bg/text/border for a semantic color", () => {
    expect(utilitiesForToken(tok("--primary", "color")).utilities)
      .toEqual(["bg-primary", "text-primary", "border-primary"]);
  });
  it("text-only for a -foreground color", () => {
    expect(utilitiesForToken(tok("--primary-foreground", "color")).utilities)
      .toEqual(["text-primary-foreground"]);
  });
  it("ramp + chart colors", () => {
    expect(utilitiesForToken(tok("--brand-500", "color")).utilities).toContain("bg-brand-500");
    expect(utilitiesForToken(tok("--chart-1", "color")).utilities).toContain("bg-chart-1");
  });
  it("non-paintable semantic colors map to specific utilities", () => {
    expect(utilitiesForToken(tok("--ring", "color")).utilities).toContain("ring-ring");
    expect(utilitiesForToken(tok("--border", "color")).utilities).toEqual(["border-border"]);
    expect(utilitiesForToken(tok("--input", "color")).utilities).toEqual(["border-input"]);
  });
  it("type size -> text-<step>", () => {
    expect(utilitiesForToken(tok("--fs-lg", "fontSize")).utilities).toEqual(["text-lg"]);
  });
  it("font weight / family", () => {
    expect(utilitiesForToken(tok("--fw-bold", "fontWeight")).utilities).toEqual(["font-bold"]);
    expect(utilitiesForToken(tok("--font-sans", "fontFamily")).utilities).toEqual(["font-sans"]);
  });
  it("shadow / radius / border-width / easing / z / opacity / container", () => {
    expect(utilitiesForToken(tok("--elevation-md", "shadow")).utilities).toEqual(["shadow-md"]);
    expect(utilitiesForToken(tok("--radius", "radius")).utilities).toContain("rounded-lg");
    expect(utilitiesForToken(tok("--border-width-thick", "borderWidth")).utilities).toEqual(["border-thick"]);
    expect(utilitiesForToken(tok("--ease-standard", "easing")).utilities).toEqual(["ease-standard"]);
    expect(utilitiesForToken(tok("--z-modal", "zIndex")).utilities).toEqual(["z-modal"]);
    expect(utilitiesForToken(tok("--opacity-muted", "opacity")).utilities).toEqual(["opacity-muted"]);
    expect(utilitiesForToken(tok("--container-md", "container")).utilities).toEqual(["max-w-md"]);
  });
  it("groups with no standalone utility carry a usage note", () => {
    expect(utilitiesForToken(tok("--lh-base", "lineHeight")).usage).toMatch(/text-base/);
    expect(utilitiesForToken(tok("--spacing-base", "spacing")).usage).toMatch(/scale/i);
    expect(utilitiesForToken(tok("--duration-base", "duration")).usage).toMatch(/var\(--duration-base\)/);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/tokens/utilities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `utilities.ts`**

Create `lib/tokens/utilities.ts`:

```ts
import type { Token } from "./types";

export interface UtilityHint {
  utilities: string[];
  usage?: string;
}

export function utilitiesForToken(t: Token): UtilityHint {
  const bare = t.name.slice(2);
  switch (t.group) {
    case "color":
      if (bare.endsWith("-foreground")) return { utilities: [`text-${bare}`] };
      // non-paintable semantic colors map to specific utilities, not bg/text/border
      if (bare === "ring") return { utilities: ["ring-ring", "outline-ring"] };
      if (bare === "border") return { utilities: ["border-border"] };
      if (bare === "input") return { utilities: ["border-input"] };
      return { utilities: [`bg-${bare}`, `text-${bare}`, `border-${bare}`] };
    case "fontSize":
      return { utilities: [`text-${bare.replace(/^fs-/, "")}`] };
    case "lineHeight":
      return { utilities: [], usage: `applied with text-${bare.replace(/^lh-/, "")}` };
    case "fontWeight":
      return { utilities: [`font-${bare.replace(/^fw-/, "")}`] };
    case "fontFamily":
      return { utilities: [`font-${bare.replace(/^font-/, "")}`] };
    case "radius":
      return { utilities: ["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"], usage: "--radius is the knob; sm/md/lg/xl derived" };
    case "borderWidth":
      return { utilities: [`border-${bare.replace(/^border-width-/, "")}`] };
    case "shadow":
      return { utilities: [`shadow-${bare.replace(/^elevation-/, "")}`] };
    case "spacing":
      return { utilities: [], usage: "p-<n>/m-<n>/gap-<n> — whole numeric scale derives from --spacing-base" };
    case "zIndex":
      return { utilities: [`z-${bare.replace(/^z-/, "")}`] };
    case "opacity":
      return { utilities: [`opacity-${bare.replace(/^opacity-/, "")}`] };
    case "container":
      return { utilities: [`max-w-${bare.replace(/^container-/, "")}`] };
    case "duration":
      return { utilities: [], usage: `transition-duration via var(${t.name})` };
    case "easing":
      return { utilities: [`ease-${bare.replace(/^ease-/, "")}`] };
    default: {
      // exhaustiveness guard: a new TokenGroup must be handled here, not silently undefined
      const _never: never = t.group;
      throw new Error(`utilitiesForToken: unhandled group ${_never} for ${t.name}`);
    }
  }
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/tokens/utilities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/utilities.ts tests/tokens/utilities.test.ts
git commit -m "feat(m2): token -> Tailwind utility mapping"
```

---

## Task 2: `generate.ts` — deterministic manifest builder

Merge per-theme `Token[]` into per-name entries (light+dark values), emit JSON + Markdown. Deterministic ordering so the CI freshness-diff (M5) is stable.

**Files:**
- Create: `lib/tokens/generate.ts`
- Create: `tests/tokens/generate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/tokens/generate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { buildManifest } from "@/lib/tokens/generate";

const css = readFileSync(resolve("tests/tokens/fixtures/sample.css"), "utf8");
const { json, markdown } = buildManifest(parseTokens(css));

describe("buildManifest — json", () => {
  it("merges light + dark values per token name", () => {
    const primary = json.tokens.find((t) => t.name === "--primary");
    expect(primary?.values).toEqual({ light: "oklch(0.205 0 0)", dark: "oklch(0.922 0 0)" });
  });
  it("light-only tokens have no dark value", () => {
    const radius = json.tokens.find((t) => t.name === "--radius");
    expect(radius?.values.light).toBe("0.625rem");
    expect(radius?.values.dark).toBeUndefined();
  });
  it("carries group + utilities", () => {
    const primary = json.tokens.find((t) => t.name === "--primary");
    expect(primary?.group).toBe("color");
    expect(primary?.utilities).toContain("bg-primary");
  });
  it("is deterministic — stable order, no @theme tokens", () => {
    const again = buildManifest(parseTokens(css)).json;
    expect(JSON.stringify(again)).toBe(JSON.stringify(json));
    expect(json.tokens.some((t) => t.name === "--color-primary")).toBe(false);
  });
});

describe("buildManifest — markdown", () => {
  it("includes the extension procedure and a token table", () => {
    expect(markdown).toMatch(/extension procedure/i);
    expect(markdown).toContain("--primary");
    expect(markdown).toContain("bg-primary");
    expect(markdown).toMatch(/never hardcode/i);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `npx vitest run tests/tokens/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `generate.ts`**

Create `lib/tokens/generate.ts`:

```ts
import type { Token, TokenGroup } from "./types";
import { utilitiesForToken } from "./utilities";

export interface ManifestToken {
  name: string;
  group: TokenGroup;
  values: { light?: string; dark?: string };
  utilities: string[];
  usage?: string;
}
export interface Manifest {
  generatedFrom: string;
  tokens: ManifestToken[];
}

const GROUP_ORDER: TokenGroup[] = [
  "color", "fontFamily", "fontSize", "lineHeight", "fontWeight",
  "spacing", "radius", "borderWidth", "shadow", "duration", "easing",
  "zIndex", "opacity", "container",
];

function mergeByName(tokens: Token[]): ManifestToken[] {
  const byName = new Map<string, ManifestToken>();
  for (const t of tokens) {
    let entry = byName.get(t.name);
    if (!entry) {
      const hint = utilitiesForToken(t);
      entry = { name: t.name, group: t.group, values: {}, utilities: hint.utilities, ...(hint.usage ? { usage: hint.usage } : {}) };
      byName.set(t.name, entry);
    }
    entry.values[t.theme] = t.value;
  }
  // deterministic: group order, then name
  return [...byName.values()].sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    return g !== 0 ? g : a.name.localeCompare(b.name);
  });
}

const PREAMBLE = `# Design System — token reference

> **Generated from \`app/globals.css\`. Do not edit by hand — run \`npm run tokens\`.**

## Usage rules
- Style with Tailwind utilities that map to tokens (\`bg-primary\`, \`text-lg\`, \`p-4\`, \`rounded-lg\`).
- **Never hardcode** a color / size / font / duration. Off-token color & type utilities won't compile; off-scale spacing is flagged by lint.

## Extension procedure
Need a value the system lacks? **Add a token** to \`app/globals.css\` — for a color, add it to BOTH \`:root\` and \`.dark\` — then run \`npm run tokens\` and use it via its Tailwind utility. **Never hardcode.** The new token auto-appears on \`/design-system\` and becomes editable.
`;

function markdownTable(tokens: ManifestToken[]): string {
  const rows = tokens.map((t) => {
    const util = t.utilities.length ? t.utilities.join(" ") : (t.usage ?? "");
    const dark = t.values.dark ? ` / ${t.values.dark}` : "";
    return `| \`${t.name}\` | ${t.group} | \`${t.values.light ?? ""}\`${dark ? " /" + " `" + t.values.dark + "`" : ""} | ${util} |`;
  });
  return ["| Token | Group | Value (light / dark) | Utilities |", "|---|---|---|---|", ...rows].join("\n");
}

export function buildManifest(tokens: Token[], source = "app/globals.css"): { json: Manifest; markdown: string } {
  const merged = mergeByName(tokens);
  const json: Manifest = { generatedFrom: source, tokens: merged };
  const markdown = `${PREAMBLE}\n## Tokens\n\n${markdownTable(merged)}\n`;
  return { json, markdown };
}
```

> The `markdownTable` row builder above is intentionally explicit about the light/dark value cell. Simplify the cell formatting if a test reveals an awkward render — the *test* (table contains `--primary` and `bg-primary`) is the contract, not the exact cell punctuation.

- [ ] **Step 4: Run — verify pass**

Run: `npx vitest run tests/tokens/generate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/tokens/generate.ts tests/tokens/generate.test.ts
git commit -m "feat(m2): deterministic manifest builder (json + markdown)"
```

---

## Task 3: `npm run tokens` — write the real manifest

**Files:**
- Create: `scripts/generate-tokens.ts`
- Modify: `package.json` (scripts + `tsx` devDep)

- [ ] **Step 1: Add `tsx`**

```bash
npm i -D tsx
```

- [ ] **Step 2: Write the CLI script**

Create `scripts/generate-tokens.ts`:

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "../lib/tokens/parse";
import { buildManifest } from "../lib/tokens/generate";

const GLOBALS = resolve("app/globals.css");
const css = readFileSync(GLOBALS, "utf8");
const { json, markdown } = buildManifest(parseTokens(css));

writeFileSync(resolve("design-system.json"), JSON.stringify(json, null, 2) + "\n", "utf8");
writeFileSync(resolve("design-system.md"), markdown, "utf8");

console.log(`tokens: wrote design-system.{json,md} (${json.tokens.length} tokens)`);
```

- [ ] **Step 3: Wire the script**

Add to `package.json` `scripts`: `"tokens": "tsx scripts/generate-tokens.ts"`.

- [ ] **Step 4: Run it against the real globals.css**

Run:

```bash
npm run tokens
```

Expected: prints `tokens: wrote design-system.{json,md} (N tokens)` with N matching the M0 token count (~40+ names). `design-system.json` and `design-system.md` appear at repo root.

- [ ] **Step 5: Verify the manifest reflects the vars**

Run:

```bash
node -e "const m=require('./design-system.json'); const p=m.tokens.find(t=>t.name==='--primary'); console.log(p.values.light, p.values.dark, p.utilities.join(','))"
```

Expected: prints primary's light + dark OKLCH values and `bg-primary,text-primary,border-primary`.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-tokens.ts package.json package-lock.json design-system.json design-system.md
git commit -m "feat(m2): npm run tokens — generate design-system.{json,md}"
```

---

## Task 4: Dev watch — regenerate on save

**Files:**
- Create: `scripts/watch-tokens.ts`
- Modify: `package.json` (scripts; integrate with `dev`)

- [ ] **Step 1: Add chokidar**

```bash
npm i -D chokidar concurrently
```

- [ ] **Step 2: Write the watcher**

Create `scripts/watch-tokens.ts`:

```ts
import { watch } from "chokidar";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const GLOBALS = resolve("app/globals.css");

function regen() {
  try {
    execFileSync("npx", ["tsx", "scripts/generate-tokens.ts"], { stdio: "inherit" });
  } catch {
    // a transient half-written file (atomic rename should prevent this) — next event recovers
  }
}

console.log("tokens: watching app/globals.css");
watch(GLOBALS, { ignoreInitial: true }).on("change", regen);
```

- [ ] **Step 3: Wire scripts**

In `package.json` `scripts`:
- `"tokens:watch": "tsx scripts/watch-tokens.ts"`
- Change `"dev"` to run Next + the watcher together: `"dev": "concurrently -n next,tokens \"next dev\" \"npm run tokens:watch\""`

(Keep the original Next dev command intact inside the concurrently call — match whatever M0's scaffold produced, e.g. `next dev` or `next dev --turbopack`.)

- [ ] **Step 4: Verify the watcher regenerates**

Run (manual, non-blocking check):

```bash
npm run tokens:watch &
sleep 2
# bump a token's value via M1's write-core, then confirm the manifest updates
node -e "require('tsx/cjs'); (async()=>{const {writeToken}=await import('./lib/tokens/write.ts'); await writeToken('app/globals.css',{name:'--radius',value:'0.7rem',theme:'light'});})()"
sleep 2
node -e "console.log(require('./design-system.json').tokens.find(t=>t.name==='--radius').values.light)"
kill %1
# restore
node -e "require('tsx/cjs'); (async()=>{const {writeToken}=await import('./lib/tokens/write.ts'); await writeToken('app/globals.css',{name:'--radius',value:'0.625rem',theme:'light'});})()"
npm run tokens
```

Expected: the middle `node` prints `0.7rem` (watcher regenerated after the write). Final `npm run tokens` restores the committed manifest.

> If the inline `tsx/cjs` invocation is awkward in the local Node version, substitute a tiny throwaway `.ts` script run with `npx tsx`. The assertion — "edit a token, manifest reflects it within a couple seconds" — is what matters.

- [ ] **Step 5: Commit**

```bash
git add scripts/watch-tokens.ts package.json package-lock.json
git commit -m "feat(m2): dev watch — regenerate manifest on globals.css change"
```

---

## Task 5: Freshness integration + M2 done-check

Prove the property: edit a token through M1's write-core, regenerate, manifest matches — the loop M5's CI gate will enforce.

**Files:**
- Create: `tests/tokens/freshness.test.ts`

- [ ] **Step 1: Write the freshness test**

Create `tests/tokens/freshness.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { writeToken } from "@/lib/tokens/write";
import { buildManifest } from "@/lib/tokens/generate";

describe("manifest freshness", () => {
  it("a written token is reflected in a freshly built manifest", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-fresh-"));
    const file = join(dir, "globals.css");
    copyFileSync(resolve("app/globals.css"), file);

    await writeToken(file, { name: "--primary", value: "oklch(0.5 0.1 250)", theme: "light" });
    const { json } = buildManifest(parseTokens(readFileSync(file, "utf8")));

    expect(json.tokens.find((t) => t.name === "--primary")?.values.light)
      .toBe("oklch(0.5 0.1 250)");
  });

  it("the committed manifest matches the current globals.css (the M5 gate, in miniature)", () => {
    const live = buildManifest(parseTokens(readFileSync(resolve("app/globals.css"), "utf8"))).json;
    const committed = JSON.parse(readFileSync(resolve("design-system.json"), "utf8"));
    expect(committed).toEqual(live);
  });
});
```

- [ ] **Step 2: Run the full M2 suite**

Run:

```bash
npm run tokens && npx vitest run tests/tokens
```

Expected: `npm run tokens` first (so the committed manifest is current), then ALL token tests pass — including the freshness check that the committed `design-system.json` equals a freshly-built one.

- [ ] **Step 3: Commit**

```bash
git add tests/tokens/freshness.test.ts design-system.json design-system.md
git commit -m "test(m2): manifest freshness — written token reflected; committed == live"
```

---

## M2 Done Criteria (spec §10)

- [ ] `generate.ts` produces `design-system.{md,json}` from `globals.css`, deterministically (Task 2).
- [ ] `npm run tokens` writes both artifacts (Task 3); `tokens:watch` regenerates on save, wired into `npm run dev` (Task 4).
- [ ] Manifest always reflects the vars — fixture tests + freshness test (Task 2, Task 5).
- [ ] Every manifest token carries both theme values, group, and Tailwind utilities (Task 1, Task 2).

## Hand-off to M3 / M5

M3 (design-system page) can render directly from `parseTokens()` (live) or `design-system.json`. M5 wires the freshness check (Task 5's second test, generalized) into CI as the blocking gate — `npm run tokens` then fail if the tree is dirty. The `Manifest`/`ManifestToken` shape (Task 2) is the stable artifact contract for both.
