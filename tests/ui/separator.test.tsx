// tests/ui/separator.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Separator } from "@/components/ui/separator";

describe("Separator", () => {
  it("renders with the border surface + orientation data", () => {
    const { container } = render(<Separator orientation="vertical" />);
    const el = container.querySelector("[data-slot=separator]")!;
    expect(el.getAttribute("data-orientation")).toBe("vertical");
    expect(el.className).toContain("bg-border");
  });
});
