"use client";

interface DurationSliderProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

type DurationUnit = "ms" | "s";
const UNITS: DurationUnit[] = ["ms", "s"];
const RANGE: Record<DurationUnit, { max: number; step: number }> = {
  ms: { max: 2000, step: 10 },
  s: { max: 2, step: 0.05 },
};

const PARSE = /^(\d*\.?\d+)(ms|s)$/;

function parseDuration(value: string): { n: number; unit: DurationUnit } {
  const m = PARSE.exec(value.trim());
  if (m) return { n: Number(m[1]), unit: m[2] as DurationUnit };
  const n = Number.parseFloat(value);
  return { n: Number.isFinite(n) ? n : 0, unit: "ms" };
}

/** Numeric field + slider + unit select (ms default, s allowed) for duration tokens. */
export function DurationSlider({ token, value, onChange }: DurationSliderProps) {
  const { n, unit } = parseDuration(value);
  const range = RANGE[unit];

  const emit = (nextN: number, nextUnit: DurationUnit) => {
    const num = Number.isFinite(nextN) && nextN >= 0 ? nextN : 0;
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
          min={0}
          step={range.step}
          value={n}
          onChange={(e) => emit(Number(e.target.value), unit)}
        />
        <select
          className="ed-unit"
          aria-label={`${token} unit`}
          value={unit}
          onChange={(e) => emit(n, e.target.value as DurationUnit)}
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
