"use client";

import { useDraftField } from "@/lib/editor/use-draft-field";

interface NumberFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

/** A zIndex token is any integer. */
const isInteger = (v: string) => {
  const n = Number(v.trim());
  return v.trim().length > 0 && Number.isInteger(n);
};

/**
 * Labelled number input for unitless numeric tokens (e.g. zIndex). Typed-field semantics:
 * holds a local draft and commits (validator-passing) only on blur / Enter — never per keystroke.
 */
export function NumberField({ token, value, onChange }: NumberFieldProps) {
  const field = useDraftField(value, onChange, isInteger);
  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {token}
      </span>
      <input
        type="number"
        aria-label={`${token} value`}
        value={field.draft}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
    </div>
  );
}
