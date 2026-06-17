import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { contrastResults } from "@/lib/tokens/contrast";

// existsSync-filtered, same green-between-commits strategy as parity.test.ts.
const THEMES = ["neutral", "swiss", "brutalist"].filter((n) => existsSync(resolve(`themes/${n}.css`)));

describe.each(THEMES)("WCAG AA: %s", (name) => {
  const css = readFileSync(resolve(`themes/${name}.css`), "utf8");
  const tokens = parseTokens(css);
  const results = contrastResults(tokens);

  it("evaluates at least the core semantic pairs", () => {
    expect(results.length).toBeGreaterThanOrEqual(16); // 10 pairs × 2 themes = 20; ≥16 is margin
  });

  it("no fg/bg pair uses a translucent (alpha) value — ratio would be meaningless", () => {
    const hasAlpha = (n: string) => tokens.some((t) => t.name === n && /\/\s*[\d.]/.test(t.value));
    for (const r of results) {
      expect(hasAlpha(r.fg) || hasAlpha(r.bg), `alpha in pair ${r.fg}/${r.bg}`).toBe(false);
    }
  });

  for (const r of results) {
    it(`${r.theme}: ${r.fg} on ${r.bg} ≥ ${r.min} (got ${r.ratio?.toFixed(2)})`, () => {
      expect(r.ratio).toBeGreaterThanOrEqual(r.min);
    });
  }
});
