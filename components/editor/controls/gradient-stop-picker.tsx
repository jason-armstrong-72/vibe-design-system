"use client";

import type { ManifestToken } from "@/lib/tokens/generate";
import type { Stop } from "@/lib/editor/gradient";

interface Props {
  stop: Stop;
  tokens: ManifestToken[];
  onChange: (s: Stop) => void;
  label: string; // e.g. "stop 1" — for accessible names
}

const swatchValue = (t: ManifestToken) => t.values.light ?? t.values.dark ?? "";

/**
 * Purpose-built stop color picker: a grid of color-token swatches (emits the token NAME, so the
 * gradient themes), a `transparent` chip, and an alpha slider (0–100, disabled when transparent).
 * NOT a reuse of color-oklch (no alpha there; its strip emits resolved literals).
 */
export function GradientStopPicker({ stop, tokens, onChange, label }: Props) {
  const colors = tokens.filter((t) => t.group === "color");
  const isTransparent = stop.color === "transparent";

  return (
    <div className="ed-gradient-stop">
      <div className="ed-gradient-swatches" role="group" aria-label={`${label} color`}>
        {colors.map((t) => (
          <button
            key={t.name}
            type="button"
            className="ed-gradient-swatch"
            aria-label={t.name}
            aria-pressed={stop.color === t.name}
            data-selected={stop.color === t.name ? "" : undefined}
            onClick={() =>
              onChange({ color: t.name, alpha: isTransparent ? 100 : stop.alpha, position: stop.position })
            }
          >
            <span className="ed-gradient-swatch-fill" style={{ background: swatchValue(t) }} aria-hidden="true" />
          </button>
        ))}
        <button
          type="button"
          className="ed-gradient-swatch ed-gradient-swatch-transparent"
          aria-label={`${label} transparent`}
          aria-pressed={isTransparent}
          data-selected={isTransparent ? "" : undefined}
          onClick={() => onChange({ color: "transparent", alpha: 0, position: stop.position })}
        >
          <span className="ed-gradient-swatch-fill" data-checker="" aria-hidden="true" />
        </button>
      </div>
      <div className="ed-gradient-alpha">
        <input
          type="range"
          aria-label={`${label} alpha`}
          min={0}
          max={100}
          step={1}
          value={stop.alpha}
          disabled={isTransparent}
          onChange={(e) => onChange({ ...stop, alpha: Number(e.target.value) })}
        />
        <span className="ed-gradient-alpha-val" aria-hidden="true">
          {isTransparent ? "—" : `${stop.alpha}%`}
        </span>
      </div>
    </div>
  );
}
