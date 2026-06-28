// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("renders a checked checkbox", () => {
    const { getByRole } = render(<Checkbox defaultChecked />);
    const cb = getByRole("checkbox");
    expect(cb).toBeTruthy();
    expect(cb.getAttribute("aria-checked")).toBe("true");
  });
});
