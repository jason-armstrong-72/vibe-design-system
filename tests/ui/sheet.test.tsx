// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from "@/components/ui/sheet";

describe("Sheet", () => {
  it("opens on trigger and renders sheet content with a title", () => {
    const { getByText, getByRole } = render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent><SheetTitle>Panel</SheetTitle></SheetContent>
      </Sheet>
    );
    fireEvent.click(getByText("Open"));
    expect(getByRole("dialog")).toBeTruthy();
    expect(getByText("Panel")).toBeTruthy();
  });
});
