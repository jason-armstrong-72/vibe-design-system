// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { GradientBuilder } from "@/components/editor/controls/gradient-builder";
import type { ManifestToken } from "@/lib/tokens/generate";

afterEach(cleanup);

const TOKENS = [
  { name: "--brand-500", group: "color", values: { light: "oklch(0.62 0.17 250)" }, utilities: [] },
  { name: "--brand-600", group: "color", values: { light: "oklch(0.54 0.16 250)" }, utilities: [] },
  { name: "--card", group: "color", values: { light: "oklch(1 0 0)" }, utilities: [] },
] as unknown as ManifestToken[];

const LINEAR = "linear-gradient(135deg, var(--brand-500) 0%, var(--brand-600) 100%)";

function setup(value: string, extra: Partial<React.ComponentProps<typeof GradientBuilder>> = {}) {
  const onChange = vi.fn();
  render(<GradientBuilder token="--gradient-brand" value={value} onChange={onChange} tokens={TOKENS} {...extra} />);
  return onChange;
}

describe("GradientBuilder shell", () => {
  it("renders preview, a Linear/Radial radiogroup, and a raw input", () => {
    setup(LINEAR);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /linear/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /radial/i })).toBeTruthy();
    expect(screen.getByLabelText(/raw value/i)).toBeTruthy();
  });

  it("does not emit on mount", () => {
    const onChange = setup(LINEAR);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("unparseable value (conic) → dim fallback note + raw holds original, no mount emit", () => {
    const conic = "conic-gradient(from 0deg, red, blue)";
    const onChange = setup(conic);
    expect(screen.getByText(/can.t edit this gradient visually/i)).toBeTruthy();
    expect((screen.getByLabelText(/raw value/i) as HTMLInputElement).value).toBe(conic);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("raw row commits a valid string on Enter", () => {
    const onChange = setup(LINEAR);
    const raw = screen.getByLabelText(/raw value/i);
    const next = "linear-gradient(90deg, var(--card) 0%, transparent 100%)";
    fireEvent.change(raw, { target: { value: next } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(next);
  });

  it("switching type Linear→Radial emits one normalised value with default geometry", () => {
    const onChange = setup(LINEAR);
    fireEvent.click(screen.getByRole("radio", { name: /radial/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^radial-gradient\(circle at 50% 50%,/);
  });
});
