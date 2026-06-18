"use client";

import type { EditStatus } from "@/lib/editor/use-token-writeback";

const LABEL: Record<Exclude<EditStatus, "idle">, string> = {
  dirty: "Unsaved",
  saving: "Saving…",
  saved: "Saved",
  error: "Error",
};

/**
 * Presentational save-state indicator for a single token (Task 12).
 *
 * Renders the right glyph/label/colour for the writeback status the provider tracks in
 * perToken[name]. The status text lives in an aria-live="polite" region so transitions
 * (dirty -> saving -> saved, or -> error) are announced. `idle` renders a faint dot only.
 */
export function SaveState({
  status,
  error,
}: {
  status: EditStatus;
  error?: string;
}) {
  const isError = status === "error";
  return (
    <span
      className="ed-savestate"
      data-status={status}
      aria-live="polite"
    >
      <span className="ed-savestate-dot" aria-hidden="true" />
      {status !== "idle" && (
        <span className="ed-savestate-label">{LABEL[status]}</span>
      )}
      {isError && error && (
        <span className="ed-savestate-msg" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
