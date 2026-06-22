// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("style");
});

function Probe() {
  const e = useEditor();
  const pt = e.selectedToken ? e.perToken[e.selectedToken] : undefined;
  return (
    <div>
      <span data-testid="enabled">{String(e.enabled)}</span>
      <span data-testid="pick">{String(e.pickMode)}</span>
      <span data-testid="selected">{e.selectedToken ?? "none"}</span>
      <span data-testid="block">{e.editingBlock}</span>
      <span data-testid="pt-original">{pt?.original ?? "none"}</span>
      <span data-testid="pt-current">{pt?.current ?? "none"}</span>
      <span data-testid="pt-status">{pt?.status ?? "none"}</span>
      <span data-testid="can-undo">{String(e.canUndo)}</span>
      <span data-testid="can-redo">{String(e.canRedo)}</span>
      <span data-testid="committed-primary-light">{e.committedValue("--primary", "light")}</span>
      <span data-testid="committed-ring-dark">{e.committedValue("--ring", "dark")}</span>
      <button onClick={() => e.enable()}>do-enable</button>
      <button onClick={() => e.disable()}>do-disable</button>
      <button onClick={() => e.togglePickMode()}>do-pick</button>
      <button onClick={() => e.select("--z-modal")}>do-select</button>
      <button onClick={() => e.select("--primary")}>do-select-primary</button>
      <button onClick={() => e.editValue("--primary", "oklch(0.5 0 0)")}>
        do-edit-primary
      </button>
      <button onClick={() => e.editValue("--primary", "oklch(0.6 0 0)")}>
        do-edit-primary-2
      </button>
      <button onClick={() => e.reset("--primary")}>do-reset-primary</button>
      <button onClick={() => e.undo()}>do-undo</button>
      <button onClick={() => e.redo()}>do-redo</button>
      <button onClick={() => e.setEditingBlock("dark")}>do-dark</button>
      <button onClick={() => e.setEditingBlock("light")}>do-light</button>
      <span data-testid="appearance">{e.panelAppearance}</span>
      <button onClick={() => e.setPanelAppearance("light")}>do-appear-light</button>
      <button onClick={() => e.setPanelAppearance("dark")}>do-appear-dark</button>
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
  it("pickMode toggles and is cleared by disable()", () => {
    setup();
    fireEvent.click(screen.getByText("do-enable"));
    expect(screen.getByTestId("pick").textContent).toBe("false");
    act(() => { fireEvent.click(screen.getByText("do-pick")); });
    expect(screen.getByTestId("pick").textContent).toBe("true");
    act(() => { fireEvent.click(screen.getByText("do-disable")); });
    expect(screen.getByTestId("pick").textContent).toBe("false");
  });

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

  it("editValue marks the token dirty with original preserved", () => {
    setup();
    fireEvent.click(screen.getByText("do-enable"));
    fireEvent.click(screen.getByText("do-select-primary"));
    const original = screen.getByTestId("pt-original").textContent;
    fireEvent.click(screen.getByText("do-edit-primary"));
    expect(screen.getByTestId("pt-status").textContent).toBe("dirty");
    expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.5 0 0)");
    expect(screen.getByTestId("pt-original").textContent).toBe(original);
  });

  it("reset restores current to original and status to idle", () => {
    setup();
    fireEvent.click(screen.getByText("do-enable"));
    fireEvent.click(screen.getByText("do-select-primary"));
    const original = screen.getByTestId("pt-original").textContent;
    fireEvent.click(screen.getByText("do-edit-primary"));
    expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.5 0 0)");
    fireEvent.click(screen.getByText("do-reset-primary"));
    expect(screen.getByTestId("pt-current").textContent).toBe(original);
    expect(screen.getByTestId("pt-status").textContent).toBe("idle");
  });

  it("surfaces a rejected write as status 'error' (and the queue rolls the preview back)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "out of range" }), {
          status: 400,
        }),
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    setup();
    fireEvent.click(screen.getByText("do-enable"));
    fireEvent.click(screen.getByText("do-select-primary"));
    const original = screen.getByTestId("pt-original").textContent;
    fireEvent.click(screen.getByText("do-edit-primary"));
    expect(screen.getByTestId("pt-status").textContent).toBe("dirty");

    // Flush the debounced write (rejected by the 400) inside act so React state settles.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId("pt-status").textContent).toBe("error");
    // Queue rolled the inline preview var back to last-known-good (the original).
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe(
      original,
    );
  });

  it("panelAppearance defaults to 'dark' when localStorage is empty", () => {
    localStorage.clear();
    setup();
    expect(screen.getByTestId("appearance").textContent).toBe("dark");
  });

  it("setPanelAppearance persists to localStorage and a fresh provider reads it back", () => {
    localStorage.clear();
    setup();
    fireEvent.click(screen.getByText("do-appear-light"));
    expect(screen.getByTestId("appearance").textContent).toBe("light");
    expect(localStorage.getItem("ds-editor-appearance")).toBe("light");
    // A fresh provider (re-mount) must read the stored value back.
    cleanup();
    setup();
    expect(screen.getByTestId("appearance").textContent).toBe("light");
  });

  describe("undo/redo history", () => {
    it("two committed edits then undo() walks back through the values; redo re-applies", () => {
      setup();
      fireEvent.click(screen.getByText("do-enable"));
      fireEvent.click(screen.getByText("do-select-primary"));
      const original = screen.getByTestId("pt-original").textContent;

      // No history yet.
      expect(screen.getByTestId("can-undo").textContent).toBe("false");
      expect(screen.getByTestId("can-redo").textContent).toBe("false");

      // First committed edit.
      fireEvent.click(screen.getByText("do-edit-primary"));
      expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.5 0 0)");
      expect(screen.getByTestId("can-undo").textContent).toBe("true");
      expect(screen.getByTestId("can-redo").textContent).toBe("false");

      // Second committed edit.
      fireEvent.click(screen.getByText("do-edit-primary-2"));
      expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.6 0 0)");

      // First undo → back to the first edit's value; redo now available.
      fireEvent.click(screen.getByText("do-undo"));
      expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.5 0 0)");
      expect(screen.getByTestId("can-redo").textContent).toBe("true");

      // Second undo → back to the original.
      fireEvent.click(screen.getByText("do-undo"));
      expect(screen.getByTestId("pt-current").textContent).toBe(original);
      expect(screen.getByTestId("can-undo").textContent).toBe("false");

      // Redo → re-applies the first edit.
      fireEvent.click(screen.getByText("do-redo"));
      expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.5 0 0)");
    });

    it("a new edit after undo clears the redo stack (linear history)", () => {
      setup();
      fireEvent.click(screen.getByText("do-enable"));
      fireEvent.click(screen.getByText("do-select-primary"));

      fireEvent.click(screen.getByText("do-edit-primary")); // 0.5
      fireEvent.click(screen.getByText("do-edit-primary-2")); // 0.6
      fireEvent.click(screen.getByText("do-undo")); // back to 0.5
      expect(screen.getByTestId("can-redo").textContent).toBe("true");

      // A brand-new edit clears redo.
      fireEvent.click(screen.getByText("do-edit-primary-2")); // 0.6 again, fresh branch
      expect(screen.getByTestId("can-redo").textContent).toBe("false");
    });

    it("a reset is undoable (prev=current, next=original)", () => {
      setup();
      fireEvent.click(screen.getByText("do-enable"));
      fireEvent.click(screen.getByText("do-select-primary"));
      const original = screen.getByTestId("pt-original").textContent;

      fireEvent.click(screen.getByText("do-edit-primary")); // 0.5
      fireEvent.click(screen.getByText("do-reset-primary")); // back to original
      expect(screen.getByTestId("pt-current").textContent).toBe(original);

      // Undo the reset → back to the edited value.
      fireEvent.click(screen.getByText("do-undo"));
      expect(screen.getByTestId("pt-current").textContent).toBe("oklch(0.5 0 0)");
    });
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

  it("committedValue returns the live per-block value (edited > manifest)", () => {
    setup();
    // Unedited token → manifest fallback (non-empty).
    expect(screen.getByTestId("committed-ring-dark").textContent).not.toBe("");
    const manifestPrimary = screen.getByTestId("committed-primary-light").textContent;
    expect(manifestPrimary).not.toBe("");
    // Edit --primary in the light block → committedValue reflects it.
    fireEvent.click(screen.getByText("do-edit-primary"));
    expect(screen.getByTestId("committed-primary-light").textContent).toBe("oklch(0.5 0 0)");
    expect(screen.getByTestId("committed-primary-light").textContent).not.toBe(manifestPrimary);
  });
});
