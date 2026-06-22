import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GLOBALS = resolve("app/globals.css");

async function enterPick(page: import("@playwright/test").Page) {
  await page.goto("/design-system");
  await page.getByRole("button", { name: /edit/i }).click();
  await page.getByRole("button", { name: /pick token from element/i }).click();
}

test.describe("pick-anywhere", () => {
  test("pick a button → menu lists --primary → row opens it in the panel + pick exits", async ({ page }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await enterPick(page);
      // a real showcase button (bg-primary). Force-click: pick mode suppresses native activation.
      await page.getByRole("button", { name: "Default" }).first().click({ force: true });
      const menu = page.getByRole("menu", { name: /tokens for this element/i });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: /--primary$/ })).toBeVisible();
      await menu.getByRole("menuitem", { name: /--primary$/ }).first().click();
      await expect(page.getByRole("button", { name: /pick token from element/i })).toHaveAttribute(
        "aria-pressed", "false",
      );
    } finally {
      writeFileSync(GLOBALS, before, "utf8");
    }
  });

  test("layered Escape: popover closes, then pick mode exits", async ({ page }) => {
    await enterPick(page);
    await page.getByRole("button", { name: "Default" }).first().click({ force: true });
    const menu = page.getByRole("menu", { name: /tokens for this element/i });
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape"); // close popover
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("button", { name: /pick token from element/i })).toHaveAttribute(
      "aria-pressed", "true",
    ); // still in pick mode
    await page.keyboard.press("Escape"); // exit pick mode
    await expect(page.getByRole("button", { name: /pick token from element/i })).toHaveAttribute(
      "aria-pressed", "false",
    );
  });
});
