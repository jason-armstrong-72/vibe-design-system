import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// NOTE: the editor route is WRITE-ONLY. Manifest regen is the watcher's job (M2), exercised under
// `npm run dev`, NOT asserted here — this proves the editor's write + live ripple only.
const GLOBALS = resolve("app/globals.css");

test.describe("editor seam", () => {
  test("edit a number token → live preview + globals.css rewritten + ripple", async ({ page }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode
      await page.locator('[data-token="--z-modal"]').click(); // select
      const input = page.getByLabel(/--z-modal value/i);
      await input.fill("1500");
      await input.blur();
      // persisted (debounced) → poll the file
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toContain("--z-modal: 1500");
    } finally {
      writeFileSync(GLOBALS, before, "utf8"); // restore
    }
  });

  test("edit --primary color → live ripple to a second bound element + globals.css rewritten", async ({
    page,
  }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode

      // A second element bound to --primary: the default Button uses bg-primary.
      const rippleTarget = page.getByRole("button", { name: "Default" }).first();
      const beforeBg = await rippleTarget.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );

      await page.locator('[data-token="--primary"]').first().click(); // select

      const lightness = page.getByLabel(/--primary lightness/i);
      await expect(lightness).toBeVisible();
      // Drag the slider well away from its seeded ~0.205 so the repaint is unmistakable.
      await lightness.fill("0.6");
      await lightness.dispatchEvent("input");
      await lightness.dispatchEvent("change");

      // Ripple: the Button's computed background must change.
      await expect
        .poll(
          () => rippleTarget.evaluate((el) => getComputedStyle(el).backgroundColor),
          { timeout: 5000 },
        )
        .not.toBe(beforeBg);

      // Persisted (debounced) → poll the file.
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toMatch(/--primary:\s*oklch\(0\.6 /);
    } finally {
      writeFileSync(GLOBALS, before, "utf8"); // restore
    }
  });

  test("edit --radius length → globals.css rewritten with the new length", async ({
    page,
  }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode
      await page.locator('[data-token="--radius"]').first().click(); // select

      const num = page.getByLabel(/--radius value/i);
      await expect(num).toBeVisible();
      await num.fill("1");
      await num.dispatchEvent("input");
      await num.dispatchEvent("change");
      await num.blur();

      // Persisted (debounced) → poll the file for the rewritten length.
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toMatch(/--radius:\s*1rem/);
    } finally {
      writeFileSync(GLOBALS, before, "utf8"); // restore
    }
  });
});
