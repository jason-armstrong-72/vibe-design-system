"use client";

import { useCallback } from "react";
import { useEditor } from "@/components/editor/editor-provider";
import { useHoverRect, type HoverMatch } from "@/lib/editor/use-hover-rect";

/**
 * In edit mode (and NOT pick mode), draws a thin outline over the hovered [data-token] element, tagged with
 * the token name; clicking selects that token. The hover/scroll mechanics live in useHoverRect (shared with
 * pick-overlay).
 */
export function HighlightOverlay() {
  const { enabled, pickMode, select } = useEditor();

  const match = useCallback((target: EventTarget | null): HoverMatch<string> | null => {
    if (!(target instanceof Element)) return null;
    const el = target.closest<HTMLElement>("[data-token]");
    const name = el?.getAttribute("data-token");
    return el && name ? { el, payload: name } : null;
  }, []);
  const onPick = useCallback((name: string) => select(name), [select]);
  const label = useCallback((name: string) => name, []);

  const { box, boxRef } = useHoverRect<string>({
    active: enabled && !pickMode,
    match,
    onPick,
    onScroll: "reposition",
    label,
  });

  if (!enabled || pickMode || !box) return null;

  return (
    <div
      ref={boxRef}
      className="ed-highlight"
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    >
      <span className="ed-highlight-label">{box.label}</span>
    </div>
  );
}
