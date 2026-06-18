import { describe, it, expect } from "vitest";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";

const find = (s: string) => checkArbitrary("x.tsx", `const c = "${s}";`).map((f) => f.rule);

describe("arbitrary-tailwind", () => {
  it("flags arbitrary literal color", () => expect(find("bg-[#abc]")).toContain("arbitrary-color"));
  it("flags arbitrary literal length on type/spacing", () => {
    expect(find("text-[10px]")).toContain("arbitrary-length");
    expect(find("p-[13px]")).toContain("arbitrary-length");
  });
  it("flags off-scale spacing", () => expect(find("p-13")).toContain("off-scale-spacing"));
  it("flags default-palette classes", () => expect(find("bg-red-500")).toContain("default-palette"));
  it("allows token-referencing + layout arbitraries + on-scale spacing + token classes", () => {
    expect(find("bg-[color-mix(in_oklch,var(--secondary),transparent_40%)]")).toEqual([]);
    expect(find("rounded-[min(var(--radius-md),10px)]")).toEqual([]);
    expect(find("grid-cols-[1fr_2fr]")).toEqual([]);
    expect(find("w-[20rem]")).toEqual([]);          // size prefix: not bare-numeric-checked
    expect(find("p-4 gap-1.5 px-2.5 bg-primary text-lg")).toEqual([]);
  });
});
