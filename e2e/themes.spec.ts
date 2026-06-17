import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Inject each theme's :root/.dark onto /design-system (deterministic — no file swap /
// recompile). The injected <style> wins on source order over the compiled stylesheet.
const THEMES = ["neutral", "swiss", "brutalist"];
const themeCss = (name: string) => readFileSync(resolve(`themes/${name}.css`), "utf8");

for (const name of THEMES) {
  test(`${name}: no horizontal overflow at any breakpoint`, async ({ page }) => {
    for (const width of [375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/design-system");
      await page.addStyleTag({ content: themeCss(name) });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, `${name} overflow at ${width}px`).toBe(false);
    }
  });
}
