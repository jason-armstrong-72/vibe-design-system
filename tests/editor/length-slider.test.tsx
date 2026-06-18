// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { LengthSlider } from "@/components/editor/controls/length-slider";

afterEach(cleanup);

describe("LengthSlider", () => {
  it("seeds the numeric value and unit from a rem value", () => {
    render(<LengthSlider token="--radius" value="0.625rem" onChange={() => {}} />);
    const num = screen.getByLabelText(/--radius value/i) as HTMLInputElement;
    const unit = screen.getByLabelText(/--radius unit/i) as HTMLSelectElement;
    expect(num.value).toBe("0.625");
    expect(unit.value).toBe("rem");
  });

  it("preserves a px unit when seeded", () => {
    render(<LengthSlider token="--border-width-1" value="2px" onChange={() => {}} />);
    const unit = screen.getByLabelText(/--border-width-1 unit/i) as HTMLSelectElement;
    expect(unit.value).toBe("px");
  });

  it("typing the number does NOT persist; it commits on blur with a validator-passing length", () => {
    const onChange = vi.fn();
    render(<LengthSlider token="--radius" value="0.625rem" onChange={onChange} />);
    const num = screen.getByLabelText(/--radius value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "1" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(num);
    expect(onChange).toHaveBeenCalledWith("1rem");
  });

  it("commits the number on Enter", () => {
    const onChange = vi.fn();
    render(<LengthSlider token="--radius" value="0.625rem" onChange={onChange} />);
    const num = screen.getByLabelText(/--radius value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "1.5" } });
    fireEvent.keyDown(num, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("1.5rem");
  });

  it("emits the new unit when the unit changes, keeping the number (selects stay live)", () => {
    const onChange = vi.fn();
    render(<LengthSlider token="--radius" value="0.625rem" onChange={onChange} />);
    const unit = screen.getByLabelText(/--radius unit/i) as HTMLSelectElement;
    fireEvent.change(unit, { target: { value: "px" } });
    expect(onChange).toHaveBeenCalledWith("0.625px");
  });

  it("the slider stays live: moving it emits a length immediately", () => {
    const onChange = vi.fn();
    render(<LengthSlider token="--radius" value="0.625rem" onChange={onChange} />);
    const slider = screen.getByLabelText(/--radius slider/i) as HTMLInputElement;
    expect(slider.type).toBe("range");
    fireEvent.change(slider, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith("2rem");
  });

  it("re-seeds the numeric draft when the external value changes", () => {
    const { rerender } = render(
      <LengthSlider token="--radius" value="0.625rem" onChange={() => {}} />,
    );
    const num = screen.getByLabelText(/--radius value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "9" } }); // uncommitted draft
    rerender(<LengthSlider token="--radius" value="1rem" onChange={() => {}} />);
    expect(num.value).toBe("1");
  });
});
