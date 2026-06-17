// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";

afterEach(cleanup);

function Probe() {
  const e = useEditor();
  return (
    <div>
      <span data-testid="enabled">{String(e.enabled)}</span>
      <span data-testid="selected">{e.selectedToken ?? "none"}</span>
      <span data-testid="block">{e.editingBlock}</span>
      <button onClick={() => e.enable()}>do-enable</button>
      <button onClick={() => e.select("--z-modal")}>do-select</button>
      <button onClick={() => e.setEditingBlock("dark")}>do-dark</button>
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
});
