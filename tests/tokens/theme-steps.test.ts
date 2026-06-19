import { describe, it, expect } from "vitest";
import { parseThemeSteps, RADIUS_STEP_ORDER } from "@/lib/tokens/theme-steps";

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

describe("RADIUS_STEP_ORDER", () => {
  it("is the Tailwind v4 radius scale order", () => {
    expect(RADIUS_STEP_ORDER).toEqual(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]);
  });
});
