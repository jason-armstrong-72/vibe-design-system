// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaveState } from "@/components/editor/save-state";

afterEach(cleanup);

describe("SaveState", () => {
  it("renders 'Unsaved' for dirty", () => {
    render(<SaveState status="dirty" />);
    expect(screen.getByText(/unsaved/i)).toBeTruthy();
  });

  it("renders 'Saving' for saving", () => {
    render(<SaveState status="saving" />);
    expect(screen.getByText(/saving/i)).toBeTruthy();
  });

  it("renders 'Saved' for saved", () => {
    render(<SaveState status="saved" />);
    expect(screen.getByText(/saved/i)).toBeTruthy();
  });

  it("renders 'Error' plus the error message for error", () => {
    render(<SaveState status="error" error="write failed (400)" />);
    expect(screen.getByText(/error/i)).toBeTruthy();
    expect(screen.getByText(/write failed \(400\)/i)).toBeTruthy();
  });

  it("renders no status label for idle", () => {
    render(<SaveState status="idle" />);
    expect(screen.queryByText(/unsaved|saving|saved|error/i)).toBeNull();
  });

  it("exposes a polite live region for the status", () => {
    const { container } = render(<SaveState status="saving" />);
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
