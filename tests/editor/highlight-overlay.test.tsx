// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
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

describe("HighlightOverlay clear-on-leave + scroll tracking", () => {
  it("clears the box when a pointermove lands outside any [data-token]", () => {
    const { container } = render(
      <EditorProvider>
        <Capture />
        <HighlightOverlay />
        <button data-token="--primary">swatch</button>
        <div data-testid="outside">not a token</div>
      </EditorProvider>,
    );
    act(() => api!.enable());

    const target = container.querySelector(
      '[data-token="--primary"]',
    ) as HTMLElement;
    act(() => {
      fireEvent.pointerMove(target, { bubbles: true });
    });
    expect(container.querySelector(".ed-highlight")).toBeTruthy();

    // Move the pointer onto a non-token element → highlight must vanish immediately.
    const outside = container.querySelector(
      '[data-testid="outside"]',
    ) as HTMLElement;
    act(() => {
      fireEvent.pointerMove(outside, { bubbles: true });
    });
    expect(container.querySelector(".ed-highlight")).toBeNull();
    expect(container.querySelector(".ed-highlight-label")).toBeNull();
  });

  it("clears the box on document pointerleave", () => {
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
    expect(container.querySelector(".ed-highlight")).toBeTruthy();

    act(() => {
      fireEvent.pointerLeave(document, { bubbles: false });
    });
    expect(container.querySelector(".ed-highlight")).toBeNull();
  });

  it("attaches scroll/resize listeners and recomputes (no crash) while hovered", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const { container } = render(
      <EditorProvider>
        <Capture />
        <HighlightOverlay />
        <button data-token="--primary">swatch</button>
      </EditorProvider>,
    );
    act(() => api!.enable());

    expect(
      addSpy.mock.calls.some(([type]) => type === "scroll"),
    ).toBe(true);
    expect(
      addSpy.mock.calls.some(([type]) => type === "resize"),
    ).toBe(true);

    const target = container.querySelector(
      '[data-token="--primary"]',
    ) as HTMLElement;
    act(() => {
      fireEvent.pointerMove(target, { bubbles: true });
    });
    expect(container.querySelector(".ed-highlight")).toBeTruthy();

    // Dispatching a scroll while hovered must not crash and must keep the box.
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(container.querySelector(".ed-highlight")).toBeTruthy();

    addSpy.mockRestore();
  });
});
