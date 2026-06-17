import { describe, it, expect } from "vitest";
import { syncThemeColorMappings } from "@/lib/tokens/sync";

const CSS = `:root {
  --primary: oklch(0.2 0 0);
  --highlight: oklch(0.7 0.2 320);
  --highlight-foreground: oklch(0.99 0 0);
}
.dark {
  --primary: oklch(0.9 0 0);
  --highlight: oklch(0.6 0.2 320);
  --highlight-foreground: oklch(0.2 0 0);
}
@theme inline {
  --color-*: initial;
  --color-primary: var(--primary);
}
`;

describe("syncThemeColorMappings", () => {
  it("adds @theme mappings for color tokens that lack them", () => {
    const { css, changed, added } = syncThemeColorMappings(CSS);
    expect(changed).toBe(true);
    expect(added).toContain("--color-highlight");
    expect(added).toContain("--color-highlight-foreground");
    expect(css).toContain("--color-highlight: var(--highlight);");
    expect(css).toContain("--color-highlight-foreground: var(--highlight-foreground);");
  });

  it("does not touch the existing mapping", () => {
    const { css } = syncThemeColorMappings(CSS);
    expect(css).toContain("--color-primary: var(--primary);");
    // exactly one --color-primary mapping
    expect(css.match(/--color-primary:/g)?.length).toBe(1);
  });

  it("is idempotent — running on already-synced css changes nothing", () => {
    const once = syncThemeColorMappings(CSS).css;
    const twice = syncThemeColorMappings(once);
    expect(twice.changed).toBe(false);
    expect(twice.css).toBe(once);
  });

  it("ignores non-color tokens (only colors get @theme mappings here)", () => {
    const withSize = CSS.replace("--primary: oklch(0.2 0 0);", "--primary: oklch(0.2 0 0);\n  --fs-lg: 1.125rem;");
    const { css } = syncThemeColorMappings(withSize);
    expect(css).not.toContain("--color-fs-lg");
  });
});
