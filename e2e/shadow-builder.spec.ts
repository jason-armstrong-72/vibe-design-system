import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GLOBALS = resolve("app/globals.css");

test("design-system renders a Shadow section with 3 data-token swatches", async ({ page }) => {
  await page.goto("/design-system");
  for (const name of ["--elevation-sm", "--elevation-md", "--elevation-lg"]) {
    await expect(page.locator(`[data-token="${name}"]`)).toHaveCount(1);
  }
});

test("selecting a shadow shows the layered builder", async ({ page }) => {
  await page.goto("/design-system");
  await page.getByRole("button", { name: /edit/i }).click();
  await page.locator('[data-token="--elevation-md"]').first().click();
  await expect(page.locator(".ed-shadow-pad").first()).toBeVisible();
  await expect(page.getByLabel(/--elevation-md layer 1 blur/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /add layer/i })).toBeVisible();
});

test("editing a layer's blur ripples the computed box-shadow + rewrites globals.css", async ({ page }) => {
  const before = readFileSync(GLOBALS, "utf8");
  try {
    await page.goto("/design-system");
    await page.getByRole("button", { name: /edit/i }).click();

    const swatch = page.locator('[data-token="--elevation-md"] [data-preview="box"]');
    const beforeShadow = await swatch.evaluate((el) => getComputedStyle(el).boxShadow);

    await page.locator('[data-token="--elevation-md"]').first().click();
    const blur = page.getByLabel(/--elevation-md layer 1 blur/i);
    await expect(blur).toBeVisible();
    await blur.fill("20");
    await blur.press("Enter");

    // Live ripple: the page swatch's computed box-shadow must change.
    await expect
      .poll(() => swatch.evaluate((el) => getComputedStyle(el).boxShadow), { timeout: 5000 })
      .not.toBe(beforeShadow);

    // Persisted (debounced) → the rewritten token uses the new 20px blur on its first layer.
    await expect
      .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
      .toMatch(/--elevation-md:\s*0 4px 20px/);
  } finally {
    writeFileSync(GLOBALS, before, "utf8"); // restore
  }
});
