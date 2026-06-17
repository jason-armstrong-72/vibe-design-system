"use client";

import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { useEditor } from "@/components/editor/editor-provider";
import { PanelToolbar } from "@/components/editor/panel-toolbar";
import { ControlHost } from "@/components/editor/controls/control-host";

const MANIFEST = designSystem as Manifest;

/** Docked-right panel, visible only when edit mode is enabled. */
export function EditorPanel() {
  const { enabled, selectedToken } = useEditor();
  if (!enabled) return null;

  const token = selectedToken
    ? MANIFEST.tokens.find((t) => t.name === selectedToken)
    : undefined;

  return (
    <aside className="ed-panel" aria-label="Token editor">
      <PanelToolbar />
      {selectedToken ? (
        <>
          <div className="ed-context">
            <span className="ed-name">{selectedToken}</span>
            <span className="ed-group">{token?.group ?? "unknown group"}</span>
          </div>
          <div className="ed-body">
            <ControlHost />
          </div>
        </>
      ) : (
        <p className="ed-empty">
          Edit mode on — click any swatch, type sample, or component to edit its
          token.
        </p>
      )}
    </aside>
  );
}
