"use client";

import { useDraftField } from "@/lib/editor/use-draft-field";

interface TextFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

// Mirrors the server-side injection screen for nicer UX (the route validates again).
const INJECTION = /[;{}]|\/\*|\*\//;

const isSafe = (raw: string) => {
  const v = raw.trim();
  return v.length > 0 && !INJECTION.test(v);
};

/**
 * Validated free-text input for shadow strings / font stacks. Emits the raw (non-empty) string.
 * Typed-field semantics: commits only on blur / Enter (never per keystroke).
 */
export function TextField({ token, value, onChange }: TextFieldProps) {
  const field = useDraftField(value, onChange, isSafe);

  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {token}
      </span>
      <input
        type="text"
        aria-label={`${token} value`}
        value={field.draft}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
    </div>
  );
}
