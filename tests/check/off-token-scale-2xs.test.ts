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
