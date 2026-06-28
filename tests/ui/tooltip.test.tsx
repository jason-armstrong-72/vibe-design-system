// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

describe("Tooltip", () => {
  it("renders a trigger (provider-wrapped)", () => {
    const { getByText, container } = render(
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent>Tip text</TooltipContent>
      </Tooltip>
    );
    expect(getByText("Hover me")).toBeTruthy();
    expect(container.querySelector("[data-slot=tooltip-trigger]")).toBeTruthy();
  });
});
