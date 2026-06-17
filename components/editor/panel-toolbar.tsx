"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/components/editor/editor-provider";

/** Width of the docked panel; mirrors PANEL_WIDTH in editor-mount.tsx. */
const PANEL_WIDTH = 312;

/**
 * Panel toolbar: close button + the editing-block chip and state caption (Task 11).
 *
 * The editing-block chip toggles which theme block of the SITE you're editing (light/dark) and
 * forces the page into that appearance so the preview is truthful. This is a different concept
 * from the panel's own appearance (the stubbed icon button), so the caption spells it out to
 * stop the two theme ideas getting confused (spec §4).
 */
export function PanelToolbar() {
  const { disable, editingBlock, setEditingBlock, panelAppearance, setPanelAppearance } =
    useEditor();
  const isDark = editingBlock === "dark";
  const isPanelDark = panelAppearance === "dark";

  // Effective preview width = the reflowed page area (viewport minus the docked panel).
  // SSR-guarded: compute in an effect on mount and keep it current on resize.
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  useEffect(() => {
    const measure = () =>
      setPreviewWidth(Math.max(0, window.innerWidth - PANEL_WIDTH));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div className="ed-toolbar">
      <div className="ed-toolbar-head">
        <span className="ed-title">Editor</span>
        <div className="ed-toolbar-actions">
          <button
            type="button"
            className="ed-chip"
            aria-label="Editing block"
            data-block={editingBlock}
            onClick={() => setEditingBlock(isDark ? "light" : "dark")}
          >
            <span className="ed-chip-label">Editing</span>
            <span className="ed-chip-value">{isDark ? "Dark" : "Light"}</span>
            <span aria-hidden="true">▾</span>
          </button>
          <button
            type="button"
            className="ed-iconbtn"
            aria-label="Panel appearance"
            title={`Panel appearance: ${isPanelDark ? "Dark" : "Light"}`}
            data-appearance={panelAppearance}
            onClick={() => setPanelAppearance(isPanelDark ? "light" : "dark")}
          >
            <span aria-hidden="true">{isPanelDark ? "☾" : "☀"}</span>
          </button>
          <button
            type="button"
            className="ed-iconbtn"
            aria-label="Close editor"
            onClick={disable}
          >
            ✕
          </button>
        </div>
      </div>
      <p className="ed-caption" data-testid="ed-caption">
        Editing your site&rsquo;s {isDark ? "dark" : "light"} theme.
      </p>
      {previewWidth !== null && (
        <p
          className="ed-preview-width"
          data-testid="ed-preview-width"
          title="Responsive breakpoints reflect this reduced width, not the full viewport."
        >
          Preview width <span className="ed-preview-width-val">{previewWidth}px</span>
        </p>
      )}
    </div>
  );
}
