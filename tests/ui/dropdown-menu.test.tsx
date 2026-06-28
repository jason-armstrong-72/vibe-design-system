// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

describe("DropdownMenu", () => {
  it("opens on trigger and exposes a menu item", () => {
    const { getByText, getByRole } = render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent><DropdownMenuItem>Profile</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
    );
    // Radix menu triggers open via pointer/keyboard, not jsdom's synthetic click.
    fireEvent.keyDown(getByText("Menu"), { key: "Enter" });
    expect(getByRole("menuitem")).toBeTruthy();
    expect(getByText("Profile")).toBeTruthy();
  });
});
