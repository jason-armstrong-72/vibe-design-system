import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wcagContrast } from "culori";

// Source of truth: parse the actual --ed-* values out of the chrome CSS for each
// [data-editor-theme] kit, then assert the a11y gate from figma §A6: body text
// (--ed-text) and muted text (--ed-muted) both ≥ 4.5:1 against the field bg (--ed-field)
// in BOTH dark and light. (If a value fails, fix the CSS — never weaken the threshold.)
const CSS = readFileSync(
  resolve("components/editor/editor-chrome.css"),
  "utf8",
);

/** Pull the --ed-* custom properties out of a single [data-editor-theme="..."] block. */
function kit(theme: "dark" | "light"): Record<string, string> {
  const block = new RegExp(
    `\\[data-editor-root\\]\\[data-editor-theme="${theme}"\\]\\s*\\{([^}]*)\\}`,
  ).exec(CSS);
  expect(block, `missing [data-editor-theme="${theme}"] block`).toBeTruthy();
  const out: Record<string, string> = {};
  const re = /(--ed-[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block![1]))) out[m[1]] = m[2].trim();
  return out;
}

describe("editor chrome contrast gate (figma §A6)", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`${theme}: --ed-text on --ed-field ≥ 4.5:1`, () => {
      const k = kit(theme);
      const ratio = wcagContrast(k["--ed-text"], k["--ed-field"]);
      expect(
        ratio,
        `${theme} body text ${k["--ed-text"]} on ${k["--ed-field"]} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`${theme}: --ed-muted on --ed-field ≥ 4.5:1`, () => {
      const k = kit(theme);
      const ratio = wcagContrast(k["--ed-muted"], k["--ed-field"]);
      expect(
        ratio,
        `${theme} muted text ${k["--ed-muted"]} on ${k["--ed-field"]} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
