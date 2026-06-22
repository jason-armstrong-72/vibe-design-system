// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PickMenu } from "@/components/editor/pick-menu";
import type { Match } from "@/lib/editor/resolve-token";

afterEach(cleanup);

describe("PickMenu", () => {
  it("renders a row per (property, token) and fires onPickToken", () => {
    const matches: Match[] = [
      { property: "background-color", group: "color", value: "#171717", tokens: ["--primary"] },
      { property: "border-radius", group: "radius", value: "8px", tokens: ["--radius"] },
    ];
    const onPickToken = vi.fn();
    render(<PickMenu anchor={{ x: 10, y: 10 }} matches={matches} onPickToken={onPickToken} onClose={() => {}} />);
    expect(screen.getByRole("menu", { name: /tokens for this element/i })).toBeTruthy();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("menuitem", { name: /--primary/ }));
    expect(onPickToken).toHaveBeenCalledWith("--primary");
  });
  it("lists every token of a collision", () => {
    const matches: Match[] = [
      { property: "background-color", group: "color", value: "#ffffff", tokens: ["--card", "--background", "--popover"] },
    ];
    render(<PickMenu anchor={{ x: 0, y: 0 }} matches={matches} onPickToken={() => {}} onClose={() => {}} />);
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  });
  it("shows the honest empty state with no matches", () => {
    render(<PickMenu anchor={{ x: 0, y: 0 }} matches={[]} onPickToken={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/no matching design token/i)).toBeTruthy();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  });
});
