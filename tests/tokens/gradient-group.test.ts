import { describe, it, expect } from "vitest";
import { groupForName } from "@/lib/tokens/schema";
import { utilitiesForToken } from "@/lib/tokens/utilities";
import { validateValue } from "@/lib/tokens/validate";

describe("gradient token group", () => {
  it("classifies --gradient-* by name prefix (value is not a color)", () => {
    expect(groupForName("--gradient-subtle", "linear-gradient(180deg, var(--brand-50) 0%, var(--card) 100%)"))
      .toBe("gradient");
  });
  it("maps to a bg-gradient-* utility hint", () => {
    expect(utilitiesForToken({ name: "--gradient-subtle", value: "x", theme: "light", group: "gradient" }).utilities)
      .toEqual(["bg-gradient-subtle"]);
  });
  it("validateValue accepts a gradient string, rejects empty / injection", () => {
    expect(() => validateValue("gradient", "radial-gradient(circle at 50% 30%, transparent 0%, transparent 70%)")).not.toThrow();
    expect(() => validateValue("gradient", "")).toThrow();
    expect(() => validateValue("gradient", "linear-gradient(180deg, var(--x) 0%); }")).toThrow();
  });
});
