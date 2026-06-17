// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, act, cleanup, fireEvent } from "@testing-library/react";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";
import { HighlightOverlay } from "@/components/editor/highlight-overlay";

afterEach(cleanup);

// jsdom returns a zero rect by default; that's fine — we only assert the label content/structure.
beforeAll(() => {
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 10, left: 20, width: 100, height: 40 }) as DOMRect;
});

let api: ReturnType<typeof useEditor> | null = null;
function Capture() {
  api = useEditor();
  return null;
}

describe("HighlightOverlay token-name label", () => {
  it("shows the hovered token's name as a label on the highlight box", () => {
    const { container } = render(
      <EditorProvider>
        <Capture />
        <HighlightOverlay />
        <button data-token="--primary">swatch</button>
      </EditorProvider>,
    );
    act(() => api!.enable());

    const target = container.querySelector(
      '[data-token="--primary"]',
    ) as HTMLElement;
    act(() => {
      fireEvent.pointerMove(target, { bubbles: true });
    });

    const label = container.querySelector(".ed-highlight-label");
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe("--primary");
  });

  it("renders no highlight (and no label) when nothing is hovered", () => {
    const { container } = render(
      <EditorProvider>
        <Capture />
        <HighlightOverlay />
      </EditorProvider>,
    );
    act(() => api!.enable());
    expect(container.querySelector(".ed-highlight")).toBeNull();
    expect(container.querySelector(".ed-highlight-label")).toBeNull();
  });
});
