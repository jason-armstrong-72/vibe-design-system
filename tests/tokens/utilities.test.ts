import { describe, it, expect } from "vitest";
import { utilitiesForToken } from "@/lib/tokens/utilities";
import type { Token } from "@/lib/tokens/types";

const tok = (name: string, group: Token["group"]): Token =>
  ({ name, value: "x", theme: "light", group });

describe("utilitiesForToken", () => {
  it("bg/text/border for a semantic color", () => {
    expect(utilitiesForToken(tok("--primary", "color")).utilities)
      .toEqual(["bg-primary", "text-primary", "border-primary"]);
  });
  it("text-only for a -foreground color", () => {
    expect(utilitiesForToken(tok("--primary-foreground", "color")).utilities)
      .toEqual(["text-primary-foreground"]);
  });
  it("ramp + chart colors", () => {
    expect(utilitiesForToken(tok("--brand-500", "color")).utilities).toContain("bg-brand-500");
    expect(utilitiesForToken(tok("--chart-1", "color")).utilities).toContain("bg-chart-1");
  });
  it("non-paintable semantic colors map to specific utilities", () => {
    expect(utilitiesForToken(tok("--ring", "color")).utilities).toContain("ring-ring");
    expect(utilitiesForToken(tok("--border", "color")).utilities).toEqual(["border-border"]);
    expect(utilitiesForToken(tok("--input", "color")).utilities).toEqual(["border-input"]);
  });
  it("type size -> text-<step>", () => {
    expect(utilitiesForToken(tok("--fs-lg", "fontSize")).utilities).toEqual(["text-lg"]);
  });
  it("font weight / family", () => {
    expect(utilitiesForToken(tok("--fw-bold", "fontWeight")).utilities).toEqual(["font-bold"]);
    expect(utilitiesForToken(tok("--font-sans", "fontFamily")).utilities).toEqual(["font-sans"]);
  });
  it("shadow / radius / border-width / easing / z / opacity / container", () => {
    expect(utilitiesForToken(tok("--elevation-md", "shadow")).utilities).toEqual(["shadow-md"]);
    expect(utilitiesForToken(tok("--radius", "radius")).utilities).toContain("rounded-lg");
    expect(utilitiesForToken(tok("--radius", "radius")).utilities).toEqual(["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl"]); // default
    expect(utilitiesForToken(tok("--radius", "radius"), ["sm", "md", "lg", "xl", "2xl"]).utilities)
      .toEqual(["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"]); // F2: live @theme steps
    expect(utilitiesForToken(tok("--border-width-thick", "borderWidth")).utilities).toEqual(["border-thick"]);
    expect(utilitiesForToken(tok("--ease-standard", "easing")).utilities).toEqual(["ease-standard"]);
    expect(utilitiesForToken(tok("--z-modal", "zIndex")).utilities).toEqual(["z-modal"]);
    expect(utilitiesForToken(tok("--opacity-muted", "opacity")).utilities).toEqual(["opacity-muted"]);
    expect(utilitiesForToken(tok("--container-md", "container")).utilities).toEqual(["max-w-md"]);
  });
  it("groups with no standalone utility carry a usage note", () => {
    expect(utilitiesForToken(tok("--lh-base", "lineHeight")).usage).toMatch(/text-base/);
    expect(utilitiesForToken(tok("--spacing-base", "spacing")).usage).toMatch(/scale/i);
    expect(utilitiesForToken(tok("--duration-base", "duration")).usage).toMatch(/var\(--duration-base\)/);
  });
});
