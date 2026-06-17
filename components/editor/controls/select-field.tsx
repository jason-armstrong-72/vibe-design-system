"use client";

import type { ManifestToken } from "@/lib/tokens/generate";
import type { TokenGroup } from "@/lib/tokens/types";

interface SelectFieldProps {
  token: string;
  /** The token's group — drives the option set (fontWeight vs fontFamily). */
  group: TokenGroup;
  value: string;
  onChange: (value: string) => void;
  /** The manifest tokens — used to seed fontFamily options from the bundled stacks. */
  tokens: ManifestToken[];
}

const WEIGHTS = ["100", "200", "300", "400", "500", "600", "700", "800", "900"];

/** A token's effective value (light wins, then dark). */
function tokenValue(t: ManifestToken): string {
  return t.values.light ?? t.values.dark ?? "";
}

/** Dropdown control for fontWeight (100..900) and fontFamily (current + manifest stacks). */
export function SelectField({ token, group, value, onChange, tokens }: SelectFieldProps) {
  let options: string[];
  if (group === "fontWeight") {
    options = WEIGHTS.includes(value) ? WEIGHTS : [value, ...WEIGHTS];
  } else {
    // fontFamily: current value + every distinct font stack in the manifest.
    const stacks = tokens
      .filter((t) => t.group === "fontFamily")
      .map(tokenValue)
      .filter((v) => v.length > 0);
    options = Array.from(new Set([value, ...stacks])).filter((v) => v.length > 0);
  }

  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {token}
      </span>
      <select
        aria-label={`${token} value`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
