import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { buildManifest } from "@/lib/tokens/generate";

const css = readFileSync(resolve("tests/tokens/fixtures/sample.css"), "utf8");
const { json, markdown } = buildManifest(parseTokens(css));

describe("buildManifest — json", () => {
  it("merges light + dark values per token name", () => {
    const primary = json.tokens.find((t) => t.name === "--primary");
    expect(primary?.values).toEqual({ light: "oklch(0.205 0 0)", dark: "oklch(0.922 0 0)" });
  });
  it("light-only tokens have no dark value", () => {
    const radius = json.tokens.find((t) => t.name === "--radius");
    expect(radius?.values.light).toBe("0.625rem");
    expect(radius?.values.dark).toBeUndefined();
  });
  it("carries group + utilities", () => {
    const primary = json.tokens.find((t) => t.name === "--primary");
    expect(primary?.group).toBe("color");
    expect(primary?.utilities).toContain("bg-primary");
  });
  it("is deterministic — stable order, no @theme tokens", () => {
    const again = buildManifest(parseTokens(css)).json;
    expect(JSON.stringify(again)).toBe(JSON.stringify(json));
    expect(json.tokens.some((t) => t.name === "--color-primary")).toBe(false);
  });
});

describe("buildManifest — markdown", () => {
  it("includes the extension procedure and a token table", () => {
    expect(markdown).toMatch(/extension procedure/i);
    expect(markdown).toContain("--primary");
    expect(markdown).toContain("bg-primary");
    expect(markdown).toMatch(/never hardcode/i);
  });
});
