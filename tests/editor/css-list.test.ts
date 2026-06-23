import { describe, it, expect } from "vitest";
import { splitTopLevel } from "@/lib/editor/css-list";

describe("splitTopLevel", () => {
  it("splits at depth-0 commas only", () => {
    expect(splitTopLevel("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("keeps inner commas inside parens (color-mix / rgb)", () => {
    expect(splitTopLevel("0 1px 2px rgb(0, 0, 0), 0 2px var(--x)")).toEqual([
      "0 1px 2px rgb(0, 0, 0)",
      "0 2px var(--x)",
    ]);
  });
  it("survives nested parens and slashes", () => {
    expect(splitTopLevel("color-mix(in oklch, var(--x) 40%, transparent), oklch(0 0 0 / 0.1)")).toEqual([
      "color-mix(in oklch, var(--x) 40%, transparent)",
      "oklch(0 0 0 / 0.1)",
    ]);
  });
  it("trims and drops empty segments", () => {
    expect(splitTopLevel(" a , , b ")).toEqual(["a", "b"]);
    expect(splitTopLevel("")).toEqual([]);
  });
});
