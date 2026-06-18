import { describe, it, expect } from "vitest";
import { parseOklch, formatOklch, hexToOklch, oklchToHex } from "@/lib/editor/oklch";

describe("oklch", () => {
  it("parses an oklch() string", () => {
    expect(parseOklch("oklch(0.205 0 0)")).toEqual({ l: 0.205, c: 0, h: 0 });
  });
  it("round-trips parse → format", () => {
    expect(formatOklch(parseOklch("oklch(0.62 0.17 250)")!)).toBe("oklch(0.62 0.17 250)");
  });
  it("hex white ≈ lightness 1, chroma ~0", () => {
    const w = hexToOklch("#ffffff")!;
    expect(w.l).toBeGreaterThan(0.98);
    expect(w.c).toBeLessThan(0.01);
  });
  it("out-of-gamut oklch → a valid #rrggbb (gamut clamped)", () => {
    const hex = oklchToHex({ l: 0.6, c: 0.4, h: 30 }); // chroma 0.4 is outside sRGB
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("returns null for malformed input", () => {
    expect(parseOklch("not a color")).toBeNull();
  });
});
