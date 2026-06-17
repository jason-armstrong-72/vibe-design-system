"use client";

import "@/components/editor/editor-chrome.css";
import { useEffect, useRef } from "react";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";
import { EditToggle } from "@/components/editor/edit-toggle";
import { HighlightOverlay } from "@/components/editor/highlight-overlay";
import { EditorPanel } from "@/components/editor/editor-panel";

const PANEL_WIDTH = 312;

/** Inner shell: reads editor state to set the chrome theme + reflow the page. */
function EditorShell({ children }: { children: React.ReactNode }) {
  const { enabled, panelAppearance } = useEditor();
  const rootRef = useRef<HTMLDivElement>(null);
  // Apply data-editor-theme imperatively so it always tracks panelAppearance. React's
  // hydration is lenient about attribute mismatches on the SSR'd root, so a value set by
  // the provider's mount effect (reading persisted localStorage) wouldn't otherwise repaint
  // the server-rendered attribute. This keeps the chrome theme in lockstep with state.
  useEffect(() => {
    rootRef.current?.setAttribute("data-editor-theme", panelAppearance);
  }, [panelAppearance]);
  return (
    <div ref={rootRef} data-editor-root data-editor-theme={panelAppearance}>
      <div style={enabled ? { marginRight: PANEL_WIDTH } : undefined}>
        {children}
      </div>
      <EditToggle />
      <HighlightOverlay />
      <EditorPanel />
    </div>
  );
}

/**
 * Dev-only mount. In production this renders children untouched and the editor tree
 * shakes out (NODE_ENV is statically replaced at build).
 */
export function EditorMount({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") return <>{children}</>;
  return (
    <EditorProvider>
      <EditorShell>{children}</EditorShell>
    </EditorProvider>
  );
}
