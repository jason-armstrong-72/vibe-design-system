"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import { layerColorCss, type Layer } from "@/lib/editor/shadow";

interface Props {
  color: string;          // "black" | "--name"
  alpha: number;          // 0–100
  tokens: ManifestToken[];
  onChange: (next: { color: string; alpha: number }) => void;
  label: string;          // e.g. "layer 1" — for accessible names
}

const swatchValue = (t: ManifestToken) => t.values.light ?? t.values.dark ?? "";
const asLayer = (color: string, alpha: number): Layer =>
  ({ inset: false, x: 0, y: 0, blur: 0, spread: 0, color, alpha }); // for layerColorCss swatch render

/**
 * Compact shadow-layer color control: a current-color chip opening a popover with the token grid
 * (emits the token NAME, so a tinted glow themes), a `black` sentinel chip (renders oklch(0 0 0 / a)),
 * AND the alpha slider. A purpose-built sibling of GradientStopPicker (its sentinel is `transparent`;
 * ours is `black`). NOT a reuse of color-oklch (no alpha; its strip emits resolved literals).
 */
export function ShadowColorPicker({ color, alpha, tokens, onChange, label }: Props) {
  const colors = tokens.filter((t) => t.group === "color");
  const isBlack = color === "black";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close the popover on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="ed-shadow-color" ref={ref}>
      <button
        type="button"
        className="ed-shadow-swatch ed-shadow-trigger"
        aria-label={`${label} color`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ed-shadow-swatch-fill" style={{ background: layerColorCss(asLayer(color, alpha)) }} aria-hidden="true" />
      </button>

      {open && (
        <div className="ed-shadow-pop" role="menu" aria-label={`${label} color tokens`}>
          <div className="ed-shadow-swatches">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isBlack}
              className="ed-shadow-swatch"
              aria-label={`${label} black`}
              data-selected={isBlack ? "" : undefined}
              onClick={() => onChange({ color: "black", alpha: isBlack ? alpha : 100 })}
            >
              <span className="ed-shadow-swatch-fill" style={{ background: "oklch(0 0 0)" }} aria-hidden="true" />
            </button>
            {colors.map((t) => (
              <button
                key={t.name}
                type="button"
                role="menuitemradio"
                aria-checked={color === t.name}
                className="ed-shadow-swatch"
                aria-label={t.name}
                data-selected={color === t.name ? "" : undefined}
                onClick={() => onChange({ color: t.name, alpha })}
              >
                <span className="ed-shadow-swatch-fill" style={{ background: swatchValue(t) }} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="ed-shadow-alpha">
            <span className="ed-shadow-alpha-label" aria-hidden="true">alpha</span>
            <input
              type="range"
              aria-label={`${label} alpha`}
              min={0} max={100} step={1}
              value={alpha}
              onChange={(e) => onChange({ color, alpha: Number(e.target.value) })}
            />
            <span className="ed-shadow-alpha-val" aria-hidden="true">{`${alpha}%`}</span>
          </div>
        </div>
      )}
    </div>
  );
}
