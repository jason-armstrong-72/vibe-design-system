"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/components/editor/editor-provider";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * In edit mode, draws a thin fixed-position outline over the hovered [data-token]
 * element; clicking selects that token. Token-name label on hover is a later task.
 */
export function HighlightOverlay() {
  const { enabled, select } = useEditor();
  const [box, setBox] = useState<Box | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const tokenEl = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-token]");
    };

    const onMove = (e: PointerEvent) => {
      const el = tokenEl(e.target);
      if (!el) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const onClick = (e: MouseEvent) => {
      const el = tokenEl(e.target);
      const name = el?.getAttribute("data-token");
      if (!name) return;
      e.preventDefault();
      e.stopPropagation();
      select(name);
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled, select]);

  if (!enabled || !box) return null;

  return (
    <div
      className="ed-highlight"
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      }}
    />
  );
}
