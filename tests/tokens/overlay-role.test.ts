// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupForName } from "@/lib/tokens/schema";
import { checkBothTheme } from "@/lib/check/both-theme";

describe("--overlay scrim token", () => {
  it("classifies as color", () => {
    expect(groupForName("--overlay")).toBe("color");
  });
  it("both-theme: present in both blocks (no overlay findings)", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(checkBothTheme(css).filter((f) => f.message.includes("overlay"))).toEqual([]);
  });
  it("--color-overlay is wired in @theme after tokens regen", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(css).toContain("--color-overlay: var(--overlay)");
  });
});
