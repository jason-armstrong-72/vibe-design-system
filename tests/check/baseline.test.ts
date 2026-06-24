// @vitest-environment node
import { describe, it, expect } from "vitest";
import { keyOf, buildBaseline, applyBaseline, baselineSavedMessage } from "@/lib/check/baseline";
import type { Finding } from "@/lib/check/types";

const F = (file: string, rule: string, key: string, line = 1): Finding =>
  ({ file, line, rule, key, message: `${rule} ${key}` });

describe("keyOf", () => {
  it("is line-insensitive, identity over (file,rule,key)", () => {
    expect(keyOf(F("a.tsx", "hardcoded-color", "#fff", 1)))
      .toBe(keyOf(F("a.tsx", "hardcoded-color", "#fff", 99)));
  });
  it("distinguishes different values", () => {
    expect(keyOf(F("a.tsx", "hardcoded-color", "#fff")))
      .not.toBe(keyOf(F("a.tsx", "hardcoded-color", "#000")));
  });
});

describe("buildBaseline", () => {
  it("collapses duplicates to counts and sorts deterministically", () => {
    const b = buildBaseline([F("b.tsx", "default-palette", "text-gray-500"),
      F("a.tsx", "hardcoded-color", "#fff"), F("a.tsx", "hardcoded-color", "#fff")], "2026-06-24");
    expect(b.version).toBe(1);
    expect(b.entries).toEqual([
      { file: "a.tsx", rule: "hardcoded-color", key: "#fff", count: 2 },
      { file: "b.tsx", rule: "default-palette", key: "text-gray-500", count: 1 },
    ]);
  });
  it("excludes findings without a key", () => {
    const noKey: Finding = { file: "g.css", line: 0, rule: "both-theme", message: "x" };
    expect(buildBaseline([noKey], "2026-06-24").entries).toEqual([]);
  });
});

describe("applyBaseline", () => {
  const findings = [F("a.tsx", "hardcoded-color", "#fff"), F("a.tsx", "hardcoded-color", "#fff")];
  const baseline = buildBaseline(findings, "2026-06-24");

  it("round-trip: same findings → all suppressed, no stale", () => {
    const r = applyBaseline(findings, baseline);
    expect(r.kept).toEqual([]);
    expect(r.suppressed).toBe(2);
    expect(r.staleEntries).toEqual([]);
  });
  it("(count+1)-th identical finding is kept (new)", () => {
    const r = applyBaseline([...findings, F("a.tsx", "hardcoded-color", "#fff")], baseline);
    expect(r.kept).toHaveLength(1);
    expect(r.suppressed).toBe(2);
  });
  it("a genuinely new value is kept", () => {
    const r = applyBaseline([...findings, F("a.tsx", "hardcoded-color", "#abc")], baseline);
    expect(r.kept.map((f) => f.key)).toEqual(["#abc"]);
  });
  it("fixed debt → stale entry reported, never fails", () => {
    const r = applyBaseline([F("a.tsx", "hardcoded-color", "#fff")], baseline); // 1 of 2 remains
    expect(r.kept).toEqual([]);
    expect(r.staleEntries).toEqual([{ file: "a.tsx", rule: "hardcoded-color", key: "#fff", count: 2 }]);
  });
  it("findings without a key pass through untouched", () => {
    const noKey: Finding = { file: "x.tsx", line: 0, rule: "ds-disable", message: "x" };
    expect(applyBaseline([noKey], baseline).kept).toEqual([noKey]);
  });
});

describe("baselineSavedMessage (locked copy — drift guard)", () => {
  it("contains the locked phrase and the count", () => {
    const m = baselineSavedMessage(7);
    expect(m).toContain("recorded them as your starting point");
    expect(m).toContain("7");
    expect(m).toContain("only NEW code gets checked");
  });
});
