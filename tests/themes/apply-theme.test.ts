import { describe, it, expect } from "vitest";
import { applyTheme } from "@/lib/tokens/apply-theme";
import { parseTokens } from "@/lib/tokens/parse";

const GLOBALS = `@import "tailwindcss";
:root {
  --primary: oklch(0.2 0 0);
  --radius: 0.625rem;
}
.dark {
  --primary: oklch(0.9 0 0);
}
@theme inline {
  --color-primary: var(--primary);
}
`;

const THEME = `:root {
  --primary: oklch(0.5 0.2 250);
  --radius: 0rem;
}
.dark {
  --primary: oklch(0.7 0.2 250);
}
`;

describe("applyTheme", () => {
  it("swaps :root and .dark values from the theme", () => {
    const out = applyTheme(GLOBALS, THEME);
    const t = parseTokens(out);
    const light = t.find((x) => x.name === "--primary" && x.theme === "light");
    const dark = t.find((x) => x.name === "--primary" && x.theme === "dark");
    expect(light?.value).toBe("oklch(0.5 0.2 250)");
    expect(dark?.value).toBe("oklch(0.7 0.2 250)");
    expect(t.find((x) => x.name === "--radius")?.value).toBe("0rem");
  });

  it("leaves the @theme inline block and imports untouched", () => {
    const out = applyTheme(GLOBALS, THEME);
    expect(out).toContain(`@import "tailwindcss";`);
    expect(out).toContain(`--color-primary: var(--primary);`);
  });

  it("is idempotent when the theme equals the current :root/.dark", () => {
    const before = parseTokens(GLOBALS);
    const selfTheme = `:root {\n  --primary: oklch(0.2 0 0);\n  --radius: 0.625rem;\n}\n.dark {\n  --primary: oklch(0.9 0 0);\n}\n`;
    const after = parseTokens(applyTheme(GLOBALS, selfTheme));
    expect(after).toEqual(before);
  });
});
