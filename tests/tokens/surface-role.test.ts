// tests/tokens/surface-role.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { groupForName, partnerOf } from "@/lib/tokens/schema";
import { checkBothTheme } from "@/lib/check/both-theme";
import { checkContrast } from "@/lib/check/contrast";

describe("--surface role", () => {
  const globals = () => readFileSync(resolve("app/globals.css"), "utf8");
  it("classifies as color", () => {
    expect(groupForName("--surface")).toBe("color");
    expect(groupForName("--surface-foreground")).toBe("color");
  });
  it("pairs surface ↔ surface-foreground", () => {
    const present = new Set(["--surface", "--surface-foreground"]);
    expect(partnerOf("--surface", present)).toBe("--surface-foreground");
  });
  it("both-theme: present in both blocks (no findings for surface)", () => {
    expect(checkBothTheme(globals()).filter((f) => f.message.includes("surface"))).toEqual([]);
  });
  it("contrast: surface pair passes AA", () => {
    expect(checkContrast(globals()).filter((f) => f.message.includes("surface"))).toEqual([]);
  });
});
