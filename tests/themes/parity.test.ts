import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";

const names = (css: string, theme: "light" | "dark") =>
  new Set(parseTokens(css).filter((t) => t.theme === theme).map((t) => t.name));

const neutral = readFileSync(resolve("themes/neutral.css"), "utf8");
const lightRef = names(neutral, "light");

// Only the non-default themes that already exist on disk (keeps suite green between commits).
const OTHERS = ["swiss", "brutalist"].filter((n) => existsSync(resolve(`themes/${n}.css`)));

// Always-present anchor so the file never has zero tests (Vitest fails an empty file),
// and so the Neutral reference set is itself sanity-checked.
describe("theme parity: neutral reference", () => {
  it("Neutral defines a non-empty :root token set including core roles", () => {
    expect(lightRef.size).toBeGreaterThan(0);
    for (const core of ["--background", "--foreground", "--primary", "--radius", "--spacing-base"]) {
      expect(lightRef.has(core), `missing ${core}`).toBe(true);
    }
  });
});

describe.each(OTHERS)("theme parity: %s", (name) => {
  const css = readFileSync(resolve(`themes/${name}.css`), "utf8");
  it("defines exactly the Neutral :root token name set", () => {
    expect(names(css, "light")).toEqual(lightRef);
  });
  it(".dark names are a subset of :root names", () => {
    for (const n of names(css, "dark")) expect(lightRef.has(n)).toBe(true);
  });
});
