"use client";

import { useDraftField } from "@/lib/editor/use-draft-field";

interface OpacitySliderProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

/** Clamp to [0,1] and trim trailing zeros so emitted strings stay tidy (e.g. "0.5"). */
function emitValue(raw: number): string {
  const clamped = Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), 1);
  return String(Number(clamped.toFixed(2)));
}

/** Valid draft: any parseable number (it gets clamped to 0..1 on commit). */
const isNumber = (v: string) => v.trim().length > 0 && Number.isFinite(Number(v.trim()));

/**
 * Slider 0..1 (step 0.01) + numeric field for opacity tokens. Emits a bare number string.
 * The slider stays live; the typed NUMERIC field commits only on blur / Enter.
 */
export function OpacitySlider({ token, value, onChange }: OpacitySliderProps) {
  const n = Number(value);
  const current = Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0;

  const numField = useDraftField(
    String(current),
    (draft) => onChange(emitValue(Number(draft))),
    isNumber,
  );

  return (
    <div className="ed-length">
      <div className="ed-slider">
        <span className="ed-label" aria-hidden="true">
          {token}
        </span>
        <input
          type="range"
          aria-label={`${token} slider`}
          min={0}
          max={1}
          step={0.01}
          value={current}
          onChange={(e) => onChange(emitValue(Number(e.target.value)))}
        />
        <span className="ed-slider-val">{current.toFixed(2)}</span>
      </div>
      <div className="ed-row">
        <input
          type="number"
          aria-label={`${token} value`}
          min={0}
          max={1}
          step={0.01}
          value={numField.draft}
          onChange={numField.onChange}
          onBlur={numField.onBlur}
          onKeyDown={numField.onKeyDown}
        />
      </div>
    </div>
  );
}
