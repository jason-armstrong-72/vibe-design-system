// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { SelectField } from "@/components/editor/controls/select-field";

afterEach(cleanup);

const FONT_TOKENS = [
  {
    name: "--font-sans",
    group: "fontFamily" as const,
    values: { light: "var(--font-bundled-sans), ui-sans-serif, system-ui, sans-serif" },
    utilities: [],
  },
  {
    name: "--font-mono",
    group: "fontFamily" as const,
    values: { light: "var(--font-bundled-mono), ui-monospace, SFMono-Regular, monospace" },
    utilities: [],
  },
];

describe("SelectField — fontWeight", () => {
  it("seeds the current weight and offers 100..900 step 100", () => {
    render(<SelectField token="--fw-bold" group="fontWeight" value="700" onChange={() => {}} tokens={FONT_TOKENS} />);
    const select = screen.getByLabelText(/--fw-bold/i) as HTMLSelectElement;
    expect(select.value).toBe("700");
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toEqual(["100", "200", "300", "400", "500", "600", "700", "800", "900"]);
  });

  it("emits the integer weight string on change", () => {
    const onChange = vi.fn();
    render(<SelectField token="--fw-bold" group="fontWeight" value="700" onChange={onChange} tokens={FONT_TOKENS} />);
    const select = screen.getByLabelText(/--fw-bold/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "400" } });
    expect(onChange).toHaveBeenCalledWith("400");
  });
});

describe("SelectField — fontFamily", () => {
  const current = "var(--font-bundled-sans), ui-sans-serif, system-ui, sans-serif";

  it("seeds the current stack and includes the manifest stacks as options", () => {
    render(<SelectField token="--font-sans" group="fontFamily" value={current} onChange={() => {}} tokens={FONT_TOKENS} />);
    const select = screen.getByLabelText(/--font-sans/i) as HTMLSelectElement;
    expect(select.value).toBe(current);
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toContain(current);
    expect(opts).toContain("var(--font-bundled-mono), ui-monospace, SFMono-Regular, monospace");
  });

  it("emits the full font stack string on change", () => {
    const onChange = vi.fn();
    render(<SelectField token="--font-sans" group="fontFamily" value={current} onChange={onChange} tokens={FONT_TOKENS} />);
    const select = screen.getByLabelText(/--font-sans/i) as HTMLSelectElement;
    const monoStack = "var(--font-bundled-mono), ui-monospace, SFMono-Regular, monospace";
    fireEvent.change(select, { target: { value: monoStack } });
    expect(onChange).toHaveBeenCalledWith(monoStack);
  });
});
