// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("style");
});

function Probe() {
  const e = useEditor();
  return (
    <div>
      <span data-testid="enabled">{String(e.enabled)}</span>
      <span data-testid="selected">{e.selectedToken ?? "none"}</span>
      <span data-testid="block">{e.editingBlock}</span>
      <button onClick={() => e.enable()}>do-enable</button>
      <button onClick={() => e.select("--z-modal")}>do-select</button>
      <button onClick={() => e.select("--primary")}>do-select-primary</button>
      <button onClick={() => e.editValue("--primary", "oklch(0.5 0 0)")}>
        do-edit-primary
      </button>
      <button onClick={() => e.setEditingBlock("dark")}>do-dark</button>
      <button onClick={() => e.setEditingBlock("light")}>do-light</button>
    </div>
  );
}

function setup() {
  render(
    <EditorProvider>
      <Probe />
    </EditorProvider>,
  );
}

describe("EditorProvider", () => {
  it("defaults to disabled with nothing selected", () => {
    setup();
    expect(screen.getByTestId("enabled").textContent).toBe("false");
    expect(screen.getByTestId("selected").textContent).toBe("none");
    expect(screen.getByTestId("block").textContent).toBe("light");
  });

  it("enable() flips enabled true", () => {
    setup();
    fireEvent.click(screen.getByText("do-enable"));
    expect(screen.getByTestId("enabled").textContent).toBe("true");
  });

  it("select(name) sets the selected token", () => {
    setup();
    fireEvent.click(screen.getByText("do-select"));
    expect(screen.getByTestId("selected").textContent).toBe("--z-modal");
  });

  it("setEditingBlock('dark') updates the editing block", () => {
    setup();
    fireEvent.click(screen.getByText("do-dark"));
    expect(screen.getByTestId("block").textContent).toBe("dark");
  });

  it("setEditingBlock('dark') adds the .dark class to documentElement, light removes it", () => {
    setup();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    fireEvent.click(screen.getByText("do-dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByText("do-light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("switching blocks clears inline preview vars set during editing", () => {
    setup();
    fireEvent.click(screen.getByText("do-enable"));
    fireEvent.click(screen.getByText("do-select-primary"));
    fireEvent.click(screen.getByText("do-edit-primary"));
    // The edit applied an inline preview var on the root.
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
    ).toBe("oklch(0.5 0 0)");
    // Switching blocks must clear it so the file's :root/.dark value shows through.
    fireEvent.click(screen.getByText("do-dark"));
    expect(
      document.documentElement.style.getPropertyValue("--primary"),
    ).toBe("");
  });
});
