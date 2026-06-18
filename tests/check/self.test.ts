import { describe, it, expect } from "vitest";
import { run } from "@/lib/check/run";

describe("dogfood", () => {
  it("the template's own source passes npm run check", () => {
    const { findings } = run();
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
  });
});
