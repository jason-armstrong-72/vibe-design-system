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
  const {
    enabled,
    selectedToken,
    editingBlock,
    perToken,
    reset,
    select,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useEditor();
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

  // Group sibling rows (model B): only the OTHER tokens in the selected token's group —
  // never the full catalogue. Robust across single-member groups (then siblings is empty).
  const siblings = token
    ? MANIFEST.tokens.filter(
        (t) => t.group === token.group && t.name !== token.name,
      )
    : [];
  const isColorGroup = token?.group === "color";

  return (
    <aside className="ed-panel" aria-label="Token editor">
      <PanelToolbar />
      {selectedToken ? (
        <>
          <div className="ed-context">
            <div className="ed-context-head">
              <span className="ed-name">{selectedToken}</span>
              <div className="ed-history-actions">
                <button
                  type="button"
                  className="ed-iconbtn ed-history-btn"
                  aria-label="Undo"
                  title="Undo"
                  disabled={!canUndo}
                  onClick={() => undo()}
                >
                  <span aria-hidden="true">↶</span>
                </button>
                <button
                  type="button"
                  className="ed-iconbtn ed-history-btn"
                  aria-label="Redo"
                  title="Redo"
                  disabled={!canRedo}
                  onClick={() => redo()}
                >
                  <span aria-hidden="true">↷</span>
                </button>
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
            </div>
            <span className="ed-group">{token?.group ?? "unknown group"}</span>
            {state && <SaveState status={state.status} error={state.error} />}
          </div>
          <div className="ed-body">
            <ControlHost />
          </div>
          <div className="ed-siblings" aria-label={`Other ${token?.group ?? ""} tokens`}>
            <p className="ed-siblings-head">In this group</p>
            {siblings.length === 0 ? (
              <p className="ed-siblings-empty">No other tokens in this group.</p>
            ) : (
              <ul className="ed-siblings-list">
                {siblings.map((t) => {
                  const v =
                    t.values[editingBlock] ??
                    t.values.light ??
                    t.values.dark ??
                    "";
                  return (
                    <li key={t.name}>
                      <button
                        type="button"
                        className="ed-sibling"
                        onClick={() => select(t.name)}
                        title={`Edit ${t.name}`}
                      >
                        {isColorGroup ? (
                          <span
                            className="ed-sibling-swatch"
                            style={{ background: v }}
                            aria-hidden="true"
                          />
                        ) : (
                          <span className="ed-sibling-value" aria-hidden="true">
                            {v}
                          </span>
                        )}
                        <span className="ed-sibling-name">{t.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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
