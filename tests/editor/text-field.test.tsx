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

  it("typing does NOT persist; it commits the raw string on blur", () => {
    const onChange = vi.fn();
    render(<TextField token="--elevation-md" value="0 1px 2px black" onChange={onChange} />);
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0 2px 4px black" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("0 2px 4px black");
  });

  it("commits on Enter", () => {
    const onChange = vi.fn();
    render(<TextField token="--elevation-md" value="0 1px 2px black" onChange={onChange} />);
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0 3px 6px black" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("0 3px 6px black");
  });

  it("does not commit a value containing injection delimiters on blur", () => {
    const onChange = vi.fn();
    render(<TextField token="--elevation-md" value="0 1px 2px black" onChange={onChange} />);
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "red; } body {" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("re-seeds the draft when the external value changes", () => {
    const { rerender } = render(
      <TextField token="--elevation-md" value="0 1px 2px black" onChange={() => {}} />,
    );
    const input = screen.getByLabelText(/--elevation-md/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "dirty draft" } }); // uncommitted
    rerender(<TextField token="--elevation-md" value="0 5px 5px navy" onChange={() => {}} />);
    expect(input.value).toBe("0 5px 5px navy");
  });
});
