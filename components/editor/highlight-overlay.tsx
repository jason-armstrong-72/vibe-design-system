"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/components/editor/editor-provider";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  name: string;
}

/**
 * In edit mode, draws a thin fixed-position outline over the hovered [data-token]
 * element, tagged with the token name; clicking selects that token.
 *
 * The box is position:fixed and positioned from getBoundingClientRect() (viewport
 * coords). Those coords go stale the moment the page (or any scroll container)
 * scrolls, so we keep a ref to the *currently hovered* element and recompute its
 * rect on scroll/resize — keeping the box glued to the element instead of letting
 * it linger at a stale spot. The highlight is cleared immediately whenever the
 * pointer is no longer over a [data-token] (or leaves the document / edit mode off).
 */
export function HighlightOverlay() {
  const { enabled, select } = useEditor();
  const [box, setBox] = useState<Box | null>(null);
  // The element currently under the pointer (drives scroll/resize repositioning).
  const hoveredRef = useRef<HTMLElement | null>(null);
  // The rendered box node — positioned imperatively on scroll to avoid React-render lag.
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // SSR guard: only touch document/window in the effect (client-only).
    if (!enabled || typeof document === "undefined") return;

    const tokenEl = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("[data-token]");
    };

    // Recompute the box from the currently-hovered element's live rect.
    const reposition = () => {
      const el = hoveredRef.current;
      const name = el?.getAttribute("data-token");
      if (!el || !name) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height, name });
    };

    const clear = () => {
      hoveredRef.current = null;
      setBox(null);
    };

    const onMove = (e: PointerEvent) => {
      const el = tokenEl(e.target);
      // Pointer no longer over a token → clear immediately (no lingering box).
      if (!el || !el.getAttribute("data-token")) {
        clear();
        return;
      }
      hoveredRef.current = el;
      reposition();
    };

    // Reposition by writing straight to the box's DOM style — synchronous, in the same
    // frame as the scroll, so the outline stays glued instead of trailing by a React
    // re-render (which caused a ~10-20px lag). No setState here on purpose.
    const onScrollOrResize = () => {
      const el = hoveredRef.current;
      const node = boxRef.current;
      if (!el || !node) return;
      const r = el.getBoundingClientRect();
      node.style.top = `${r.top}px`;
      node.style.left = `${r.left}px`;
      node.style.width = `${r.width}px`;
      node.style.height = `${r.height}px`;
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
    document.addEventListener("pointerleave", clear, true);
    document.addEventListener("click", onClick, true);
    // Capture phase so scrolls inside any nested scroll container are caught too;
    // passive since we never preventDefault — keeps scrolling smooth.
    window.addEventListener("scroll", onScrollOrResize, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerleave", clear, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      // Edit mode disabled / unmount → drop any stale highlight.
      hoveredRef.current = null;
      setBox(null);
    };
  }, [enabled, select]);

  if (!enabled || !box) return null;

  return (
    <div
      ref={boxRef}
      className="ed-highlight"
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      }}
    >
      <span className="ed-highlight-label">{box.name}</span>
    </div>
  );
}
