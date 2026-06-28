// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from "@/components/ui/dialog";

describe("Dialog", () => {
  it("opens on trigger and exposes an accessible dialog with a title", () => {
    const { getByText, getByRole } = render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent><DialogTitle>Hello</DialogTitle></DialogContent>
      </Dialog>
    );
    fireEvent.click(getByText("Open"));
    const dlg = getByRole("dialog");
    expect(dlg).toBeTruthy();
    expect(getByText("Hello")).toBeTruthy();
  });
});
