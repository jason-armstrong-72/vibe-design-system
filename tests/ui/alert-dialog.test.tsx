// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogAction } from "@/components/ui/alert-dialog";

describe("AlertDialog", () => {
  it("opens on trigger and exposes an alertdialog with an action button", () => {
    const { getByText, getByRole } = render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Sure?</AlertDialogTitle>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    );
    fireEvent.click(getByText("Delete"));
    expect(getByRole("alertdialog")).toBeTruthy();
    expect(getByText("Confirm")).toBeTruthy();
  });
});
