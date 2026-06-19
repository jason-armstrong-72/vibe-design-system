import { describe, it, expect } from "vitest";
import { groupForName, controlForGroup, foregroundFor } from "@/lib/tokens/schema";

describe("groupForName", () => {
  it.each([
    ["--background", "color"],
    ["--primary", "color"],
    ["--primary-foreground", "color"],
    ["--success", "color"],
    ["--brand-500", "color"],
    ["--chart-3", "color"],
    ["--font-sans", "fontFamily"],
    ["--fs-lg", "fontSize"],
    ["--lh-lg", "lineHeight"],
    ["--fw-bold", "fontWeight"],
    ["--radius", "radius"],
    ["--border-width-thick", "borderWidth"],
    ["--elevation-md", "shadow"],
    ["--duration-base", "duration"],
    ["--ease-standard", "easing"],
    ["--spacing-base", "spacing"],
    ["--z-modal", "zIndex"],
    ["--opacity-muted", "opacity"],
    ["--container-md", "container"],
  ])("maps %s -> %s", (name, group) => {
    expect(groupForName(name)).toBe(group);
  });

  it("throws on a name outside the convention with no value to infer from", () => {
    expect(() => groupForName("--mystery")).toThrow(/unknown token/i);
  });

  it("infers color for an unknown name whose value is a color (the extension path)", () => {
    expect(groupForName("--highlight", "oklch(0.7 0.2 320)")).toBe("color");
    expect(groupForName("--highlight-foreground", "#ffffff")).toBe("color");
  });

  it("still throws on an unknown name with a non-color value", () => {
    expect(() => groupForName("--mystery", "1rem")).toThrow(/unknown token/i);
  });

  // F2: a misplaced scale name (an LLM puts a @theme-namespace name in :root) must NOT crash the
  // toolchain — classify by family so the gate/docs can steer the real fix.
  it.each([
    ["--radius-2xl", "radius"],
    ["--shadow-9xl", "shadow"],
    ["--text-8xl", "fontSize"],
    ["--font-weight-black", "fontWeight"],
  ])("classifies misplaced %s -> %s without throwing", (name, group) => {
    expect(groupForName(name)).toBe(group);
  });

  // regression: real value tokens classify correctly regardless of value-string (prefix wins over inference)
  it.each([
    ["--elevation-lg", "0 10px 15px -3px oklch(0 0 0 / 0.1)", "shadow"],
    ["--fs-2xl", "1.5rem", "fontSize"],
    ["--fw-semibold", "600", "fontWeight"],
  ])("classifies %s -> %s by prefix, not value", (name, value, group) => {
    expect(groupForName(name, value)).toBe(group);
  });
});

describe("controlForGroup", () => {
  it.each([
    ["color", "color"],
    ["fontFamily", "select"],
    ["fontSize", "length-slider"],
    ["lineHeight", "length-slider"],
    ["borderWidth", "length-slider"],
    ["spacing", "length-slider"],
    ["duration", "duration-slider"],
    ["easing", "easing"],
    ["zIndex", "number"],
    ["opacity", "opacity-slider"],
    ["shadow", "text"],
  ] as const)("maps %s -> %s", (group, control) => {
    expect(controlForGroup(group)).toBe(control);
  });
});

describe("foregroundFor", () => {
  it("pairs a bg token with its -foreground", () => {
    expect(foregroundFor("--primary")).toBe("--primary-foreground");
  });
  it("returns null for a token that has no foreground pair", () => {
    expect(foregroundFor("--primary-foreground")).toBeNull();
    expect(foregroundFor("--radius")).toBeNull();
  });
});
