import { describe, it, expect } from "vitest";
import {
  parseGradient, formatGradient, clampAngle, clampPct, type Gradient,
} from "@/lib/editor/gradient";

// Canonical seed models ↔ exact globals strings (round-trip + manifest-fresh safety).
const SUBTLE: Gradient = { type: "linear", angle: 180, stops: [
  { color: "--brand-50", alpha: 100, position: 0 }, { color: "--card", alpha: 100, position: 100 }] };
const GLOW: Gradient = { type: "radial", shape: "circle", cx: 50, cy: 30, stops: [
  { color: "--brand-500", alpha: 45, position: 0 }, { color: "transparent", alpha: 0, position: 70 }] };

describe("formatGradient", () => {
  it("linear: angle + var() stops at full alpha", () => {
    expect(formatGradient(SUBTLE)).toBe("linear-gradient(180deg, var(--brand-50) 0%, var(--card) 100%)");
  });
  it("radial: shape+center, color-mix for alpha<100, bare transparent", () => {
    expect(formatGradient(GLOW)).toBe(
      "radial-gradient(circle at 50% 30%, color-mix(in oklch, var(--brand-500) 45%, transparent) 0%, transparent 70%)");
  });
  it("2dp numeric rounding, no trailing zeros (manifest-fresh safe)", () => {
    const g: Gradient = { type: "linear", angle: 135, stops: [
      { color: "--brand-500", alpha: 100, position: 0 }, { color: "--brand-600", alpha: 100, position: 100 }] };
    expect(formatGradient(g)).toBe("linear-gradient(135deg, var(--brand-500) 0%, var(--brand-600) 100%)");
  });
});

describe("parseGradient", () => {
  it("round-trips linear", () => expect(parseGradient(formatGradient(SUBTLE))).toEqual(SUBTLE));
  it("round-trips radial with color-mix (no comma-shatter)", () =>
    expect(parseGradient(formatGradient(GLOW))).toEqual(GLOW));
  it("parses bare transparent stop", () => {
    const g = parseGradient("linear-gradient(180deg, var(--brand-500) 0%, transparent 100%)");
    expect(g?.stops[1]).toEqual({ color: "transparent", alpha: 0, position: 100 });
  });
  it("returns null for conic / raw-color / garbage", () => {
    expect(parseGradient("conic-gradient(from 0deg, red, blue)")).toBeNull();
    expect(parseGradient("linear-gradient(180deg, #fff 0%, #000 100%)")).toBeNull();
    expect(parseGradient("not a gradient")).toBeNull();
  });
});

describe("clamps", () => {
  it("angle ∈ [0,360]", () => { expect(clampAngle(400)).toBe(360); expect(clampAngle(-10)).toBe(0); });
  it("pct ∈ [0,100]", () => { expect(clampPct(120)).toBe(100); expect(clampPct(-5)).toBe(0); });
});
