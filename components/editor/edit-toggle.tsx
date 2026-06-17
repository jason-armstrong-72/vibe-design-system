"use client";

import { useEditor } from "@/components/editor/editor-provider";

/** Fixed dock-corner button toggling edit mode. Accessible name matches /edit/i. */
export function EditToggle() {
  const { enabled, toggle } = useEditor();
  return (
    <button
      type="button"
      className="ed-toggle"
      data-on={enabled}
      aria-pressed={enabled}
      onClick={toggle}
    >
      {enabled ? "Editing — done" : "Edit"}
    </button>
  );
}
