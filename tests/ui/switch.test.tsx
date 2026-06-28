// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("renders a checked switch", () => {
    const { getByRole } = render(<Switch defaultChecked />);
    const sw = getByRole("switch");
    expect(sw).toBeTruthy();
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });
});
