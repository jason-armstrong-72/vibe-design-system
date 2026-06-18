"use client";

import { useCallback, useState } from "react";
import { pinScroll } from "@/lib/editor/pin-scroll";

/**
 * Shared behaviour for the editor's TYPED text/number inputs (Bug 1 + Bug 2).
 *
 * Bug 1 — commit on blur/Enter, not per keystroke:
 *   The field holds a LOCAL draft (seeded from the current `value`). Typing only updates
 *   the draft; it calls `commit` (which persists via the provider's debounced writeback)
 *   ONLY on blur and on Enter — and only when `validate(draft)` accepts the draft. Escape
 *   reverts the draft to the current value. Sliders keep their live behaviour; this hook is
 *   for typed fields only.
 *
 * Re-seeding: when the upstream `value` changes from outside (block switch, reset, undo,
 *   sibling promotion) the draft re-seeds to the new value via React's documented
 *   "adjust state while rendering" pattern (the same one color-oklch already uses), so we
 *   avoid an effect + extra render.
 *
 * Bug 2 — no scroll jump on blur:
 *   Leaving a panel field with Tab moves focus to the next element in DOM tab order. The
 *   editor panel is mounted LAST in the document, so Tab-forward out of a field wraps to the
 *   page's first focusable — which on the design-system page sits far down — and the browser
 *   scrolls it into view, yanking the page to the bottom. We neutralise that by snapshotting
 *   the document scroll position on blur and restoring it on the next frame, so committing /
 *   leaving a field never moves the page.
 */

export interface DraftField {
  /** Current draft string to bind to the input's `value`. */
  draft: string;
  /** `onChange` for the input — updates the local draft only (no persist). */
  onChange: (e: { target: { value: string } }) => void;
  /** `onBlur` for the input — commits (if valid) and pins the scroll position. */
  onBlur: () => void;
  /** `onKeyDown` for the input — Enter commits, Escape reverts. */
  onKeyDown: (e: { key: string; currentTarget: { blur: () => void } }) => void;
}

/**
 * @param value    The current (upstream) value for the field.
 * @param commit   Called with a validator-passing string on blur/Enter.
 * @param validate Returns true if `draft` is safe + well-shaped for this group.
 */
export function useDraftField(
  value: string,
  commit: (next: string) => void,
  validate: (draft: string) => boolean,
): DraftField {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  // Re-seed the draft when the upstream value changes (adjust-state-during-render).
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const onChange = useCallback(
    (e: { target: { value: string } }) => setDraft(e.target.value),
    [],
  );

  const doCommit = useCallback(() => {
    if (validate(draft)) commit(draft);
  }, [draft, validate, commit]);

  const onBlur = useCallback(() => {
    pinScroll();
    doCommit();
  }, [doCommit]);

  const onKeyDown = useCallback(
    (e: { key: string; currentTarget: { blur: () => void } }) => {
      if (e.key === "Enter") {
        pinScroll();
        doCommit();
        // Blur so a subsequent Tab/click doesn't double-commit; also matches "press Enter to apply".
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        setDraft(value);
        e.currentTarget.blur();
      }
    },
    [doCommit, value],
  );

  return { draft, onChange, onBlur, onKeyDown };
}
