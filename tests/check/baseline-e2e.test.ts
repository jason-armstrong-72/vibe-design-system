// @vitest-environment node
import { describe, it, expect } from "vitest";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";
import { checkArbitrary } from "@/lib/check/arbitrary-tailwind";
import { buildBaseline, applyBaseline } from "@/lib/check/baseline";

// p-13 is OFF-scale (p-7 would be allowed → no finding); bg-gray-500 = default-palette; #222 = hardcoded inline color.
const legacy = `<div className="bg-gray-500 p-13" style={{ color: "#222" }} />`;

describe("brownfield baseline — headline loop", () => {
  const findingsOf = (src: string) => [
    ...checkHardcodedColor("legacy.tsx", src),
    ...checkArbitrary("legacy.tsx", src),
  ];

  it("baselining existing debt → next run is clean", () => {
    const before = findingsOf(legacy);
    expect(before.length).toBeGreaterThan(0); // floods red cold
    const baseline = buildBaseline(before, "2026-06-24");
    const after = applyBaseline(findingsOf(legacy), baseline);
    expect(after.kept).toEqual([]); // green
    expect(after.staleEntries).toEqual([]);
  });

  it("a NEW violation added later is still caught", () => {
    const baseline = buildBaseline(findingsOf(legacy), "2026-06-24");
    const edited = legacy + `\n<span className="text-blue-500" />`; // new default-palette
    const after = applyBaseline(findingsOf(edited), baseline);
    expect(after.kept.map((f) => f.key)).toEqual(["text-blue-500"]);
  });

  it("fixing one baselined item surfaces a stale entry (warn, not fail)", () => {
    const baseline = buildBaseline(findingsOf(legacy), "2026-06-24");
    const fixed = `<div className="bg-primary p-4" style={{ color: "#222" }} />`; // dropped bg-gray-500 + p-13
    const after = applyBaseline(findingsOf(fixed), baseline);
    expect(after.kept).toEqual([]);
    expect(after.staleEntries.length).toBeGreaterThan(0);
  });
});
