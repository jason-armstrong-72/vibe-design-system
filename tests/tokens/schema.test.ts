import { describe, it, expect } from "vitest";
import { groupForName, controlForGroup, minRatio, partnerOf } from "@/lib/tokens/schema";

describe("minRatio", () => {
  it("3.0 for muted-foreground, 4.5 otherwise", () => {
    expect(minRatio("--muted-foreground")).toBe(3.0);
    expect(minRatio("--primary-foreground")).toBe(4.5);
    expect(minRatio("--foreground")).toBe(4.5);
  });
});

describe("partnerOf (structural, both directions)", () => {
  const present = new Set([
    "--background", "--foreground", "--primary", "--primary-foreground",
    "--promo", "--promo-foreground", "--muted", "--muted-foreground",
  ]);
  it("base → its -foreground", () => expect(partnerOf("--primary", present)).toBe("--primary-foreground"));
  it("-foreground → its base", () => expect(partnerOf("--primary-foreground", present)).toBe("--primary"));
  it("background ↔ foreground special pair", () => {
    expect(partnerOf("--background", present)).toBe("--foreground");
    expect(partnerOf("--foreground", present)).toBe("--background");
  });
  it("invented token pairs structurally", () => expect(partnerOf("--promo", present)).toBe("--promo-foreground"));
  it("--foreground does NOT strip to '--'", () => expect(partnerOf("--foreground", present)).not.toBe("--"));
  it("null when partner absent", () => expect(partnerOf("--ring", present)).toBe(null));
});

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
