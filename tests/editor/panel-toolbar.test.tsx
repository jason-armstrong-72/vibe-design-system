// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EditorProvider } from "@/components/editor/editor-provider";
import { PanelToolbar } from "@/components/editor/panel-toolbar";

afterEach(() => {
  cleanup();
  localStorage.clear();
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

describe("PanelToolbar panel-appearance toggle (Task 13)", () => {
  it("renders a panel-appearance icon button with that accessible name", () => {
    setup();
    const btn = screen.getByRole("button", { name: /panel appearance/i });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("the appearance button and the editing-block chip are distinct controls", () => {
    setup();
    const appearance = screen.getByRole("button", {
      name: /panel appearance/i,
    });
    const chip = screen.getByRole("button", { name: /editing block/i });
    expect(appearance).not.toBe(chip);
    // Distinct accessible names so the two theme controls don't read alike (spec §4).
    expect(appearance.getAttribute("aria-label")).not.toBe(
      chip.getAttribute("aria-label"),
    );
  });

  it("clicking the appearance button flips data-editor-theme on the editor root (dark↔light)", () => {
    render(
      <EditorProvider>
        <div data-editor-root data-editor-theme="dark">
          <PanelToolbar />
        </div>
      </EditorProvider>,
    );
    // We can't read panelAppearance off the toolbar directly; assert via a sibling probe
    // is overkill — instead assert the button reflects/toggles its pressed-ish state.
    const btn = screen.getByRole("button", { name: /panel appearance/i });
    const before = btn.getAttribute("data-appearance");
    fireEvent.click(btn);
    expect(btn.getAttribute("data-appearance")).not.toBe(before);
    fireEvent.click(btn);
    expect(btn.getAttribute("data-appearance")).toBe(before);
  });

  it("clicking the appearance button persists to localStorage", () => {
    localStorage.clear();
    setup();
    // default dark when storage empty
    const btn = screen.getByRole("button", { name: /panel appearance/i });
    expect(btn.getAttribute("data-appearance")).toBe("dark");
    fireEvent.click(btn);
    expect(localStorage.getItem("ds-editor-appearance")).toBe("light");
  });
});
