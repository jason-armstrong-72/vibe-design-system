// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { TextField } from "@/components/editor/controls/text-field";

afterEach(cleanup);

describe("TextField", () => {
  it("shows the seeded value", () => {
    const v = "0 4px 6px -1px oklch(0 0 0 / 0.1)";
    render(<TextField token="--elevation-md" value={v} onChange={() => {}} />);
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    expect(input.value).toBe(v);
  });

  it("emits the raw string on change", () => {
    const onChange = vi.fn();
    render(<TextField token="--elevation-md" value="0 1px 2px black" onChange={onChange} />);
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0 2px 4px black" } });
    expect(onChange).toHaveBeenCalledWith("0 2px 4px black");
  });

  it("does not emit a value containing injection delimiters", () => {
    const onChange = vi.fn();
    render(<TextField token="--elevation-md" value="0 1px 2px black" onChange={onChange} />);
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "red; } body {" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
