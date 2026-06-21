import { describe, it, expect } from "vitest";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";

const find = (s: string) => checkArbitrary("x.tsx", `const c = "${s}";`).map((f) => f.rule);

describe("arbitrary-tailwind", () => {
  it("flags arbitrary literal color", () => expect(find("bg-[#abc]")).toContain("arbitrary-color"));
  it("flags arbitrary literal color in any color function (rgb/rgba/hsl/hsla/oklch/oklab)", () => {
    for (const c of [
      "bg-[rgb(0_0_0)]", "text-[rgba(0_0_0_/_50%)]", "bg-[hsl(0_0%_0%)]",
      "border-[hsla(0_0%_0%_/_1)]", "bg-[oklch(0.5_0.2_30)]", "text-[oklab(0.5_0_0)]",
    ]) expect(find(c), c).toContain("arbitrary-color");
  });
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

  it("strips variant prefixes so existing rules still fire (hole #4 / regression twins)", () => {
    expect(find("md:bg-red-500")).toContain("default-palette");
    expect(find("hover:p-13")).toContain("off-scale-spacing");
    expect(find("md:text-[10px]")).toContain("arbitrary-length");
    expect(find("md:hover:bg-red-500")).toContain("default-palette"); // stacked
  });
  it("variant strip is bracket-aware (colon inside [] is not a variant separator)", () => {
    expect(find("bg-[url(http://x)]")).toEqual([]); // not a color/length → no finding, no misparse
  });

  it("flags text/placeholder palette (hole #1)", () => {
    expect(find("text-gray-500")).toContain("default-palette");
    expect(find("placeholder-gray-500")).toContain("default-palette");
    expect(find("md:text-gray-500")).toContain("default-palette");
  });
  it("flags arbitrary radius/border/ring widths (hole #2)", () => {
    for (const c of ["rounded-[5px]", "border-[3px]", "ring-[3px]", "outline-[2px]", "hover:rounded-[5px]"])
      expect(find(c), c).toContain("arbitrary-length");
  });
  it("flags bracket named colors (hole #3a)", () => {
    for (const c of ["bg-[red]", "border-[gold]", "ring-[blue]", "dark:bg-[red]"])
      expect(find(c), c).toContain("arbitrary-color");
  });
  it("does not false-positive on tokens/keywords/legit utilities", () => {
    for (const c of [
      "text-primary", "text-lg", "text-brand-700", "rounded-full", "rounded-lg",
      "rounded-[var(--radius)]", "rounded-[min(var(--radius-md),10px)]", "bg-[var(--x)]",
      "bg-[url(tan.png)]", "border-[currentColor]", "bg-[transparent]",
    ]) expect(find(c), c).toEqual([]);
    expect(find("bg-[oklch(0.5_0.2_30)]")).toContain("arbitrary-color"); // still flags via hex/func test
  });
});
