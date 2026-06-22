"use client";

import "@/components/editor/editor-chrome.css";
import { useEffect, useRef } from "react";
import { EditorProvider, useEditor } from "@/components/editor/editor-provider";
import { EditToggle } from "@/components/editor/edit-toggle";
import { HighlightOverlay } from "@/components/editor/highlight-overlay";
import { PickOverlay } from "@/components/editor/pick-overlay";
import { EditorPanel } from "@/components/editor/editor-panel";

const PANEL_WIDTH = 312;

/** Inner shell: reads editor state to set the chrome theme + reflow the page. */
function EditorShell({ children }: { children: React.ReactNode }) {
  const { enabled, panelAppearance, undo, redo } = useEditor();
  const rootRef = useRef<HTMLDivElement>(null);

  // Keyboard history: ⌘Z / Ctrl+Z → undo, ⌘⇧Z / Ctrl+Shift+Z → redo. Document-level and active
  // ONLY while edit mode is enabled (effect-only, so it's inherently SSR-safe — no window access on
  // the server). We deliberately do NOT hijack native text-field undo: if focus is in a text input
  // or textarea inside the panel (the user mid-typing a draft value), we let the browser handle ⌘Z
  // (native field undo) and only apply TOKEN undo/redo when focus is NOT in such a field. A token
  // edit isn't committed until blur/Enter anyway, so deferring to the field's own undo here is the
  // correct, least-surprising behavior.
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const isEditableField = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "TEXTAREA" ||
        (tag === "INPUT" && node.getAttribute("type") !== "range") ||
        node.isContentEditable
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      // Mid-typing a draft in a text field → leave ⌘Z to the browser's native field undo.
      if (isEditableField(document.activeElement)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, undo, redo]);
  // Apply data-editor-theme imperatively so it always tracks panelAppearance. React's
  // hydration is lenient about attribute mismatches on the SSR'd root, so a value set by
  // the provider's mount effect (reading persisted localStorage) wouldn't otherwise repaint
  // the server-rendered attribute. This keeps the chrome theme in lockstep with state.
  useEffect(() => {
    rootRef.current?.setAttribute("data-editor-theme", panelAppearance);
  }, [panelAppearance]);

  // Bug 2: leaving an editor field with Tab moves focus to the next element in DOM tab order.
  // The panel is mounted last in the document, so focus wraps to the page's first focusable —
  // far down on the design-system page — and the browser scrolls it into view, yanking the page
  // to the bottom (often via a body intermediate, so it can take a follow-up Tab to land there).
  //
  // While edit mode is on we "arm" a pinning excursion the moment focus crosses OUT of the panel,
  // and restore the scroll position (next frame) on every focus move until the user interacts with
  // a pointer or focus returns to the panel. This keeps the page put while tabbing away from a
  // field, but never fights deliberate, pointer-initiated navigation of the page. The panel is
  // position:fixed, so pinning the page scroll never hides any panel control.
  // The "good" scroll position captured the instant focus leaves the panel — BEFORE the browser
  // scrolls the next (far-down) focusable into view. Held in a ref so it survives re-renders that
  // can happen mid-excursion (e.g. dev-overlay focus churn). We restore to it on each focus move
  // during the excursion. (Capturing in focusin would be too late: the browser scrolls first, then
  // fires focusin, so we'd pin the already-jumped position.)
  const pinnedRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const inPanel = (n: Node | null) => {
      const panel = rootRef.current?.querySelector(".ed-panel");
      return !!panel && !!n && panel.contains(n);
    };
    const restore = () => {
      const p = pinnedRef.current;
      if (!p) return;
      // Restore immediately (some browsers scroll-into-view synchronously before focusin)…
      if (window.scrollX !== p.x || window.scrollY !== p.y) window.scrollTo(p.x, p.y);
      // …and again next frame, in case the scroll-into-view lands after this handler.
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          const cur = pinnedRef.current;
          if (cur === p && (window.scrollX !== p.x || window.scrollY !== p.y)) {
            window.scrollTo(p.x, p.y);
          }
        });
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      // Focus is leaving a panel control for somewhere outside the panel → start the excursion:
      // snapshot the still-good scroll position (fires before any scroll-into-view) and hold it.
      if (inPanel(e.target as Node) && !inPanel(e.relatedTarget as Node)) {
        pinnedRef.current = { x: window.scrollX, y: window.scrollY };
        restore();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (inPanel(e.target as Node)) {
        pinnedRef.current = null; // back in the panel — end the excursion
      } else {
        restore(); // still tabbing away from the field — hold the captured position
      }
    };
    // A real pointer interaction means the user chose to go somewhere — stop holding.
    const disarm = () => {
      pinnedRef.current = null;
    };
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", disarm, true);
    return () => {
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", disarm, true);
    };
  }, [enabled]);

  return (
    <div ref={rootRef} data-editor-root data-editor-theme={panelAppearance}>
      <div style={enabled ? { marginRight: PANEL_WIDTH } : undefined}>
        {children}
      </div>
      <EditToggle />
      <HighlightOverlay />
      <PickOverlay />
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
