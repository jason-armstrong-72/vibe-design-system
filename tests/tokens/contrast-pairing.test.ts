import { describe, it, expect } from "vitest";
import { contrastResults } from "@/lib/tokens/contrast";
import type { Token } from "@/lib/tokens/types";

const tok = (name: string, value: string, theme: "light" | "dark" = "light"): Token =>
  ({ name, value, theme } as Token);

describe("contrastResults — structural pairing", () => {
  it("pairs an invented --x/--x-foreground outside COLOR_ROLES", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "oklch(0.99 0 0)"),
    ];
    const r = contrastResults(tokens);
    expect(r.some((p) => p.bg === "--promo" && p.fg === "--promo-foreground")).toBe(true);
  });

  it("skips a pair whose value is var()/color-mix() (no throw, no result)", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "var(--foreground)"),
    ];
    expect(() => contrastResults(tokens)).not.toThrow();
    expect(contrastResults(tokens).some((p) => p.fg === "--promo-foreground")).toBe(false);
  });

  it("skips an alpha pair (no bogus 21:1 pass)", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "oklch(1 0 0 / 0.1)"),
    ];
    expect(contrastResults(tokens).some((p) => p.fg === "--promo-foreground")).toBe(false);
  });

  it("still pairs --background/--foreground explicitly", () => {
    const tokens = [tok("--background", "oklch(1 0 0)"), tok("--foreground", "oklch(0.15 0 0)")];
    const r = contrastResults(tokens);
    expect(r.some((p) => p.bg === "--background" && p.fg === "--foreground")).toBe(true);
  });

  it("skips a color-mix() foreground (unresolvable → no result, no throw)", () => {
    const tokens = [
      tok("--promo", "oklch(0.6 0.2 250)"),
      tok("--promo-foreground", "color-mix(in oklch, var(--promo), white 20%)"),
    ];
    expect(() => contrastResults(tokens)).not.toThrow();
    expect(contrastResults(tokens).some((p) => p.fg === "--promo-foreground")).toBe(false);
  });
});
