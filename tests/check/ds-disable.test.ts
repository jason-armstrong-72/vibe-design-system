import { describe, it, expect } from "vitest";
import { applySuppressions, bareDisableFindings, disabledLines } from "@/lib/check/ds-disable";
import { MSG } from "@/lib/check/messages";
import type { Finding } from "@/lib/check/types";

const f = (line: number): Finding => ({ file: "x.tsx", line, rule: "r", message: "m" });

describe("ds-disable", () => {
  it("a valid ds-disable on the preceding line suppresses a line-N finding", () => {
    const content = ["/* ds-disable: legacy */", 'const c = "bg-red-500";'].join("\n");
    const [kept, n] = applySuppressions([f(2)], content);
    expect(kept).toEqual([]);
    expect(n).toBe(1);
  });

  it("a bare ds-disable yields a bareDisable finding and does NOT suppress", () => {
    const content = ["/* ds-disable */", 'const c = "bg-red-500";'].join("\n");
    const bare = bareDisableFindings("x.tsx", content);
    expect(bare).toHaveLength(1);
    expect(bare[0].message).toBe(MSG.bareDisable());
    expect(bare[0].line).toBe(1);
    const [kept] = applySuppressions([f(2)], content);
    expect(kept).toEqual([f(2)]);
  });

  it("whole-file findings (line 0) are never suppressed", () => {
    const content = "/* ds-disable: anything */\nx";
    const [kept] = applySuppressions([f(0)], content);
    expect(kept).toEqual([f(0)]);
  });

  it("disabledLines records only reason-bearing lines", () => {
    const content = ["// ds-disable: ok", "// ds-disable"].join("\n");
    expect([...disabledLines(content)]).toEqual([1]);
  });
});
