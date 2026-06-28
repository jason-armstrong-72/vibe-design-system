// tests/ui/label.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Label } from "@/components/ui/label";

describe("Label", () => {
  it("renders a label with text and data-slot", () => {
    const { getByText, container } = render(<Label htmlFor="x">Email</Label>);
    expect(getByText("Email")).toBeTruthy();
    expect(container.querySelector("[data-slot=label]")).toBeTruthy();
  });
});
