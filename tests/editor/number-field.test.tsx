// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { NumberField } from "@/components/editor/controls/number-field";

afterEach(cleanup);

describe("NumberField", () => {
  it("shows the seeded value", () => {
    render(<NumberField token="--z-modal" value="1300" onChange={() => {}} />);
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    expect(input.value).toBe("1300");
  });

  it("typing does NOT persist (no onChange per keystroke); the draft updates locally", () => {
    const onChange = vi.fn();
    render(<NumberField token="--z-modal" value="1300" onChange={onChange} />);
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1500" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("1500"); // draft reflects what was typed
  });

  it("commits the typed value on blur", () => {
    const onChange = vi.fn();
    render(<NumberField token="--z-modal" value="1300" onChange={onChange} />);
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("1500");
  });

  it("commits on Enter", () => {
    const onChange = vi.fn();
    render(<NumberField token="--z-modal" value="1300" onChange={onChange} />);
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("1500");
  });

  it("does not commit a non-integer on blur", () => {
    const onChange = vi.fn();
    render(<NumberField token="--z-modal" value="1300" onChange={onChange} />);
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("re-seeds the draft when the external value changes", () => {
    const { rerender } = render(
      <NumberField token="--z-modal" value="1300" onChange={() => {}} />,
    );
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "9999" } }); // dirty, uncommitted draft
    rerender(<NumberField token="--z-modal" value="1400" onChange={() => {}} />);
    expect(input.value).toBe("1400");
  });
});
