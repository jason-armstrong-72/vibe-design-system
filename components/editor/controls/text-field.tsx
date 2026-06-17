"use client";

import { useState } from "react";

interface TextFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
}

// Mirrors the server-side injection screen for nicer UX (the route validates again).
const INJECTION = /[;{}]|\/\*|\*\//;

/** Validated free-text input for shadow strings / font stacks. Emits the raw (non-empty) string. */
export function TextField({ token, value, onChange }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  // Keep the draft in sync if the upstream value changes (adjust-state-during-render pattern).
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const onInput = (raw: string) => {
    setDraft(raw);
    const v = raw.trim();
    if (v.length > 0 && !INJECTION.test(v)) onChange(raw);
  };

  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {token}
      </span>
      <input
        type="text"
        aria-label={`${token} value`}
        value={draft}
        onChange={(e) => onInput(e.target.value)}
      />
    </div>
  );
}
