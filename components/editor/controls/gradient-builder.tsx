"use client";

import { useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import { parseGradient, formatGradient, type Gradient } from "@/lib/editor/gradient";
import { useDraftField } from "@/lib/editor/use-draft-field";

const RAW_VALID = /^((linear|radial|conic)-gradient\(.+\)|var\(--[\w-]+\))$/;
const FALLBACK: Gradient = {
  type: "linear",
  angle: 180,
  stops: [
    { color: "--foreground", alpha: 100, position: 0 },
    { color: "transparent", alpha: 0, position: 100 },
  ],
};

interface Props {
  token: string;
  value: string;
  onChange: (v: string) => void;
  tokens: ManifestToken[];
}

export function GradientBuilder({ token, value, onChange, tokens }: Props) {
  const parsed = parseGradient(value);
  const [drag, setDrag] = useState<Gradient | null>(null);
  const display: Gradient = drag ?? parsed ?? FALLBACK;
  const editable = parsed !== null; // unparseable → builder dimmed, raw row authoritative
  void tokens; // consumed by stops/geometry (Tasks 5–6)
  void setDrag; // used by drag gestures (Tasks 5–6)

  const emit = (g: Gradient) => onChange(formatGradient(g));
  const raw = useDraftField(value, (v) => onChange(v), (v) => RAW_VALID.test(v.trim()));

  const setType = (type: Gradient["type"]) => {
    if (type === display.type) return;
    emit(
      type === "linear"
        ? { type: "linear", angle: 180, stops: display.stops }
        : { type: "radial", shape: "circle", cx: 50, cy: 50, stops: display.stops },
    );
  };

  return (
    <div className="ed-gradient" data-editable={editable}>
      <div className="ed-gradient-preview" style={{ background: value }} aria-hidden="true" />

      <div className="ed-gradient-types" role="radiogroup" aria-label={`${token} gradient type`}>
        {(["linear", "radial"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={display.type === t}
            className="ed-gradient-type"
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Geometry + Stops slots — filled in Tasks 5–6 */}

      {!editable && (
        <p className="ed-gradient-fallback">Can’t edit this gradient visually — editing the raw value.</p>
      )}

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          raw
        </span>
        <input
          type="text"
          aria-label={`${token} raw value`}
          value={raw.draft}
          onChange={raw.onChange}
          onBlur={raw.onBlur}
          onKeyDown={raw.onKeyDown}
        />
      </div>
    </div>
  );
}
