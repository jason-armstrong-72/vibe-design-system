import { describe, it, expect } from "vitest";
import { checkBothTheme } from "@/lib/check/both-theme";
import { MSG } from "@/lib/check/messages";

const ok = `:root{ --primary: oklch(0.2 0 0); --primary-foreground: oklch(1 0 0); --brand-50: oklch(0.97 0 0); }
.dark{ --primary: oklch(0.9 0 0); --primary-foreground: oklch(0.2 0 0); }`;
const missingDark = `:root{ --primary: oklch(0.2 0 0); --primary-foreground: oklch(1 0 0); }
.dark{ --primary-foreground: oklch(0.2 0 0); }`;

describe("both-theme", () => {
  it("passes when semantic roles exist in both blocks; ignores :root-only brand ramps", () => {
    expect(checkBothTheme(ok)).toEqual([]);
  });
  it("flags a semantic role missing from .dark", () => {
    const f = checkBothTheme(missingDark);
    expect(f).toHaveLength(1);
    expect(f[0].message).toBe(MSG.bothThemeMissing("--primary", "dark"));
  });
});
