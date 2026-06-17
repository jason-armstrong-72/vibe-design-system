// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EasingField } from "@/components/editor/controls/easing-field";

afterEach(cleanup);

const EASING_TOKENS = [
  { name: "--ease-standard", group: "easing" as const, values: { light: "cubic-bezier(0.2, 0, 0, 1)" }, utilities: [] },
  { name: "--ease-in", group: "easing" as const, values: { light: "cubic-bezier(0.4, 0, 1, 1)" }, utilities: [] },
  { name: "--ease-out", group: "easing" as const, values: { light: "cubic-bezier(0, 0, 0.2, 1)" }, utilities: [] },
];

describe("EasingField", () => {
  it("seeds the preset select from the current value", () => {
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={() => {}} tokens={EASING_TOKENS} />);
    const select = screen.getByLabelText(/--ease-standard preset/i) as HTMLSelectElement;
    expect(select.value).toBe("cubic-bezier(0.2, 0, 0, 1)");
  });

  it("emits a validator-passing easing on preset change", () => {
    const onChange = vi.fn();
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={EASING_TOKENS} />);
    const select = screen.getByLabelText(/--ease-standard preset/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "cubic-bezier(0.4, 0, 1, 1)" } });
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.4, 0, 1, 1)");
  });

  it("emits a valid custom cubic-bezier from the text input but not an invalid one", () => {
    const onChange = vi.fn();
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={EASING_TOKENS} />);
    const text = screen.getByLabelText(/--ease-standard custom/i) as HTMLInputElement;
    fireEvent.change(text, { target: { value: "not a curve" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(text, { target: { value: "cubic-bezier(0.1, 0.2, 0.3, 0.4)" } });
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.1, 0.2, 0.3, 0.4)");
  });
});
