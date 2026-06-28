// tests/ui/avatar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("renders the initials fallback with an accessible name", () => {
    const { getByText, container } = render(
      <Avatar aria-label="Jane Doe"><AvatarFallback aria-hidden>JD</AvatarFallback></Avatar>
    );
    expect(getByText("JD")).toBeTruthy();
    expect(container.querySelector("[data-slot=avatar]")?.getAttribute("aria-label")).toBe("Jane Doe");
  });
  it("AvatarGroup is a group", () => {
    const { container } = render(<AvatarGroup><Avatar /></AvatarGroup>);
    expect(container.querySelector("[data-slot=avatar-group]")?.getAttribute("role")).toBe("group");
  });
});
