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

  it("emits a bare number string within 0..1 when the slider moves", () => {
    const onChange = vi.fn();
    render(<OpacitySlider token="--opacity-disabled" value="0.5" onChange={onChange} />);
    const slider = screen.getByLabelText(/--opacity-disabled slider/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "0.25" } });
    expect(onChange).toHaveBeenCalledWith("0.25");
  });
});
