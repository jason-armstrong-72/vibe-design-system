"use client";

interface NumberFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

/** Labelled number input for unitless numeric tokens (e.g. zIndex). */
export function NumberField({ token, value, onChange }: NumberFieldProps) {
  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {token}
      </span>
      <input
        type="number"
        aria-label={`${token} value`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
