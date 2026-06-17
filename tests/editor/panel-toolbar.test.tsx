// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EditorProvider } from "@/components/editor/editor-provider";
import { PanelToolbar } from "@/components/editor/panel-toolbar";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("style");
});

function setup() {
  render(
    <EditorProvider>
      <PanelToolbar />
    </EditorProvider>,
  );
}

describe("PanelToolbar editing-block chip + caption", () => {
  it("renders the editing-block chip defaulting to Light", () => {
    setup();
    const chip = screen.getByRole("button", { name: /editing block/i });
    expect(chip).toBeTruthy();
    expect(chip.textContent).toMatch(/light/i);
  });

  it("clicking the chip toggles the editing block to Dark and back", () => {
    setup();
    const chip = screen.getByRole("button", { name: /editing block/i });
    fireEvent.click(chip);
    expect(chip.textContent).toMatch(/dark/i);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(chip);
    expect(chip.textContent).toMatch(/light/i);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("the state caption reflects the active editing block", () => {
    setup();
    const caption = screen.getByTestId("ed-caption");
    expect(caption.textContent).toMatch(/light theme/i);
    fireEvent.click(screen.getByRole("button", { name: /editing block/i }));
    expect(caption.textContent).toMatch(/dark theme/i);
  });
});
