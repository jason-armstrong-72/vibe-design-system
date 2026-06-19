import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { syncThemeMappings } from "@/lib/tokens/sync";

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

describe("syncThemeMappings — colour (unchanged behaviour)", () => {
  it("adds @theme mappings for color tokens that lack them", () => {
    const { css, changed, added } = syncThemeMappings(CSS);
    expect(changed).toBe(true);
    expect(added).toContain("--color-highlight");
    expect(added).toContain("--color-highlight-foreground");
    expect(css).toContain("--color-highlight: var(--highlight);");
    expect(css).toContain("--color-highlight-foreground: var(--highlight-foreground);");
  });

  it("does not touch the existing mapping", () => {
    const { css } = syncThemeMappings(CSS);
    expect(css).toContain("--color-primary: var(--primary);");
    expect(css.match(/--color-primary:/g)?.length).toBe(1);
  });

  it("is idempotent — running on already-synced css changes nothing", () => {
    const once = syncThemeMappings(CSS).css;
    const twice = syncThemeMappings(once);
    expect(twice.changed).toBe(false);
    expect(twice.css).toBe(once);
  });
});

describe("syncThemeMappings — scale families", () => {
  it("wires a new shadow level", () => {
    const css = `:root{--elevation-xl: 0 20px 25px oklch(0 0 0 / .1);}\n@theme inline{\n--shadow-*: initial;\n}`;
    const r = syncThemeMappings(css);
    expect(r.changed).toBe(true);
    expect(r.css).toContain("--shadow-xl: var(--elevation-xl)");
  });

  it("wires a new font size WITH its line-height pair", () => {
    const css = `:root{--fs-8xl: 6rem; --lh-8xl: 6.25rem;}\n@theme inline{\n--text-*: initial;\n}`;
    const r = syncThemeMappings(css);
    expect(r.css).toContain("--text-8xl: var(--fs-8xl)");
    expect(r.css).toContain("--text-8xl--line-height: var(--lh-8xl)");
  });

  it("wires a font size WITHOUT line-height (lenient) and warns", () => {
    const css = `:root{--fs-8xl: 6rem;}\n@theme inline{\n--text-*: initial;\n}`;
    const r = syncThemeMappings(css);
    expect(r.css).toContain("--text-8xl: var(--fs-8xl)");
    expect(r.css).not.toContain("--text-8xl--line-height");
    expect(r.warnings.some((w) => w.includes("lh-8xl"))).toBe(true);
  });

  it("wires a new font weight", () => {
    const css = `:root{--fw-black: 900;}\n@theme inline{\n--font-weight-*: initial;\n}`;
    expect(syncThemeMappings(css).css).toContain("--font-weight-black: var(--fw-black)");
  });

  it("ignores non-wired groups (lineHeight, duration, …) without throwing", () => {
    const css = `:root{--lh-9xl: 8rem; --duration-xl: 1s;}\n@theme inline{\n}`;
    const r = syncThemeMappings(css);
    expect(r.changed).toBe(false);
    expect(r.css).not.toContain("--lineHeight");
  });

  it("is idempotent incl. line-height — second run adds nothing", () => {
    const css = `:root{--fs-8xl: 6rem; --lh-8xl: 6.25rem;}\n@theme inline{\n--text-*: initial;\n}`;
    const once = syncThemeMappings(css).css;
    const twice = syncThemeMappings(once);
    expect(twice.changed).toBe(false);
    expect(twice.added).toEqual([]);
  });
});

describe("syncThemeMappings — no-op on the real repo", () => {
  it("is a no-op on app/globals.css (every mapping already present)", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    const r = syncThemeMappings(css);
    expect(r.changed).toBe(false);
    expect(r.added).toEqual([]);
  });
});
