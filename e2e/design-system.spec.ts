import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("design-system.json"), "utf8"));

test.describe("/design-system", () => {
  test("renders a data-token element for every manifest token (nothing falls out of the UI)", async ({ page }) => {
    await page.goto("/design-system");
    for (const t of manifest.tokens) {
      await expect(page.locator(`[data-token="${t.name}"]`)).toHaveCount(1);
    }
  });

  test("shows every token group as a section heading", async ({ page }) => {
    await page.goto("/design-system");
    for (const title of ["Color", "Type scale", "Spacing", "Radius", "Shadow", "Components"]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("no horizontal overflow at any breakpoint", async ({ page }) => {
    for (const width of [375, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/design-system");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, `overflow at ${width}px`).toBe(false);
    }
  });

  test("has one h1 and a main landmark", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
});
