"use client";

import { useDraftField } from "@/lib/editor/use-draft-field";
import { StepperInput } from "./stepper-input";

interface NumberFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

const isInteger = (v: string) => {
  const n = Number(v.trim());
  return v.trim().length > 0 && Number.isInteger(n);
};

export function NumberField({ token, value, onChange }: NumberFieldProps) {
  const field = useDraftField(value, onChange, isInteger);

  const handleStep = (delta: number) => {
    const n = Number(value);
    if (Number.isFinite(n)) onChange(String(n + delta));
  };

  return (
    <div className="ed-field-group">
      <span className="ed-field-title">{token}</span>
      <div className="ed-row">
        <StepperInput
          {...field}
          ariaLabel={`${token} value`}
          step={1}
          onStep={handleStep}
        />
      </div>
    </div>
  );
}
