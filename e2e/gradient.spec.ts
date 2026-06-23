import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GLOBALS = resolve("app/globals.css");

test("design-system renders a Gradient section with 4 data-token swatches", async ({ page }) => {
  await page.goto("/design-system");
  const section = page.locator("section#gradient");
  await expect(section).toBeVisible();
  for (const name of ["--gradient-subtle", "--gradient-brand", "--gradient-glow", "--gradient-fade"]) {
    await expect(page.locator(`[data-token="${name}"]`)).toHaveCount(1);
  }
});

test("editing a linear gradient's angle ripples the computed background-image + rewrites globals.css", async ({ page }) => {
  const before = readFileSync(GLOBALS, "utf8");
  try {
    await page.goto("/design-system");
    await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode

    const swatch = page.locator('[data-token="--gradient-brand"] [data-preview="box"]');
    const beforeBg = await swatch.evaluate((el) => getComputedStyle(el).backgroundImage);

    await page.locator('[data-token="--gradient-brand"]').first().click(); // select
    const angle = page.getByLabel(/--gradient-brand angle/i);
    await expect(angle).toBeVisible();
    await angle.fill("45");
    await angle.dispatchEvent("input");
    await angle.dispatchEvent("change");

    // Live ripple: the page swatch's computed background-image must change.
    await expect
      .poll(() => swatch.evaluate((el) => getComputedStyle(el).backgroundImage), { timeout: 5000 })
      .not.toBe(beforeBg);

    // Persisted (debounced) → the rewritten token uses the new 45deg angle.
    await expect
      .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
      .toMatch(/--gradient-brand:\s*linear-gradient\(45deg/);
  } finally {
    writeFileSync(GLOBALS, before, "utf8"); // restore
  }
});

test("selecting a radial gradient shows radial geometry controls", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: /edit/i }).click();
  await page.locator('[data-token="--gradient-glow"]').first().click();
  await expect(page.getByLabel(/--gradient-glow shape/i)).toBeVisible();
  await expect(page.getByLabel(/--gradient-glow position x/i)).toBeVisible();
  await expect(page.locator(".ed-gradient-pad")).toBeVisible();
});
