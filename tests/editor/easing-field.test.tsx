// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EasingField } from "@/components/editor/controls/easing-field";
import { GEOM_DEFAULT, parseBezier } from "@/lib/editor/bezier";

afterEach(cleanup);

const TOKENS = [
  { name: "--ease-standard", group: "easing" as const, values: { light: "cubic-bezier(0.2, 0, 0, 1)" }, utilities: [] },
  { name: "--ease-in", group: "easing" as const, values: { light: "cubic-bezier(0.4, 0, 1, 1)" }, utilities: [] },
  { name: "--ease-out", group: "easing" as const, values: { light: "cubic-bezier(0, 0, 0.2, 1)" }, utilities: [] },
];

// jsdom has no layout: stub the SVG rect to the viewBox so client->viewBox mapping is identity.
beforeEach(() => {
  Object.defineProperty(SVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ left: 0, top: 0, width: GEOM_DEFAULT.width, height: GEOM_DEFAULT.height, right: GEOM_DEFAULT.width, bottom: GEOM_DEFAULT.height, x: 0, y: 0, toJSON() {} }),
  });
  // jsdom doesn't implement pointer capture
  if (!(Element.prototype as unknown as { setPointerCapture?: unknown }).setPointerCapture) {
    (Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
    (Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
  }
});

function setup(value = "cubic-bezier(0.2, 0, 0, 1)") {
  const onChange = vi.fn();
  render(<EasingField token="--ease-standard" value={value} onChange={onChange} tokens={TOKENS} />);
  return { onChange };
}

describe("EasingField (curve editor)", () => {
  it("renders the canvas, two handles, four numeric inputs, presets, and the raw row", () => {
    setup();
    expect(screen.getByRole("img", { name: /easing curve/i })).toBeTruthy(); // svg role=img
    expect(screen.getAllByRole("spinbutton").length).toBe(4);                 // 4 number inputs
    expect(screen.getByLabelText(/--ease-standard raw value/i)).toBeTruthy(); // raw text row
    expect(screen.getByRole("button", { name: /ease-in-out/i })).toBeTruthy(); // a preset chip
  });

  it("dragging a handle emits exactly one onChange (a normalised cubic-bezier) on pointer-up, nothing mid-move", () => {
    const { onChange } = setup();
    const p1 = screen.getByTestId("ed-bezier-handle-1");
    fireEvent.pointerDown(p1, { pointerId: 1, clientX: 24, clientY: 210 });
    fireEvent.pointerMove(p1, { pointerId: 1, clientX: 120, clientY: 90 }); // -> x≈0.5, y≈1
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(p1, { pointerId: 1, clientX: 120, clientY: 90 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^cubic-bezier\(0\.5, 1, 0, 1\)$/);
  });

  it("drag clamps x into [0,1] even when dragged past the canvas edge", () => {
    const { onChange } = setup();
    const p2 = screen.getByTestId("ed-bezier-handle-2");
    fireEvent.pointerDown(p2, { pointerId: 1, clientX: 216, clientY: 90 });
    fireEvent.pointerMove(p2, { pointerId: 1, clientX: 99999, clientY: 90 });
    fireEvent.pointerUp(p2, { pointerId: 1, clientX: 99999, clientY: 90 });
    // Parse the emitted curve back to a tuple (don't number-extract the string —
    // "cubic-bezier" contains a hyphen that pollutes a naive /[-\d.]+/ match).
    const [x1, , x2] = parseBezier(onChange.mock.calls[0][0])!;
    expect(x1).toBeGreaterThanOrEqual(0);
    expect(x2).toBeLessThanOrEqual(1);
  });

  it("numeric input does not emit while typing; commits a merged curve on blur", () => {
    const { onChange } = setup();
    const startX = screen.getByLabelText(/--ease-standard start x/i) as HTMLInputElement;
    fireEvent.change(startX, { target: { value: "0.5" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(startX);
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.5, 0, 0, 1)");
  });

  it("rejects an out-of-range numeric x on blur", () => {
    const { onChange } = setup();
    const startX = screen.getByLabelText(/--ease-standard start x/i) as HTMLInputElement;
    fireEvent.change(startX, { target: { value: "5" } });
    fireEvent.blur(startX);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking a preset chip emits the converted cubic-bezier", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /^ease-in-out$/i }));
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.42, 0, 0.58, 1)");
  });

  it("a steps()/var() value renders the raw string and emits NOTHING on mount", () => {
    const { onChange } = setup("steps(4, end)");
    expect((screen.getByLabelText(/--ease-standard raw value/i) as HTMLInputElement).value).toBe("steps(4, end)");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the raw row commits a valid value on Enter and rejects an invalid one", () => {
    const { onChange } = setup("steps(4, end)");
    const raw = screen.getByLabelText(/--ease-standard raw value/i) as HTMLInputElement;
    fireEvent.change(raw, { target: { value: "garbage" } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(raw, { target: { value: "var(--ease-in)" } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("var(--ease-in)");
  });

  it("re-seeds inputs when the external value changes (block-switch/undo)", () => {
    const onChange = vi.fn();
    const { rerender } = render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={TOKENS} />);
    const startX = screen.getByLabelText(/--ease-standard start x/i) as HTMLInputElement;
    expect(startX.value).toBe("0.2");
    rerender(<EasingField token="--ease-standard" value="cubic-bezier(0.4, 0, 1, 1)" onChange={onChange} tokens={TOKENS} />);
    expect(startX.value).toBe("0.4");
  });

  it("handles are aria-hidden (numeric inputs are the keyboard path)", () => {
    setup();
    expect(screen.getByTestId("ed-bezier-handle-1").getAttribute("aria-hidden")).toBe("true");
  });
});
