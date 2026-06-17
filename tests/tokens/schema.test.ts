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

  it("throws on a name outside the convention", () => {
    expect(() => groupForName("--mystery")).toThrow(/unknown token/i);
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
