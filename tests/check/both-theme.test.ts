import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkBothTheme } from "@/lib/check/both-theme";
import { MSG } from "@/lib/check/messages";

const ok = `:root{ --primary: oklch(0.2 0 0); --primary-foreground: oklch(1 0 0); --brand-50: oklch(0.97 0 0); }
.dark{ --primary: oklch(0.9 0 0); --primary-foreground: oklch(0.2 0 0); }`;
const missingDark = `:root{ --primary: oklch(0.2 0 0); --primary-foreground: oklch(1 0 0); }
.dark{ --primary-foreground: oklch(0.2 0 0); }`;

describe("both-theme", () => {
  it("passes when semantic roles exist in both blocks; ignores :root-only brand ramps", () => {
    expect(checkBothTheme(ok)).toEqual([]);
  });
  it("flags a semantic role missing from .dark", () => {
    const f = checkBothTheme(missingDark);
    expect(f).toHaveLength(1);
    expect(f[0].message).toBe(MSG.bothThemeMissing("--primary", "dark"));
  });
});

const css = (root: string, dark: string) =>
  `:root {\n${root}\n}\n.dark {\n${dark}\n}\n`;

describe("checkBothTheme — broadened to all color tokens", () => {
  it("flags an invented color present in :root only (no -foreground)", () => {
    const f = checkBothTheme(css(`--promo: oklch(0.6 0.2 250);`, ``));
    expect(f.some((x) => x.rule === "both-theme" && x.message.includes("--promo"))).toBe(true);
  });

  it("does NOT flag a brand ramp present in :root only (ramp exempt)", () => {
    const f = checkBothTheme(css(`--brand-600: oklch(0.5 0.2 250);`, ``));
    expect(f.some((x) => x.message.includes("--brand-600"))).toBe(false);
  });

  it("does NOT flag a non-color token present in one block only", () => {
    const f = checkBothTheme(css(`--duration-fast: 120ms;`, ``));
    expect(f.some((x) => x.message.includes("--duration-fast"))).toBe(false);
  });

  it("passes the real app/globals.css (baseline guard)", () => {
    expect(checkBothTheme(readFileSync(resolve("app/globals.css"), "utf8"))).toEqual([]);
  });
});
