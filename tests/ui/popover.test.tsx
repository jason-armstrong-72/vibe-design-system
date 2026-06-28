// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

describe("Popover", () => {
  it("opens on trigger and shows content", () => {
    const { getByText } = render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Hello popover</PopoverContent>
      </Popover>
    );
    fireEvent.click(getByText("Open"));
    expect(getByText("Hello popover")).toBeTruthy();
  });
});
