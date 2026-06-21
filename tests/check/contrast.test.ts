import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkContrast } from "@/lib/check/contrast";

const wrap = (root: string, dark = "") =>
  `@import "tailwindcss";\n:root {\n--background: oklch(1 0 0);\n--foreground: oklch(0.15 0 0);\n${root}\n}\n.dark {\n--background: oklch(0.15 0 0);\n--foreground: oklch(0.99 0 0);\n${dark}\n}\n`;

describe("checkContrast", () => {
  it("flags a below-AA invented pair in :root", () => {
    const css = wrap(`--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`,
                     `--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`);
    const f = checkContrast(css);
    expect(f.some((x) => x.rule === "contrast" && x.message.includes("--promo-foreground"))).toBe(true);
  });

  it("message names the block and the target ratio", () => {
    const css = wrap(`--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`);
    const msg = checkContrast(css).find((x) => x.rule === "contrast")!.message;
    expect(msg).toMatch(/:root|\.dark/);
    expect(msg).toContain("4.5");
    expect(msg).toContain("npm run tokens");
  });

  it("does not crash and does not flag a color-mix() foreground", () => {
    const css = wrap(`--promo: oklch(0.6 0.2 250);\n--promo-foreground: color-mix(in oklch, var(--foreground), white 20%);`);
    expect(() => checkContrast(css)).not.toThrow();
    expect(checkContrast(css).some((x) => x.message.includes("--promo-foreground"))).toBe(false);
  });

  it("does not crash and does not flag a var()-indirected foreground", () => {
    const css = wrap(`--promo: oklch(0.6 0.2 250);\n--promo-foreground: var(--foreground);`);
    expect(() => checkContrast(css)).not.toThrow();
    expect(checkContrast(css).some((x) => x.message.includes("--promo-foreground"))).toBe(false);
  });

  it("passes the real app/globals.css (baseline guard)", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    expect(checkContrast(css)).toEqual([]);
  });

  it("reports a :root-only below-AA pair ONCE (not a redundant .dark finding)", () => {
    // single-arg wrap → --promo present in :root only (no own .dark)
    const css = wrap(`--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`);
    const findings = checkContrast(css).filter((f) => f.message.includes("--promo-foreground"));
    expect(findings.length).toBe(1);
    expect(findings[0].message).toContain(":root");
  });

  it("still reports a both-block below-AA pair in BOTH themes", () => {
    const pair = `--promo: oklch(0.85 0.1 250);\n--promo-foreground: oklch(0.9 0.05 250);`;
    const findings = checkContrast(wrap(pair, pair)).filter((f) => f.message.includes("--promo-foreground"));
    expect(findings.length).toBe(2); // :root + .dark (real own-dark, not fallback)
  });
});
