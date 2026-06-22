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
  it("renders just a color trigger; palette + alpha hidden until opened", () => {
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={() => {}} label="stop 1" />);
    expect(screen.getByRole("button", { name: /stop 1 color/i })).toBeTruthy();
    expect(screen.queryByRole("slider", { name: /stop 1 alpha/i })).toBeNull();
    expect(screen.queryByRole("menuitemradio", { name: /--card/ })).toBeNull();
  });

  it("opening the trigger reveals COLOR-token swatches (not non-color) + the alpha slider", () => {
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={() => {}} label="stop 1" />);
    fireEvent.click(screen.getByRole("button", { name: /stop 1 color/i }));
    expect(screen.getByRole("menuitemradio", { name: /--brand-500/ })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: /--card/ })).toBeTruthy();
    expect(screen.queryByRole("menuitemradio", { name: /--fs-base/ })).toBeNull();
    expect(screen.getByRole("slider", { name: /stop 1 alpha/i })).toBeTruthy();
  });

  it("picking a color emits that token NAME (popover stays open to tune alpha)", () => {
    const onChange = vi.fn();
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    fireEvent.click(screen.getByRole("button", { name: /stop 1 color/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /--card/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ color: "--card" }));
  });

  it("transparent option emits {color:transparent, alpha:0}", () => {
    const onChange = vi.fn();
    render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    fireEvent.click(screen.getByRole("button", { name: /stop 1 color/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /transparent/i }));
    expect(onChange).toHaveBeenCalledWith({ color: "transparent", alpha: 0, position: 0 });
  });

  it("alpha slider (in the popover) emits on change and is disabled for a transparent stop", () => {
    const onChange = vi.fn();
    const { rerender } = render(<GradientStopPicker stop={stop} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    fireEvent.click(screen.getByRole("button", { name: /stop 1 color/i }));
    fireEvent.change(screen.getByRole("slider", { name: /stop 1 alpha/i }), { target: { value: "80" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ alpha: 80 }));
    rerender(<GradientStopPicker stop={{ color: "transparent", alpha: 0, position: 50 }} tokens={TOKENS} onChange={onChange} label="stop 1" />);
    expect((screen.getByRole("slider", { name: /stop 1 alpha/i }) as HTMLInputElement).disabled).toBe(true);
  });
});
