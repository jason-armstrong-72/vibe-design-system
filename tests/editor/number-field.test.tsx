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

  it("fires onChange with the new string value when typing", () => {
    const onChange = vi.fn();
    render(<NumberField token="--z-modal" value="1300" onChange={onChange} />);
    const input = screen.getByLabelText(/z-modal/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1500" } });
    expect(onChange).toHaveBeenCalledWith("1500");
  });
});
