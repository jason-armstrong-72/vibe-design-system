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

  it("emits a validator-passing easing on preset change (selects stay live)", () => {
    const onChange = vi.fn();
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={EASING_TOKENS} />);
    const select = screen.getByLabelText(/--ease-standard preset/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "cubic-bezier(0.4, 0, 1, 1)" } });
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.4, 0, 1, 1)");
  });

  it("the custom field does NOT persist while typing; it commits a valid cubic-bezier on blur", () => {
    const onChange = vi.fn();
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={EASING_TOKENS} />);
    const text = screen.getByLabelText(/--ease-standard custom/i) as HTMLInputElement;
    fireEvent.change(text, { target: { value: "cubic-bezier(0.1, 0.2, 0.3, 0.4)" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(text);
    expect(onChange).toHaveBeenCalledWith("cubic-bezier(0.1, 0.2, 0.3, 0.4)");
  });

  it("does not commit an invalid custom curve on blur", () => {
    const onChange = vi.fn();
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={EASING_TOKENS} />);
    const text = screen.getByLabelText(/--ease-standard custom/i) as HTMLInputElement;
    fireEvent.change(text, { target: { value: "not a curve" } });
    fireEvent.blur(text);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits the custom curve on Enter", () => {
    const onChange = vi.fn();
    render(<EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={onChange} tokens={EASING_TOKENS} />);
    const text = screen.getByLabelText(/--ease-standard custom/i) as HTMLInputElement;
    fireEvent.change(text, { target: { value: "ease-in-out" } });
    fireEvent.keyDown(text, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("ease-in-out");
  });

  it("re-seeds the custom draft when the external value changes", () => {
    const { rerender } = render(
      <EasingField token="--ease-standard" value="cubic-bezier(0.2, 0, 0, 1)" onChange={() => {}} tokens={EASING_TOKENS} />,
    );
    const text = screen.getByLabelText(/--ease-standard custom/i) as HTMLInputElement;
    fireEvent.change(text, { target: { value: "linear" } }); // uncommitted draft
    rerender(<EasingField token="--ease-standard" value="cubic-bezier(0.4, 0, 1, 1)" onChange={() => {}} tokens={EASING_TOKENS} />);
    expect(text.value).toBe("cubic-bezier(0.4, 0, 1, 1)");
  });
});
