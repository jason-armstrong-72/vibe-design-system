// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

describe("Select", () => {
  it("renders a combobox trigger", () => {
    const { getByRole } = render(
      <Select>
        <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
        <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
      </Select>
    );
    expect(getByRole("combobox")).toBeTruthy();
  });
});
