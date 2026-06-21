import { describe, it, expect } from "vitest";
import { isNamedColor } from "@/lib/check/css-colors";

describe("css-colors", () => {
  it("recognizes named colors (case-insensitive)", () => {
    for (const c of ["red", "RED", "Blue", "gold", "tan", "rebeccapurple", "tomato"])
      expect(isNamedColor(c), c).toBe(true);
  });
  it("excludes CSS-wide keywords and non-colors", () => {
    for (const c of ["transparent", "currentcolor", "inherit", "initial", "unset", "none", "revert", "revert-layer"])
      expect(isNamedColor(c), c).toBe(false);
  });
  it("is exact, not prefix/substring", () => {
    for (const c of ["reddish", "rebecca", "redbg", ""]) expect(isNamedColor(c), c).toBe(false);
  });
});
