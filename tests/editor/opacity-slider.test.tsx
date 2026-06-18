// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { OpacitySlider } from "@/components/editor/controls/opacity-slider";

afterEach(cleanup);

describe("OpacitySlider", () => {
  it("seeds the slider + numeric field from the value", () => {
    render(<OpacitySlider token="--opacity-disabled" value="0.5" onChange={() => {}} />);
    const slider = screen.getByLabelText(/--opacity-disabled slider/i) as HTMLInputElement;
    const num = screen.getByLabelText(/--opacity-disabled value/i) as HTMLInputElement;
    expect(slider.type).toBe("range");
    expect(Number(slider.value)).toBeCloseTo(0.5, 3);
    expect(num.value).toBe("0.5");
  });

  it("the slider stays live: moving it emits a bare number string within 0..1", () => {
    const onChange = vi.fn();
    render(<OpacitySlider token="--opacity-disabled" value="0.5" onChange={onChange} />);
    const slider = screen.getByLabelText(/--opacity-disabled slider/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0.25" } });
    expect(onChange).toHaveBeenCalledWith("0.25");
  });

  it("typing the number does NOT persist; it commits on blur (clamped/tidied)", () => {
    const onChange = vi.fn();
    render(<OpacitySlider token="--opacity-disabled" value="0.5" onChange={onChange} />);
    const num = screen.getByLabelText(/--opacity-disabled value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "0.3" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(num);
    expect(onChange).toHaveBeenCalledWith("0.3");
  });

  it("commits the number on Enter", () => {
    const onChange = vi.fn();
    render(<OpacitySlider token="--opacity-disabled" value="0.5" onChange={onChange} />);
    const num = screen.getByLabelText(/--opacity-disabled value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "0.8" } });
    fireEvent.keyDown(num, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("0.8");
  });

  it("re-seeds the numeric draft when the external value changes", () => {
    const { rerender } = render(
      <OpacitySlider token="--opacity-disabled" value="0.5" onChange={() => {}} />,
    );
    const num = screen.getByLabelText(/--opacity-disabled value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "0.9" } }); // uncommitted draft
    rerender(<OpacitySlider token="--opacity-disabled" value="0.2" onChange={() => {}} />);
    expect(num.value).toBe("0.2");
  });
});
