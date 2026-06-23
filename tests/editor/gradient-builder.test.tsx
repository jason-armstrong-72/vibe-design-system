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
const RADIAL = "radial-gradient(circle at 50% 30%, var(--brand-500) 0%, transparent 70%)";

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

describe("GradientBuilder dark-block guard", () => {
  it("when disabled, shows the switch-to-Light message and no editing controls", () => {
    const onChange = setup(LINEAR, { disabled: true });
    expect(screen.getByText(/theme-independent.*switch to the light block/i)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByLabelText(/raw value/i)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("GradientBuilder stops", () => {
  it("renders one position input + remove button per stop, plus an add button", () => {
    setup(LINEAR);
    expect(screen.getByLabelText(/stop 1 position/i)).toBeTruthy();
    expect(screen.getByLabelText(/stop 2 position/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove stop 1/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /add stop/i })).toBeTruthy();
  });

  it("remove is disabled when only 2 stops remain", () => {
    setup(LINEAR);
    expect((screen.getByRole("button", { name: /remove stop 1/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("add stop emits a gradient with an extra stop", () => {
    const onChange = setup(LINEAR);
    fireEvent.click(screen.getByRole("button", { name: /add stop/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    // 3 stops now → 3 "var(...) N%" or "transparent N%" segments
    const v: string = onChange.mock.calls[0][0];
    expect(v.match(/%/g)?.length).toBe(3);
  });

  it("position numeric input commits a clamped value on Enter", () => {
    const onChange = setup(LINEAR);
    const pos = screen.getByLabelText(/stop 1 position/i);
    fireEvent.change(pos, { target: { value: "150" } }); // out of range → clamps to 100
    fireEvent.keyDown(pos, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/var\(--brand-500\) 100%/);
  });

  it("linear: angle slider emits a deg value", () => {
    const onChange = setup(LINEAR);
    const angle = screen.getByLabelText(/angle/i);
    fireEvent.change(angle, { target: { value: "90" } });
    expect(onChange).toHaveBeenCalledWith("linear-gradient(90deg, var(--brand-500) 0%, var(--brand-600) 100%)");
  });

  it("radial: shows a shape select + x/y position inputs + a pad", () => {
    setup(RADIAL);
    expect(screen.getByLabelText(/shape/i)).toBeTruthy();
    expect(screen.getByLabelText(/position x/i)).toBeTruthy();
    expect(screen.getByLabelText(/position y/i)).toBeTruthy();
    expect(document.querySelector(".ed-gradient-pad")).toBeTruthy();
  });

  it("radial: changing shape emits", () => {
    const onChange = setup(RADIAL);
    fireEvent.change(screen.getByLabelText(/shape/i), { target: { value: "ellipse" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^radial-gradient\(ellipse at/);
  });

  it("radial: dragging the pad emits ONE cx/cy on pointerup, nothing mid-move", () => {
    const onChange = setup(RADIAL);
    const pad = document.querySelector(".ed-gradient-pad") as HTMLElement;
    pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {} });
    pad.setPointerCapture = () => {};
    fireEvent.pointerDown(pad, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 25, clientY: 75 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { clientX: 25, clientY: 75 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^radial-gradient\(circle at 25% 75%,/);
  });

  it("dragging a handle emits ONE value on pointerup and nothing mid-move", () => {
    const onChange = setup(LINEAR);
    const ramp = document.querySelector(".ed-gradient-ramp") as HTMLElement;
    ramp.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 20, right: 200, bottom: 20, x: 0, y: 0, toJSON: () => {} });
    const handle = document.querySelector(".ed-gradient-handle") as HTMLElement; // stop 1 (position 0)
    handle.setPointerCapture = () => {};
    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 100 }); // 50%
    expect(onChange).not.toHaveBeenCalled(); // nothing mid-move
    fireEvent.pointerUp(window, { clientX: 100 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/var\(--brand-500\) 50%/);
  });
});
