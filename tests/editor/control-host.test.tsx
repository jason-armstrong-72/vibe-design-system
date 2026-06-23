// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, act, cleanup, within } from "@testing-library/react";
import { CONTROL_KINDS, type ControlKind } from "@/lib/editor/control-map";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";
import { ControlHost } from "@/components/editor/controls/control-host";

afterEach(cleanup);

// One representative token per ControlKind, all present in the bundled manifest.
const REP: Record<ControlKind, string> = {
  color: "--primary",
  length: "--radius",
  number: "--z-modal",
  opacity: "--opacity-disabled",
  select: "--fw-bold",
  duration: "--duration-base",
  easing: "--ease-standard",
  text: "--elevation-md",
  gradient: "--gradient-brand",
};

let api: ReturnType<typeof useEditor> | null = null;
function Capture() {
  api = useEditor();
  return <ControlHost />;
}

function renderFor(token: string): HTMLElement {
  const { container } = render(
    <EditorProvider>
      <Capture />
    </EditorProvider>,
  );
  act(() => api!.select(token));
  return container;
}

describe("ControlHost registry completeness", () => {
  it("covers every declared ControlKind with a representative token", () => {
    // Guards that the REP map stays in sync with CONTROL_KINDS.
    expect(Object.keys(REP).sort()).toEqual([...CONTROL_KINDS].sort());
  });

  for (const kind of CONTROL_KINDS) {
    it(`resolves a real (non-stub) control for kind "${kind}"`, () => {
      const container = renderFor(REP[kind]);
      const scope = within(container);

      // No "coming soon" stub anywhere.
      expect(container.querySelector(".ed-stub")).toBeNull();
      expect(container.textContent ?? "").not.toMatch(/coming soon/i);

      // A real, editable control is present.
      const editable =
        scope.queryAllByRole("textbox").length +
        scope.queryAllByRole("slider").length +
        scope.queryAllByRole("combobox").length +
        scope.queryAllByRole("spinbutton").length +
        container.querySelectorAll("input, select").length;
      expect(editable).toBeGreaterThan(0);
    });
  }
});
