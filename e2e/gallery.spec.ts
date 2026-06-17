import { test } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Generation-only: skipped unless GALLERY=1. Writes committed PNGs; never part of the gate suite.
test.skip(!process.env.GALLERY, "gallery generation — run with GALLERY=1");

const THEMES = ["neutral", "swiss", "brutalist"];
const OUT = resolve("themes/screenshots");

// Kill transitions/animations so a screenshot taken right after a theme/dark switch captures the
// settled colours, not a `transition-colors` mid-flight (which otherwise renders panels near-white).
const FREEZE = `*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important;animation-delay:0s!important}`;

test("generate theme gallery (light + dark)", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const name of THEMES) {
    const css = readFileSync(resolve(`themes/${name}.css`), "utf8");

    // light
    await page.goto("/design-system");
    await page.addStyleTag({ content: FREEZE });
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    await page.addStyleTag({ content: css });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

    // dark — the ONLY mechanism: add the .dark class (no toggle/provider exists)
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.addStyleTag({ content: css });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/${name}-dark.png`, fullPage: true });
  }
});
