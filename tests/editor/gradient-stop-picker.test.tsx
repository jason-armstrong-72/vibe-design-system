// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GradientStopPicker } from "@/components/editor/controls/gradient-stop-picker";
import type { ManifestToken } from "@/lib/tokens/generate";
import type { Stop } from "@/lib/editor/gradient";

afterEach(cleanup);

const TOKENS = [
  { name: "--brand-500", group: "color", values: { light: "oklch(0.62 0.17 250)" }, utilities: [] },
  { name: "--card", group: "color", values: { light: "oklch(1 0 0)" }, utilities: [] },
  { name: "--fs-base", group: "fontSize", values: { light: "1rem" }, utilities: [] },
] as unknown as ManifestToken[];

const stop: Stop = { color: "--brand-500", alpha: 45, position: 0 };

describe("GradientStopPicker", () => {
  it("renders a swatch button per COLOR token (not non-color tokens)", () => {
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={() => {}} label="stop 1" />);
    expect(screen.getByRole("button", { name: /--brand-500/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /--card/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /--fs-base/ })).toBeNull();
  });

  it("clicking a color swatch emits that token NAME", () => {
    const onChange = vi.fn();
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    fireEvent.click(screen.getByRole("button", { name: /--card/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ color: "--card" }));
  });

  it("transparent chip emits {color:transparent, alpha:0}", () => {
    const onChange = vi.fn();
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    fireEvent.click(screen.getByRole("button", { name: /transparent/i }));
    expect(onChange).toHaveBeenCalledWith({ color: "transparent", alpha: 0, position: 0 });
  });

  it("alpha slider has an accessible name and emits on change", () => {
    const onChange = vi.fn();
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    const slider = screen.getByRole("slider", { name: /alpha/i });
    fireEvent.change(slider, { target: { value: "80" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ alpha: 80 }));
  });

  it("alpha slider is disabled for a transparent stop", () => {
    render(<GradientStopPicker stop={{ color: "transparent", alpha: 0, position: 50 }} tokens={TOKENS} onChange={() => {}} label="stop 2" />);
    expect((screen.getByRole("slider", { name: /alpha/i }) as HTMLInputElement).disabled).toBe(true);
  });
});
