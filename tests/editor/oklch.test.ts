import { describe, it, expect } from "vitest";
import { parseOklch, formatOklch, hexToOklch, oklchToHex, nearestPassingL } from "@/lib/editor/oklch";
import { wcagContrast } from "culori";

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

describe("nearestPassingL", () => {
  const ratio = (oklchStr: string, partner: string) =>
    wcagContrast(oklchToHex(parseOklch(oklchStr)!), partner);

  it("returns an L that passes AS RENDERED (gamut-mapped), keeping C/H", () => {
    const partner = "#ffffff";
    const out = nearestPassingL("oklch(0.85 0.1 250)", partner, 4.5);
    expect(out).not.toBeNull();
    expect(ratio(out!, partner)).toBeGreaterThanOrEqual(4.5);
    const p = parseOklch(out!)!;
    expect(p.c).toBeCloseTo(0.1, 3);
    expect(p.h).toBeCloseTo(250, 1);
  });
  it("handles a mid-luminance partner (U-shaped) without false-null", () => {
    const partner = oklchToHex(parseOklch("oklch(0.5 0 0)")!);
    const out = nearestPassingL("oklch(0.5 0 0)", partner, 4.5);
    expect(out).not.toBeNull();
    expect(ratio(out!, partner)).toBeGreaterThanOrEqual(4.5);
  });
  it("respects the contract when unreachable at this chroma", () => {
    const partner = oklchToHex(parseOklch("oklch(0.6 0.15 250)")!);
    const out = nearestPassingL("oklch(0.6 0.15 250)", partner, 7.5);
    if (out !== null) expect(ratio(out, partner)).toBeGreaterThanOrEqual(7.5);
    else expect(out).toBeNull();
  });
});
