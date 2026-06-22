import { describe, it, expect } from "vitest";
import {
  canonicalize, resolveMatches, GROUP_PROPERTY, PROPERTY_GROUP,
  type TokenIndex, type ElementValue,
} from "@/lib/editor/resolve-token";

describe("canonicalize", () => {
  it("colour: equal colours in different serializations canonicalize equal", () => {
    const fromOklch = canonicalize("background-color", "oklch(0.205 0 0)");
    const fromRgb = canonicalize("color", "rgb(23, 23, 23)");
    expect(fromOklch).not.toBeNull();
    expect(fromOklch).toBe(fromRgb);
  });
  it("colour: alpha < 1 / transparent is rejected (skipped, no match)", () => {
    expect(canonicalize("background-color", "rgba(0, 0, 0, 0)")).toBeNull();
    expect(canonicalize("background-color", "oklch(0.97 0 0 / 0.4)")).toBeNull();
    expect(canonicalize("background-color", "transparent")).toBeNull();
  });
  it("box-shadow: strips empty composed layers so a 5-layer element equals a 2-layer probe", () => {
    const element =
      "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
      "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, " +
      "oklch(0 0 0 / 0.1) 0px 4px 6px -1px, oklch(0 0 0 / 0.1) 0px 2px 4px -2px";
    const probe = "oklch(0 0 0 / 0.1) 0px 4px 6px -1px, oklch(0 0 0 / 0.1) 0px 2px 4px -2px";
    expect(canonicalize("box-shadow", element)).toBe(canonicalize("box-shadow", probe));
  });
  it("box-shadow: none is rejected", () => {
    expect(canonicalize("box-shadow", "none")).toBeNull();
  });
  it("font-size / border-radius pass through as the px string", () => {
    expect(canonicalize("font-size", "14px")).toBe("14px");
    expect(canonicalize("border-radius", "8px")).toBe("8px");
  });
});

describe("resolveMatches", () => {
  const index: TokenIndex = {
    color: [
      { token: "--primary", canonical: "#171717" },
      { token: "--card", canonical: "#ffffff" },
      { token: "--background", canonical: "#ffffff" },
      { token: "--popover", canonical: "#ffffff" },
    ],
    radius: [{ token: "--radius", canonical: "8px" }, { token: "--radius", canonical: "10px" }],
  };
  it("single match", () => {
    const ev: ElementValue[] = [{ property: "background-color", group: "color", canonical: "#171717" }];
    expect(resolveMatches(ev, index)).toEqual([
      { property: "background-color", group: "color", value: "#171717", tokens: ["--primary"] },
    ]);
  });
  it("lists ALL tokens on a value collision", () => {
    const ev: ElementValue[] = [{ property: "background-color", group: "color", canonical: "#ffffff" }];
    expect(resolveMatches(ev, index)[0].tokens).toEqual(["--card", "--background", "--popover"]);
  });
  it("groups multiple properties of one element", () => {
    const ev: ElementValue[] = [
      { property: "background-color", group: "color", canonical: "#171717" },
      { property: "border-radius", group: "radius", canonical: "8px" },
    ];
    const m = resolveMatches(ev, index);
    expect(m.map((x) => x.property)).toEqual(["background-color", "border-radius"]);
    expect(m[1].tokens).toEqual(["--radius"]);
  });
  it("no match → empty", () => {
    expect(resolveMatches([{ property: "color", group: "color", canonical: "#abcabc" }], index)).toEqual([]);
  });
});

describe("GROUP_PROPERTY / PROPERTY_GROUP", () => {
  it("covers exactly the in-scope groups (list-the-groups guard; it is a Partial map)", () => {
    expect(Object.keys(GROUP_PROPERTY).sort()).toEqual(
      ["color", "fontFamily", "fontSize", "radius", "shadow"].sort(),
    );
    for (const g of ["spacing", "duration", "zIndex", "borderWidth", "fontWeight", "lineHeight", "container", "opacity"]) {
      expect(GROUP_PROPERTY[g as keyof typeof GROUP_PROPERTY]).toBeUndefined();
    }
  });
  it("PROPERTY_GROUP inverts GROUP_PROPERTY", () => {
    for (const [group, props] of Object.entries(GROUP_PROPERTY)) {
      for (const p of props!) expect(PROPERTY_GROUP[p]).toBe(group);
    }
  });
});
