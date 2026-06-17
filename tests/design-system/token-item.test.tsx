// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TokenItem } from "@/components/design-system/token-item";

const colorTok = {
  name: "--primary",
  group: "color" as const,
  values: { light: "oklch(0.205 0 0)", dark: "oklch(0.922 0 0)" },
  utilities: ["bg-primary", "text-primary", "border-primary"],
};

describe("TokenItem", () => {
  it("tags the item with data-token", () => {
    const { container } = render(<TokenItem token={colorTok} />);
    expect(container.querySelector('[data-token="--primary"]')).not.toBeNull();
  });
  it("shows the token name, a value, and its utilities", () => {
    const { container } = render(<TokenItem token={colorTok} />);
    const code = container.querySelector('[data-token="--primary"] code');
    expect(code?.textContent).toBe("--primary");
    expect(container.textContent).toContain("oklch(0.205 0 0)");
    expect(container.textContent).toContain("bg-primary");
  });
  it("renders a color preview swatch backed by the token var", () => {
    const { container } = render(<TokenItem token={colorTok} />);
    const sw = container.querySelector('[data-token="--primary"] [data-preview="swatch"]') as HTMLElement;
    expect(sw).not.toBeNull();
    expect(sw.style.background).toContain("var(--primary)");
  });

  it("tags non-color groups too (default branch covers everything)", () => {
    const durTok = { name: "--duration-base", group: "duration" as const, values: { light: "250ms" }, utilities: [], usage: "transition-duration via var(--duration-base)" };
    const { container } = render(<TokenItem token={durTok} />);
    expect(container.querySelector('[data-token="--duration-base"]')).not.toBeNull();
    expect(container.textContent).toContain("250ms");
  });
});
