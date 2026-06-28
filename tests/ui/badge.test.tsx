// tests/ui/badge.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("applies the variant data attribute + label text", () => {
    const { getByText } = render(<Badge variant="success">Done</Badge>);
    const el = getByText("Done");
    expect(el.getAttribute("data-variant")).toBe("success");
    expect(el.className).toContain("bg-success");
  });
});
