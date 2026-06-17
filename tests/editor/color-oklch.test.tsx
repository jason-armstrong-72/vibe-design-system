// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { ColorOklch } from "@/components/editor/controls/color-oklch";
import type { ManifestToken } from "@/lib/tokens/generate";

afterEach(cleanup);

const TOKENS: ManifestToken[] = [
  {
    name: "--primary",
    group: "color",
    values: { light: "oklch(0.205 0 0)", dark: "oklch(0.922 0 0)" },
    utilities: ["bg-primary"],
  },
  {
    name: "--primary-foreground",
    group: "color",
    values: { light: "oklch(0.985 0 0)", dark: "oklch(0.205 0 0)" },
    utilities: ["text-primary-foreground"],
  },
  {
    name: "--accent",
    group: "color",
    values: { light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
    utilities: ["bg-accent"],
  },
  {
    name: "--z-modal",
    group: "zIndex",
    values: { light: "1300" },
    utilities: [],
  },
];

function renderControl(overrides: Partial<React.ComponentProps<typeof ColorOklch>> = {}) {
  const onChange = vi.fn();
  render(
    <ColorOklch
      token="--primary"
      value="oklch(0.205 0 0)"
      onChange={onChange}
      tokens={TOKENS}
      editingBlock="light"
      {...overrides}
    />,
  );
  return { onChange };
}

describe("ColorOklch", () => {
  it("renders L/C/H sliders + hex field + swatch seeded from oklch(0.205 0 0)", () => {
    renderControl();
    const l = screen.getByLabelText(/lightness/i) as HTMLInputElement;
    const c = screen.getByLabelText(/chroma/i) as HTMLInputElement;
    const h = screen.getByLabelText(/hue/i) as HTMLInputElement;
    expect(l.type).toBe("range");
    expect(c.type).toBe("range");
    expect(h.type).toBe("range");
    expect(Number(l.value)).toBeCloseTo(0.205, 3);
    expect(Number(c.value)).toBeCloseTo(0, 3);
    expect(Number(h.value)).toBeCloseTo(0, 1);
    // hex field present + seeded
    const hex = screen.getByLabelText(/hex/i) as HTMLInputElement;
    expect(hex.value.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    // swatch present
    expect(screen.getByTestId("color-swatch")).toBeTruthy();
  });

  it("moving the Lightness slider fires onChange with a re-formatted oklch() string", () => {
    const { onChange } = renderControl();
    const l = screen.getByLabelText(/lightness/i) as HTMLInputElement;
    fireEvent.change(l, { target: { value: "0.5" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("oklch(0.5 0 0)");
  });

  it("typing a hex updates → onChange with the converted oklch", () => {
    const { onChange } = renderControl();
    const hex = screen.getByLabelText(/hex/i) as HTMLInputElement;
    fireEvent.change(hex, { target: { value: "#ffffff" } });
    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls.at(-1)![0] as string;
    expect(arg).toMatch(/^oklch\(/);
    // white → lightness ~1
    const l = Number(arg.match(/oklch\(([\d.]+)/)![1]);
    expect(l).toBeGreaterThan(0.99);
  });

  it("renders reuse-a-token swatches and clicking one calls onChange with that token's value", () => {
    const { onChange } = renderControl();
    // --accent is another color token; --primary (self) and zIndex excluded
    const reuse = screen.getByRole("button", { name: /--accent/i });
    fireEvent.click(reuse);
    expect(onChange).toHaveBeenCalledWith("oklch(0.97 0 0)");
    // self should not appear as a reuse swatch
    expect(screen.queryByRole("button", { name: /reuse --primary$/i })).toBeNull();
  });

  it("renders a contrast badge with a ratio when the token has a fg/bg partner", () => {
    renderControl();
    const badge = screen.getByTestId("contrast-badge");
    // --primary (0.205) vs --primary-foreground (0.985) → high contrast, should pass
    expect(badge.textContent).toMatch(/\d/);
    expect(badge.textContent?.toLowerCase()).toMatch(/pass|fail/);
  });

  describe("eyedropper", () => {
    beforeEach(() => {
      delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
    });
    afterEach(() => {
      delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
    });

    it("is ABSENT when window.EyeDropper is undefined", () => {
      renderControl();
      expect(screen.queryByRole("button", { name: /eyedropper/i })).toBeNull();
    });

    it("is PRESENT when window.EyeDropper is stubbed", () => {
      (window as unknown as { EyeDropper: unknown }).EyeDropper = class {
        open() {
          return Promise.resolve({ sRGBHex: "#ffffff" });
        }
      };
      renderControl();
      expect(screen.queryByRole("button", { name: /eyedropper/i })).toBeTruthy();
    });
  });
});
