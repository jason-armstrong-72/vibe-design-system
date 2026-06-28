// tests/tokens/micro-type.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseThemeSteps } from "@/lib/check/off-token-scale";

describe("2xs micro type step", () => {
  it("--text-2xs is wired in globals @theme after tokens regen", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(parseThemeSteps(css).text.has("2xs")).toBe(true);
  });
});
