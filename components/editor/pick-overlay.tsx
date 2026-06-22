"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor } from "@/components/editor/editor-provider";
import { useHoverRect, type HoverMatch } from "@/lib/editor/use-hover-rect";
import { useProbeIndex } from "@/lib/editor/use-probe-index";
import { resolveMatches, type Match } from "@/lib/editor/resolve-token";
import { PickMenu } from "@/components/editor/pick-menu";

/** Elements that are the editor's own chrome — never pickable. */
const CHROME = ".ed-panel, .ed-toggle, .ed-pick-menu, .ed-highlight, .ed-pick-highlight";

export function PickOverlay() {
  const { enabled, pickMode, select, togglePickMode } = useEditor();
  const active = enabled && pickMode;
  const { buildIndex, readElementValues } = useProbeIndex();
  const [popover, setPopover] = useState<{ anchor: { x: number; y: number }; matches: Match[] } | null>(null);

  const match = useCallback((target: EventTarget | null): HoverMatch<HTMLElement> | null => {
    if (!(target instanceof HTMLElement)) return null;
    if (target.closest(CHROME)) return null;
    return { el: target, payload: target };
  }, []);

  const onPick = useCallback(
    (el: HTMLElement, e: MouseEvent) => {
      const index = buildIndex();
      const matches = resolveMatches(readElementValues(el), index);
      setPopover({ anchor: { x: e.clientX, y: e.clientY }, matches });
    },
    [buildIndex, readElementValues],
  );

  // Hover highlight is suspended while the popover is open.
  const { box, boxRef } = useHoverRect<HTMLElement>({
    active: active && !popover,
    match,
    onPick,
    onScroll: "dismiss",
  });

  // Suppress native activation + focus-steal while picking (capture phase). Pick resolves on click (in the hook).
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const inChrome = (t: EventTarget | null) => t instanceof Element && !!t.closest(CHROME);
    const stopPointer = (e: Event) => { if (inChrome(e.target)) return; e.preventDefault(); e.stopPropagation(); };
    const stopKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { if (inChrome(e.target)) return; e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener("pointerdown", stopPointer, true);
    document.addEventListener("keydown", stopKey, true);
    return () => {
      document.removeEventListener("pointerdown", stopPointer, true);
      document.removeEventListener("keydown", stopKey, true);
    };
  }, [active]);

  // Layered Escape: close popover first, else exit pick mode.
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      if (popover) setPopover(null);
      else togglePickMode();
    };
    document.addEventListener("keydown", onEsc, true);
    return () => document.removeEventListener("keydown", onEsc, true);
  }, [active, popover, togglePickMode]);

  // Crosshair cursor while picking.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = active ? "crosshair" : "";
    return () => { document.body.style.cursor = ""; };
  }, [active]);

  const onPickToken = useCallback(
    (token: string) => {
      select(token);
      setPopover(null);
      togglePickMode(); // auto-exit so the next move doesn't re-arm over the element you're now previewing
    },
    [select, togglePickMode],
  );

  if (!active) return null;
  return (
    <>
      {box && !popover && (
        <div
          ref={boxRef}
          className="ed-pick-highlight"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      {popover && (
        <PickMenu
          anchor={popover.anchor}
          matches={popover.matches}
          onPickToken={onPickToken}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}
