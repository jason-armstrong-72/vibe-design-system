// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { DurationSlider } from "@/components/editor/controls/duration-slider";

afterEach(cleanup);

describe("DurationSlider", () => {
  it("seeds the numeric value + unit from a ms value", () => {
    render(<DurationSlider token="--duration-base" value="250ms" onChange={() => {}} />);
    const num = screen.getByLabelText(/--duration-base value/i) as HTMLInputElement;
    const unit = screen.getByLabelText(/--duration-base unit/i) as HTMLSelectElement;
    expect(num.value).toBe("250");
    expect(unit.value).toBe("ms");
  });

  it("emits a validator-passing duration when the number changes", () => {
    const onChange = vi.fn();
    render(<DurationSlider token="--duration-base" value="250ms" onChange={onChange} />);
    const num = screen.getByLabelText(/--duration-base value/i) as HTMLInputElement;
    fireEvent.change(num, { target: { value: "300" } });
    expect(onChange).toHaveBeenCalledWith("300ms");
  });

  it("emits seconds when the unit is switched to s", () => {
    const onChange = vi.fn();
    render(<DurationSlider token="--duration-base" value="250ms" onChange={onChange} />);
    const unit = screen.getByLabelText(/--duration-base unit/i) as HTMLSelectElement;
    fireEvent.change(unit, { target: { value: "s" } });
    expect(onChange).toHaveBeenCalledWith("250s");
  });
});
