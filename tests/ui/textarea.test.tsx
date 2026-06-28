// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    const { getByRole } = render(<Textarea placeholder="Notes" />);
    const ta = getByRole("textbox");
    expect(ta.tagName).toBe("TEXTAREA");
  });
});
