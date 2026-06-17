import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";

const css = readFileSync(resolve("tests/tokens/fixtures/sample.css"), "utf8");

describe("parseTokens", () => {
  const tokens = parseTokens(css);

  it("reads light tokens from :root", () => {
    const primary = tokens.find((t) => t.name === "--primary" && t.theme === "light");
    expect(primary?.value).toBe("oklch(0.205 0 0)");
    expect(primary?.group).toBe("color");
  });

  it("reads dark tokens from .dark", () => {
    const primary = tokens.find((t) => t.name === "--primary" && t.theme === "dark");
    expect(primary?.value).toBe("oklch(0.922 0 0)");
  });

  it("keeps comma/space values intact", () => {
    const shadow = tokens.find((t) => t.name === "--elevation-md");
    expect(shadow?.value).toContain("0 4px 6px -1px");
    expect(shadow?.value).toContain(", 0 2px 4px -2px");
    const font = tokens.find((t) => t.name === "--font-sans");
    expect(font?.value).toBe("ui-sans-serif, system-ui, sans-serif");
  });

  it("does NOT parse @theme inline declarations as tokens", () => {
    expect(tokens.find((t) => t.name === "--color-primary")).toBeUndefined();
    expect(tokens.some((t) => t.name === "--spacing")).toBe(false);
    expect(tokens.some((t) => t.name === "--spacing-base")).toBe(true);
  });

  it("tags every token with a group", () => {
    expect(tokens.every((t) => typeof t.group === "string")).toBe(true);
  });
});
