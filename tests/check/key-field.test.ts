// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";
import { checkOffTokenScale, parseThemeSteps } from "@/lib/check/off-token-scale";

describe("Finding.key = offending token (baseline identity)", () => {
  it("hardcoded-color key is the literal value", () => {
    const f = checkHardcodedColor("a.tsx", `const x = "#3b82f6";`);
    expect(f[0].key).toBe("#3b82f6");
  });
  it("arbitrary/palette key is the class", () => {
    // p-13 is OFF-scale (p-7 is an allowed step → no finding). Mirrors tests/check/arbitrary-tailwind.test.ts.
    const f = checkArbitrary("a.tsx", `<div className="bg-[#fff] text-gray-500 p-13" />`);
    const keys = f.map((x) => x.key).sort();
    expect(keys).toEqual(["bg-[#fff]", "p-13", "text-gray-500"].sort());
  });
  it("off-token-scale key is the class only (NOT the message with the scale list)", () => {
    const steps = parseThemeSteps(`@theme inline { --radius-sm: 1px; }`);
    const f = checkOffTokenScale(steps, "a.tsx", `<div className="rounded-3xl" />`);
    expect(f[0].key).toBe("rounded-3xl");
    expect(f[0].message).toContain("rounded-3xl"); // message still rich for humans
  });
});
