import { test, expect } from "@playwright/test";

test("design-system renders a Gradient section with 4 data-token swatches", async ({ page }) => {
  await page.goto("/design-system");
  const section = page.locator("section#gradient");
  await expect(section).toBeVisible();
  for (const name of ["--gradient-subtle", "--gradient-brand", "--gradient-glow", "--gradient-fade"]) {
    await expect(page.locator(`[data-token="${name}"]`)).toHaveCount(1);
  }
});
