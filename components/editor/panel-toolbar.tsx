"use client";

import { useEditor } from "@/components/editor/editor-provider";

/**
 * Minimal toolbar for Task 5: a close button (calls disable). Panel-appearance and
 * editing-block toggles are stubbed for later tasks. Styled with the chrome tokens.
 */
export function PanelToolbar() {
  const { disable } = useEditor();
  return (
    <div className="ed-toolbar">
      <span className="ed-title">Editor</span>
      <button
        type="button"
        className="ed-iconbtn"
        aria-label="Close editor"
        onClick={disable}
      >
        ✕
      </button>
    </div>
  );
}
