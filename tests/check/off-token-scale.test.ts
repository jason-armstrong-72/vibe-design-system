import { describe, it, expect } from "vitest";
import { parseThemeSteps, checkOffTokenScale, type ThemeSteps } from "@/lib/check/off-token-scale";

// NOTE the decoy: a `:root` block AND a comment mentioning "@theme" come BEFORE the real
// `@theme inline {` — exactly like the real globals.css (which has `… derived in @theme …` in a
// comment before the block). The parser must anchor on `@theme inline`, not the first "@theme".
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

// realistic defined sets (the repo's actual scale)
const DEF: ThemeSteps = {
  radius: new Set(["sm", "md", "lg", "xl"]),
  shadow: new Set(["sm", "md", "lg"]),
  text: new Set(["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl"]),
  fontWeight: new Set(["normal", "medium", "semibold", "bold"]),
};
const rules = (s: string) => checkOffTokenScale(DEF, "x.tsx", `const c = "${s}";`).map((f) => f.rule);

describe("checkOffTokenScale", () => {
  it("flags scale steps not defined in @theme", () => {
    for (const c of ["rounded-2xl", "rounded-3xl", "rounded-4xl", "rounded-xs", "shadow-xl", "shadow-2xs",
      "text-8xl", "text-9xl", "font-black", "font-thin", "font-extrabold"])
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
    for (const c of ["rounded-xl", "rounded-md", "shadow-md", "text-7xl", "text-base", "font-bold", "font-medium"])
      expect(rules(c), c).toEqual([]);
  });
  it("does NOT flag non-scale utilities or static survivors", () => {
    for (const c of ["rounded-full", "rounded-none", "shadow-none", "shadow-inner", "text-center", "text-balance",
      "text-pretty", "text-accent", "text-muted-foreground", "font-mono", "font-sans", "shadow-brand-500", "rounded"])
      expect(rules(c), c).toEqual([]);
  });
  it("does NOT flag arbitraries (handled by arbitrary-tailwind)", () => {
    expect(rules("rounded-[5px]")).toEqual([]);
    expect(rules("text-[10px]")).toEqual([]);
  });
  it("is self-maintaining: a step added to defined is no longer flagged", () => {
    const def2: ThemeSteps = { ...DEF, radius: new Set([...DEF.radius, "2xl"]) };
    expect(checkOffTokenScale(def2, "x.tsx", `const c = "rounded-2xl";`)).toEqual([]);
  });
});
