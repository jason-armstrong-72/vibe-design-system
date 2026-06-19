import { describe, it, expect } from "vitest";
import { checkOffTokenScale } from "@/lib/check/off-token-scale";
import { type ThemeSteps } from "@/lib/tokens/theme-steps";
// parseThemeSteps + RADIUS_STEP_ORDER are tested in tests/tokens/theme-steps.test.ts

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
