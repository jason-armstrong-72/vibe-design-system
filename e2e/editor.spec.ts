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

  test("toggle Editing to Dark → forced-dark preview + edit lands in the .dark block, not :root", async ({
    page,
  }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode

      // Toggle the editing block to Dark.
      await page.getByRole("button", { name: /editing block/i }).click();

      // The page must force itself into dark so the preview is truthful.
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);

      // --primary differs between blocks (light 0.205 vs dark 0.922). Edit it.
      await page.locator('[data-token="--primary"]').first().click();
      const lightness = page.getByLabel(/--primary lightness/i);
      await expect(lightness).toBeVisible();
      await lightness.fill("0.5");
      await lightness.dispatchEvent("input");
      await lightness.dispatchEvent("change");

      // Forced-dark preview shows the edited value (inline var on .dark root wins).
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.style.getPropertyValue("--primary"),
          ),
        )
        .toMatch(/oklch\(0\.5 /);

      // The write must land in the .dark block, NOT :root.
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toMatch(/\.dark\s*\{[^}]*--primary:\s*oklch\(0\.5 /s);
      // :root's --primary must remain the original light value.
      const after = readFileSync(GLOBALS, "utf8");
      expect(after).toMatch(/:root\s*\{[^}]*--primary:\s*oklch\(0\.205 /s);
    } finally {
      writeFileSync(GLOBALS, before, "utf8"); // restore
    }
  });

  test("Reset restores the token's original value in globals.css", async ({
    page,
  }) => {
    const before = readFileSync(GLOBALS, "utf8");
    // Capture the original --z-modal value from :root so we can assert the revert.
    const origMatch = before.match(/--z-modal:\s*([^;]+);/);
    const original = origMatch?.[1].trim();
    expect(original).toBeTruthy();
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode
      await page.locator('[data-token="--z-modal"]').click(); // select

      // Change it and confirm the file was rewritten.
      const input = page.getByLabel(/--z-modal value/i);
      await input.fill("1500");
      await input.blur();
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toContain("--z-modal: 1500");

      // Reset → the file must return to the original value.
      await page
        .getByRole("button", { name: /reset --z-modal to original/i })
        .click();
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toContain(`--z-modal: ${original}`);
    } finally {
      writeFileSync(GLOBALS, before, "utf8"); // restore
    }
  });

  test("panel-appearance toggle flips data-editor-theme and persists across reload", async ({
    page,
  }) => {
    // Cosmetic-only: this touches no tokens and no globals.css, so there's nothing to restore.
    await page.goto("/design-system");
    await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode

    const root = page.locator("[data-editor-root]");
    const before = await root.getAttribute("data-editor-theme");
    expect(before).toBe("dark"); // default

    await page.getByRole("button", { name: /panel appearance/i }).click();
    await expect(root).toHaveAttribute("data-editor-theme", "light");

    // Reload → the (persisted) appearance must survive.
    await page.reload();
    await page.getByRole("button", { name: /edit/i }).click();
    await expect(page.locator("[data-editor-root]")).toHaveAttribute(
      "data-editor-theme",
      "light",
    );
  });

  test("empty state → select --primary shows group sibling rows → clicking a sibling promotes it", async ({
    page,
  }) => {
    // Cosmetic-only navigation/selection: touches no tokens and no globals.css.
    await page.goto("/design-system");
    await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode

    // Nothing selected yet → the instructional empty state is shown.
    await expect(
      page.getByText(/click any swatch, type sample, or component/i),
    ).toBeVisible();

    // Select --primary (color group) → sibling rows render, e.g. --secondary.
    await page.locator('[data-token="--primary"]').first().click();
    const siblings = page.locator(".ed-siblings");
    await expect(siblings).toBeVisible();
    const secondaryRow = siblings.getByRole("button", {
      name: "--secondary",
      exact: true,
    });
    await expect(secondaryRow).toBeVisible();

    // Click the sibling → the panel's context bar now shows that sibling's name.
    await secondaryRow.click();
    await expect(page.locator(".ed-context .ed-name")).toHaveText("--secondary");

    // Preview-width readout is present.
    await expect(page.getByTestId("ed-preview-width")).toBeVisible();
  });

  test("editing a field then tabbing/blurring out does NOT scroll the page (Bug 2)", async ({
    page,
  }) => {
    const before = readFileSync(GLOBALS, "utf8");
    try {
      await page.goto("/design-system");
      await page.getByRole("button", { name: /edit/i }).click(); // enable edit mode

      // Select a token whose row is mid-page, then put the page at a known scroll offset.
      await page.locator('[data-token="--z-modal"]').first().click();
      await page.evaluate(() => window.scrollTo(0, 600));

      const num = page.getByLabel(/--z-modal value/i);
      await expect(num).toBeVisible();
      await num.click();
      await num.fill("1500");

      // Before blur: the edit must NOT have persisted (commit-on-blur, not per keystroke).
      expect(readFileSync(GLOBALS, "utf8")).not.toContain("--z-modal: 1500");

      const yBefore = await page.evaluate(() => window.scrollY);

      // Leaving the field moves focus to the next element in DOM tab order. The panel is mounted
      // LAST in the document, so focus wraps to the page's first real focusable — far down the
      // design-system page (its first focusable is the components gallery near the bottom). The
      // browser scrolls that into view, yanking the page to the bottom. We assert the page holds.
      //
      // We drive the exact transition (a panel control losing focus to that far page control) so
      // the assertion is deterministic and not perturbed by the dev-overlay's own tab stop.
      const firstPageFocusableTop = await page.evaluate(() => {
        const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const el = Array.from(document.querySelectorAll(sel)).find(
          (n) => !n.closest(".ed-panel") && !n.closest("[data-editor-root] > nextjs-portal"),
        ) as HTMLElement | undefined;
        return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1;
      });
      // Sanity: the first page focusable really is far below our current scroll (the jump source).
      expect(firstPageFocusableTop).toBeGreaterThan(yBefore + 1000);

      // Tab to a sibling control inside the panel first (commits + blurs the field), then drive
      // the wrap: a panel control losing focus to the far page control. (Doing it from a sibling
      // rather than the field itself proves the panel-level guard — not just the field's own
      // blur handler — keeps the page put.)
      await page.keyboard.press("Tab");
      await page.waitForTimeout(40);
      expect(
        await page.evaluate(() => !!document.activeElement?.closest(".ed-panel")),
      ).toBe(true); // still in the panel (moved to a sibling control)

      await page.evaluate(() => {
        const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const target = Array.from(document.querySelectorAll(sel)).find(
          (n) => !n.closest(".ed-panel"),
        ) as HTMLElement | undefined;
        target?.focus();
      });
      await page.waitForTimeout(120);

      const yAfter = await page.evaluate(() => window.scrollY);
      // The page must NOT have slid to the focused (far-down) control.
      expect(Math.abs(yAfter - yBefore)).toBeLessThan(40);
      // And focus did genuinely leave the panel.
      expect(
        await page.evaluate(() => !document.activeElement?.closest(".ed-panel")),
      ).toBe(true);

      // And on blur the edit DID persist (debounced) → poll the file.
      await expect
        .poll(() => readFileSync(GLOBALS, "utf8"), { timeout: 5000 })
        .toContain("--z-modal: 1500");
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
