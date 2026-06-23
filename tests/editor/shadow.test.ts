import { describe, it, expect } from "vitest";
import { parseShadow, formatShadow } from "@/lib/editor/shadow";

const SEED_SM = "0 1px 2px 0 oklch(0 0 0 / 0.05)";
const SEED_MD = "0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)";
const SEED_LG = "0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1)";

describe("parseShadow", () => {
  it("parses a single black layer (decimal alpha → percent)", () => {
    expect(parseShadow(SEED_SM)).toEqual([
      { inset: false, x: 0, y: 1, blur: 2, spread: 0, color: "black", alpha: 5 },
    ]);
  });
  it("parses multi-layer with negative spread", () => {
    const md = parseShadow(SEED_MD)!;
    expect(md).toHaveLength(2);
    expect(md[0]).toEqual({ inset: false, x: 0, y: 4, blur: 6, spread: -1, color: "black", alpha: 10 });
    expect(md[1].spread).toBe(-2);
  });
  it("parses inset, token var(), and color-mix token+alpha", () => {
    expect(parseShadow("inset 0 2px 4px 0 var(--brand-500)")![0])
      .toEqual({ inset: true, x: 0, y: 2, blur: 4, spread: 0, color: "--brand-500", alpha: 100 });
    expect(parseShadow("0 4px 8px 0 color-mix(in oklch, var(--brand-500) 30%, transparent)")![0])
      .toEqual({ inset: false, x: 0, y: 4, blur: 8, spread: 0, color: "--brand-500", alpha: 30 });
  });
  it("defaults missing blur/spread to 0 and clamps negative blur", () => {
    expect(parseShadow("1px 2px oklch(0 0 0 / 0.1)")![0]).toMatchObject({ x: 1, y: 2, blur: 0, spread: 0 });
    expect(parseShadow("0 0 -5px 0 oklch(0 0 0 / 0.1)")![0].blur).toBe(0);
  });
  it("returns null for unmodellable values", () => {
    expect(parseShadow("0 1px 2px rgb(0,0,0)")).toBeNull();          // raw rgb
    expect(parseShadow("0 1px 2px #000")).toBeNull();                 // hex
    expect(parseShadow("0 1px 2px oklch(0.2 0 0 / 0.3)")).toBeNull(); // non-black literal
    expect(parseShadow("none")).toBeNull();
    expect(parseShadow("red 0 1px 2px")).toBeNull();                  // leading-color grammar
    expect(parseShadow("garbage")).toBeNull();
  });
});

describe("formatShadow", () => {
  it("round-trips the three seeds to exact strings", () => {
    expect(formatShadow(parseShadow(SEED_SM)!)).toBe(SEED_SM);
    expect(formatShadow(parseShadow(SEED_MD)!)).toBe(SEED_MD);
    expect(formatShadow(parseShadow(SEED_LG)!)).toBe(SEED_LG);
  });
  it("emits bare 0 for zero lengths; 0px-input formats back to 0", () => {
    expect(formatShadow(parseShadow("0px 1px 2px 0px oklch(0 0 0 / 0.1)")!)).toBe("0 1px 2px 0 oklch(0 0 0 / 0.1)");
  });
  it("black alpha=100 → oklch(0 0 0); token alpha=100 → var(); token <100 → color-mix", () => {
    expect(formatShadow([{ inset: false, x: 0, y: 0, blur: 0, spread: 0, color: "black", alpha: 100 }]))
      .toBe("0 0 0 0 oklch(0 0 0)");
    expect(formatShadow([{ inset: false, x: 0, y: 2, blur: 4, spread: 0, color: "--brand-500", alpha: 100 }]))
      .toBe("0 2px 4px 0 var(--brand-500)");
    expect(formatShadow([{ inset: true, x: 0, y: 2, blur: 4, spread: 0, color: "--brand-500", alpha: 30 }]))
      .toBe("inset 0 2px 4px 0 color-mix(in oklch, var(--brand-500) 30%, transparent)");
  });
});
