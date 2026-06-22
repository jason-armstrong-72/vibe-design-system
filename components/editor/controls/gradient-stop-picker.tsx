"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import { stopColor, type Stop } from "@/lib/editor/gradient";

interface Props {
  stop: Stop;
  tokens: ManifestToken[];
  onChange: (s: Stop) => void;
  label: string; // e.g. "stop 1" — for accessible names
}

const swatchValue = (t: ManifestToken) => t.values.light ?? t.values.dark ?? "";

/**
 * Compact stop color control: a single current-color chip that opens a token-grid popover (emits the
 * token NAME, so the gradient themes) + a `transparent` option, plus an inline alpha slider.
 * NOT a reuse of color-oklch (no alpha there; its strip emits resolved literals).
 */
export function GradientStopPicker({ stop, tokens, onChange, label }: Props) {
  const colors = tokens.filter((t) => t.group === "color");
  const isTransparent = stop.color === "transparent";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close the popover on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (s: Stop) => { onChange(s); setOpen(false); };

  return (
    <div className="ed-gradient-stop" ref={ref}>
      <button
        type="button"
        className="ed-gradient-swatch ed-gradient-trigger"
        aria-label={`${label} color`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-checker={isTransparent ? "" : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {!isTransparent && (
          <span className="ed-gradient-swatch-fill" style={{ background: stopColor(stop) }} aria-hidden="true" />
        )}
      </button>

      <input
        type="range"
        className="ed-gradient-alpha-range"
        aria-label={`${label} alpha`}
        min={0}
        max={100}
        step={1}
        value={stop.alpha}
        disabled={isTransparent}
        onChange={(e) => onChange({ ...stop, alpha: Number(e.target.value) })}
      />
      <span className="ed-gradient-alpha-val" aria-hidden="true">{isTransparent ? "—" : `${stop.alpha}%`}</span>

      {open && (
        <div className="ed-gradient-pop" role="menu" aria-label={`${label} color tokens`}>
          <div className="ed-gradient-swatches">
            {colors.map((t) => (
              <button
                key={t.name}
                type="button"
                role="menuitemradio"
                aria-checked={stop.color === t.name}
                className="ed-gradient-swatch"
                aria-label={t.name}
                data-selected={stop.color === t.name ? "" : undefined}
                onClick={() => pick({ color: t.name, alpha: isTransparent ? 100 : stop.alpha, position: stop.position })}
              >
                <span className="ed-gradient-swatch-fill" style={{ background: swatchValue(t) }} aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={isTransparent}
              className="ed-gradient-swatch ed-gradient-swatch-transparent"
              aria-label={`${label} transparent`}
              data-selected={isTransparent ? "" : undefined}
              onClick={() => pick({ color: "transparent", alpha: 0, position: stop.position })}
            >
              <span className="ed-gradient-swatch-fill" data-checker="" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
