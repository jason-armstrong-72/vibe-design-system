"use client";

interface LengthSliderProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

type LengthUnit = "rem" | "px" | "em" | "%";
const UNITS: LengthUnit[] = ["rem", "px", "em", "%"];

// Per-unit slider bounds — pragmatic ranges that cover the design-system's lengths.
const RANGE: Record<LengthUnit, { max: number; step: number }> = {
  rem: { max: 64, step: 0.0625 },
  px: { max: 200, step: 1 },
  em: { max: 8, step: 0.0625 },
  "%": { max: 100, step: 1 },
};

const PARSE = /^(-?\d*\.?\d+)(rem|px|em|%)$/;

/** Split a stored length into number + unit; defaults to rem when unrecognised (e.g. calc()/var()). */
function parseLength(value: string): { n: number; unit: LengthUnit } {
  const m = PARSE.exec(value.trim());
  if (m) return { n: Number(m[1]), unit: m[2] as LengthUnit };
  const n = Number.parseFloat(value);
  return { n: Number.isFinite(n) ? n : 0, unit: "rem" };
}

/**
 * Numeric field + slider + unit select for length tokens (fontSize/lineHeight/radius/
 * borderWidth/spacing/container). Emits validator-passing `${n}${unit}` strings.
 */
export function LengthSlider({ token, value, onChange }: LengthSliderProps) {
  const { n, unit } = parseLength(value);
  const range = RANGE[unit];

  const emit = (nextN: number, nextUnit: LengthUnit) => {
    const num = Number.isFinite(nextN) ? nextN : 0;
    onChange(`${num}${nextUnit}`);
  };

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
          max={range.max}
          step={range.step}
          value={Math.min(Math.max(n, 0), range.max)}
          onChange={(e) => emit(Number(e.target.value), unit)}
        />
      </div>
      <div className="ed-row">
        <input
          type="number"
          aria-label={`${token} value`}
          step={range.step}
          value={n}
          onChange={(e) => emit(Number(e.target.value), unit)}
        />
        <select
          className="ed-unit"
          aria-label={`${token} unit`}
          value={unit}
          onChange={(e) => emit(n, e.target.value as LengthUnit)}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
