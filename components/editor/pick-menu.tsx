"use client";

import { useEffect, useRef } from "react";
import type { Match } from "@/lib/editor/resolve-token";

const PROP_LABEL: Record<string, string> = {
  "background-color": "background",
  color: "text colour",
  "border-radius": "border radius",
  "font-size": "font size",
  "font-family": "font family",
  "box-shadow": "box shadow",
};

const PANEL_WIDTH = 312;
const MENU_WIDTH = 400;

interface Row { property: string; token: string; value: string; isColor: boolean; }

export function PickMenu({
  anchor, matches, onPickToken,
}: {
  anchor: { x: number; y: number };
  matches: Match[];
  onPickToken: (token: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rows: Row[] = matches.flatMap((m) =>
    m.tokens.map((token) => ({
      property: m.property,
      token,
      value: m.value,
      isColor: m.property === "background-color" || m.property === "color",
    })),
  );

  // focus the first item on open (a11y: move focus into the menu)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);

  // clamp to viewport, accounting for the docked panel on the right.
  const maxLeft = (typeof window !== "undefined" ? window.innerWidth : 1024) - PANEL_WIDTH - MENU_WIDTH - 8;
  const left = Math.max(8, Math.min(anchor.x, maxLeft));
  const top = Math.max(8, anchor.y);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(i + 1, items.length - 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(i - 1, 0)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
    // Escape handled by pick-overlay (layered exit).
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Tokens for this element"
      className="ed-pick-menu"
      style={{ top, left }}
      onKeyDown={onKeyDown}
    >
      {rows.length === 0 ? (
        <p className="ed-pick-empty">No matching design token for this element</p>
      ) : (
        rows.map((r, i) => (
          <button
            key={`${r.property}-${r.token}-${i}`}
            type="button"
            role="menuitem"
            className="ed-pick-row"
            onClick={() => onPickToken(r.token)}
          >
            <span className="ed-pick-prop">{PROP_LABEL[r.property] ?? r.property}</span>
            <span
              className="ed-pick-swatch"
              data-empty={r.isColor ? undefined : ""}
              style={r.isColor ? { background: r.value } : undefined}
              aria-hidden="true"
            />
            <span className="ed-pick-token">{r.token}</span>
          </button>
        ))
      )}
    </div>
  );
}
