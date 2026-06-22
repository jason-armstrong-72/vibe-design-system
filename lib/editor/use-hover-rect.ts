"use client";
import { useEffect, useRef, useState } from "react";

export interface HoverBox { top: number; left: number; width: number; height: number; label: string | null; }

export interface HoverMatch<M> { el: HTMLElement; payload: M; }

export interface UseHoverRectOpts<M> {
  active: boolean;
  /** Return the matched element + payload, or null to ignore the target. */
  match: (target: EventTarget | null) => HoverMatch<M> | null;
  /** Called on a capture-phase click of a matched element (default-prevented + propagation-stopped). */
  onPick: (payload: M, e: MouseEvent) => void;
  /** On scroll/resize: reposition the box (default) or dismiss the hover (pick mode). */
  onScroll?: "reposition" | "dismiss";
  /** Optional label rendered on the box (highlight shows the token name; pick omits). */
  label?: (payload: M) => string | null;
}

/**
 * Shared hover-outline logic for the editor overlays: tracks the hovered element, exposes a fixed-position
 * box (with optional label), keeps it glued on scroll (imperative boxRef write — no React lag), and fires
 * onPick on a capture-phase click. Extracted from highlight-overlay so pick-overlay reuses it verbatim.
 */
export function useHoverRect<M>({ active, match, onPick, onScroll = "reposition", label }: UseHoverRectOpts<M>) {
  const [box, setBox] = useState<HoverBox | null>(null);
  const hovered = useRef<HoverMatch<M> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Keep the callbacks in refs so the listener effect depends only on [active, onScroll] — callers may
  // pass inline fns; without this, every render would re-run the effect and its cleanup would clear the box.
  const matchRef = useRef(match);
  const onPickRef = useRef(onPick);
  const labelRef = useRef(label);
  matchRef.current = match;
  onPickRef.current = onPick;
  labelRef.current = label;

  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const reposition = () => {
      const c = hovered.current;
      if (!c) { setBox(null); return; }
      const r = c.el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height, label: labelRef.current ? labelRef.current(c.payload) : null });
    };
    const clear = () => { hovered.current = null; setBox(null); };
    const onMove = (e: PointerEvent) => {
      const m = matchRef.current(e.target);
      if (!m) { clear(); return; }
      hovered.current = m;
      reposition();
    };
    const onScrollOrResize = () => {
      const c = hovered.current;
      if (!c) return;
      if (onScroll === "dismiss") { clear(); return; }
      const node = boxRef.current;
      if (!node) return;
      const r = c.el.getBoundingClientRect();
      node.style.top = `${r.top}px`;
      node.style.left = `${r.left}px`;
      node.style.width = `${r.width}px`;
      node.style.height = `${r.height}px`;
    };
    const onClick = (e: MouseEvent) => {
      const m = matchRef.current(e.target);
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      onPickRef.current(m.payload, e);
    };

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerleave", clear, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerleave", clear, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
      hovered.current = null;
      setBox(null);
    };
  }, [active, onScroll]);

  return { box, boxRef };
}
