import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupedSections } from "@/lib/design-system/sections";
import type { Manifest } from "@/lib/tokens/generate";

const manifest: Manifest = JSON.parse(readFileSync(resolve("design-system.json"), "utf8"));

describe("groupedSections", () => {
  const sections = groupedSections(manifest);

  it("covers every token exactly once (disjoint + exhaustive)", () => {
    const seen = sections.flatMap((s) => s.tokens.map((t) => t.name));
    expect(seen.slice().sort()).toEqual(manifest.tokens.map((t) => t.name).sort());
    expect(new Set(seen).size).toBe(seen.length); // no token in two sections
  });

  it("omits empty groups and titles each section", () => {
    for (const s of sections) {
      expect(s.tokens.length).toBeGreaterThan(0);
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.group).toBeTruthy();
    }
  });

  it("orders color first", () => {
    expect(sections[0].group).toBe("color");
  });
});
