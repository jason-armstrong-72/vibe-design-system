"use client";

import type { ManifestToken } from "@/lib/tokens/generate";
import { useDraftField } from "@/lib/editor/use-draft-field";

interface EasingFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
  /** Manifest tokens — named curve presets are seeded from the `--ease-*` tokens. */
  tokens: ManifestToken[];
}

// Validator: cubic-bezier(.+) | linear | ease | ease-in | ease-out | ease-in-out | steps(.+)
const VALID = /^(cubic-bezier\(.+\)|linear|ease|ease-in|ease-out|ease-in-out|steps\(.+\))$/;
const KEYWORDS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];

function tokenValue(t: ManifestToken): string {
  return t.values.light ?? t.values.dark ?? "";
}

const isValidEasing = (v: string) => VALID.test(v.trim());

/**
 * Preset `<select>` of named curves (seeded from the manifest's `--ease-*` tokens + CSS keywords)
 * plus a validated `cubic-bezier()` text input for custom values. Emits validator-passing easings.
 *
 * The preset select stays live; the custom TEXT input commits only on blur / Enter.
 * (A draggable curve editor is fast-follow.)
 */
export function EasingField({ token, value, onChange, tokens }: EasingFieldProps) {
  const manifestCurves = tokens
    .filter((t) => t.group === "easing")
    .map(tokenValue)
    .filter((v) => v.length > 0);
  const presets = Array.from(new Set([value, ...manifestCurves, ...KEYWORDS])).filter(
    (v) => v.length > 0,
  );

  const custom = useDraftField(
    value,
    (draft) => onChange(draft.trim()),
    isValidEasing,
  );

  return (
    <div className="ed-length">
      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          preset
        </span>
        <select
          aria-label={`${token} preset`}
          value={presets.includes(value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {presets.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          custom
        </span>
        <input
          type="text"
          aria-label={`${token} custom cubic-bezier`}
          placeholder="cubic-bezier(0.2, 0, 0, 1)"
          value={custom.draft}
          onChange={custom.onChange}
          onBlur={custom.onBlur}
          onKeyDown={custom.onKeyDown}
        />
      </div>
    </div>
  );
}
