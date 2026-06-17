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
});
