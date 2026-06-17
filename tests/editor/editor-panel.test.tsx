// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import {
  render,
  act,
  cleanup,
  within,
  fireEvent,
  screen,
} from "@testing-library/react";
import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";
import { EditorPanel } from "@/components/editor/editor-panel";

const MANIFEST = designSystem as Manifest;

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("style");
});

let api: ReturnType<typeof useEditor> | null = null;
function Capture() {
  api = useEditor();
  return null;
}

function setup() {
  const utils = render(
    <EditorProvider>
      <Capture />
      <EditorPanel />
    </EditorProvider>,
  );
  return utils;
}

describe("EditorPanel empty state", () => {
  it("shows the instructional empty-state copy when enabled with nothing selected", () => {
    setup();
    act(() => api!.enable());
    expect(
      screen.getByText(/click any swatch, type sample, or component/i),
    ).toBeTruthy();
  });

  it("renders nothing when edit mode is disabled", () => {
    const { container } = setup();
    expect(container.querySelector(".ed-panel")).toBeNull();
  });
});

describe("EditorPanel group sibling rows", () => {
  it("lists the OTHER tokens in the selected token's group", () => {
    const { container } = setup();
    act(() => api!.enable());
    act(() => api!.select("--primary")); // color group (41 members)

    const list = container.querySelector(".ed-siblings");
    expect(list).toBeTruthy();
    const scope = within(list as HTMLElement);

    // A known color sibling is present...
    expect(scope.getByText("--secondary")).toBeTruthy();
    // ...and the focused token itself is NOT listed as a clickable sibling row.
    expect(scope.queryByText("--primary")).toBeNull();
  });

  it("clicking a sibling row promotes it via select(name)", () => {
    const { container } = setup();
    act(() => api!.enable());
    act(() => api!.select("--primary"));

    // Wrap select so we can assert the call (provider state also flips).
    const list = container.querySelector(".ed-siblings") as HTMLElement;
    const row = within(list).getByText("--secondary").closest("button");
    expect(row).toBeTruthy();
    act(() => fireEvent.click(row!));

    // The panel re-renders focused on the promoted sibling.
    expect(api!.selectedToken).toBe("--secondary");
    // ...and --secondary is now the context name, no longer a sibling row.
    expect(container.querySelector(".ed-name")?.textContent).toBe(
      "--secondary",
    );
  });

  it("renders a faint 'no other tokens' note for a single-member group", () => {
    // 'spacing' has exactly one member in the manifest.
    const lone = MANIFEST.tokens.find((t) => t.group === "spacing");
    expect(lone).toBeTruthy();
    const { container } = setup();
    act(() => api!.enable());
    act(() => api!.select(lone!.name));

    const list = container.querySelector(".ed-siblings");
    expect(list?.textContent ?? "").toMatch(/no other tokens/i);
  });
});
