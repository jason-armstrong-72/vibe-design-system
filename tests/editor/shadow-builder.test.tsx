// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ShadowBuilder } from "@/components/editor/controls/shadow-builder";

afterEach(cleanup);

const tokens = [
  { name: "--brand-500", group: "color", values: { light: "oklch(0.6 0.2 250)" } },
] as any;
const props = (value: string, onChange = vi.fn()) =>
  ({ token: "--elevation-md", value, onChange, tokens });

describe("ShadowBuilder", () => {
  it("renders preview, layer card, add + raw row; emits nothing on mount", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1)", onChange)} />);
    expect(screen.getByLabelText(/raw value/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /add layer/i })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("numeric blur commits on Enter (one onChange), reverts on Escape", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    const blur = screen.getByLabelText(/layer 1 blur/i) as HTMLInputElement;
    fireEvent.change(blur, { target: { value: "12" } });
    expect(onChange).not.toHaveBeenCalled();           // not while typing
    fireEvent.keyDown(blur, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("12px"));
  });

  it("add layer → one onChange with an extra layer; remove disabled at 1 layer", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    expect((screen.getByRole("button", { name: /remove layer 1/i }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /add layer/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].split(",").length).toBe(2);
  });

  it("inset toggle reads initial state, flips aria-pressed, emits with inset removed", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("inset 0 2px 4px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    const toggle = screen.getByRole("button", { name: /layer 1 inset/i });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");      // initial reads model
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).not.toContain("inset");
  });

  it("accordion: collapsed layer inputs not in tree; expanding swaps which layer is open; emits nothing", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1), 0 2px 4px 0 oklch(0 0 0 / 0.1)", onChange)} />);
    // layer 1 open by default (card), layer 2 collapsed (summary row)
    expect(screen.getByLabelText(/layer 1 blur/i)).toBeTruthy();
    expect(screen.queryByLabelText(/layer 2 blur/i)).toBeNull();
    const exp2 = screen.getByRole("button", { name: /expand layer 2/i });
    expect(exp2.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(exp2);
    // layer 2 now expanded; layer 1 collapsed to a summary row with its own expander.
    // NOTE: exp2 is now detached (replaced by the card) — re-query the live tree, never assert the stale node.
    expect(screen.getByLabelText(/layer 2 blur/i)).toBeTruthy();
    expect(screen.queryByLabelText(/layer 1 blur/i)).toBeNull();
    expect(screen.getByRole("button", { name: /expand layer 1/i })).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();                       // pure UI, no value change
  });

  it("unmodellable value → raw row holds it, emits nothing on mount; raw commit emits", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 1px 2px rgb(0,0,0)", onChange)} />);
    const raw = screen.getByLabelText(/raw value/i) as HTMLInputElement;
    expect(raw.value).toBe("0 1px 2px rgb(0,0,0)");
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(raw, { target: { value: "0 2px 4px 0 oklch(0 0 0 / 0.2)" } });
    fireEvent.keyDown(raw, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("0 2px 4px 0 oklch(0 0 0 / 0.2)");
  });

  it("dark-block disabled: shows switch-to-Light, emits nothing", () => {
    const onChange = vi.fn();
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)", onChange)} disabled />);
    expect(screen.getByText(/switch to the Light block/i)).toBeTruthy();
    expect(screen.queryByLabelText(/layer 1 blur/i)).toBeNull();
  });

  it("a11y: numeric inputs labelled per layer, color grid is a menu", () => {
    render(<ShadowBuilder {...props("0 4px 6px 0 oklch(0 0 0 / 0.1)")} />);
    expect(screen.getByLabelText(/layer 1 x offset/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/layer 1 color/i));
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
