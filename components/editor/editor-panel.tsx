"use client";

import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { useEditor } from "@/components/editor/editor-provider";
import { PanelToolbar } from "@/components/editor/panel-toolbar";
import { ControlHost } from "@/components/editor/controls/control-host";
import { SaveState } from "@/components/editor/save-state";

const MANIFEST = designSystem as Manifest;

/** Docked-right panel, visible only when edit mode is enabled. */
export function EditorPanel() {
  const { enabled, selectedToken, perToken, reset } = useEditor();
  if (!enabled) return null;

  const token = selectedToken
    ? MANIFEST.tokens.find((t) => t.name === selectedToken)
    : undefined;
  const state = selectedToken ? perToken[selectedToken] : undefined;
  // Reset is meaningful only once the token has actually been touched: it differs from its
  // original or carries a non-idle writeback status (dirty/saving/saved/error).
  const canReset =
    !!state &&
    (state.status !== "idle" || state.current !== state.original);

  return (
    <aside className="ed-panel" aria-label="Token editor">
      <PanelToolbar />
      {selectedToken ? (
        <>
          <div className="ed-context">
            <div className="ed-context-head">
              <span className="ed-name">{selectedToken}</span>
              <button
                type="button"
                className="ed-reset"
                aria-label={`Reset ${selectedToken} to original`}
                disabled={!canReset}
                onClick={() => reset(selectedToken)}
              >
                Reset
              </button>
            </div>
            <span className="ed-group">{token?.group ?? "unknown group"}</span>
            {state && <SaveState status={state.status} error={state.error} />}
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
