import { describe, it, expect } from "vitest";
import { validateValue } from "@/lib/tokens/validate";

describe("validateValue — injection", () => {
  it.each([
    "red; } body { display:none",
    "oklch(1 0 0) } .x{",
    "1rem /* nope */",
    "url(x);",
  ])("rejects injection payload %s", (bad) => {
    expect(() => validateValue("color", bad)).toThrow(/invalid|injection|delimiter/i);
  });
});

describe("validateValue — per group", () => {
  it("accepts oklch / var / color-mix / hex for color", () => {
    expect(() => validateValue("color", "oklch(0.2 0 0)")).not.toThrow();
    expect(() => validateValue("color", "var(--primary)")).not.toThrow();
    expect(() => validateValue("color", "color-mix(in oklch, var(--a), var(--b))")).not.toThrow();
    expect(() => validateValue("color", "#1a2b3c")).not.toThrow();
  });
  it("accepts oklch with slash-alpha for color", () => {
    expect(() => validateValue("color", "oklch(1 0 0 / 0.1)")).not.toThrow();
  });
  it("rejects a non-color for color", () => {
    expect(() => validateValue("color", "1rem")).toThrow();
  });
  it("accepts length units for length groups", () => {
    expect(() => validateValue("fontSize", "1.125rem")).not.toThrow();
    expect(() => validateValue("spacing", "0.25rem")).not.toThrow();
    expect(() => validateValue("borderWidth", "2px")).not.toThrow();
    expect(() => validateValue("radius", "calc(var(--radius) - 4px)")).not.toThrow();
  });
  it("validates duration / zIndex / opacity / fontWeight shapes", () => {
    expect(() => validateValue("duration", "250ms")).not.toThrow();
    expect(() => validateValue("duration", "blue")).toThrow();
    expect(() => validateValue("zIndex", "1300")).not.toThrow();
    expect(() => validateValue("zIndex", "1.5")).toThrow();
    expect(() => validateValue("opacity", "0.7")).not.toThrow();
    expect(() => validateValue("opacity", "2")).toThrow();
    expect(() => validateValue("fontWeight", "700")).not.toThrow();
    expect(() => validateValue("fontWeight", "950")).toThrow();
  });
});
