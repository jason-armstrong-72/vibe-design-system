import { useMemo } from "react";
import type { Theme } from "@/lib/tokens/types";

export type EditStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface WritebackEdit {
  name: string;
  value: string;
  theme: Theme;
}

interface WritebackOpts {
  debounceMs: number;
  /** Apply a CSS var for instant preview (document.documentElement.style.setProperty in the hook). */
  setVar: (name: string, value: string) => void;
  /** Remove an inline preview var (document.documentElement.style.removeProperty in the hook). */
  clearVar: (name: string) => void;
  /** Report per-token status transitions to the provider. */
  onStatus: (name: string, status: EditStatus, error?: string) => void;
  /** Override for tests; defaults to the real endpoint. */
  endpoint?: string;
}

/**
 * Per-token debounced writeback with optimistic preview + rollback.
 * - edit(): apply preview immediately (setVar), (re)arm THIS token's debounce timer. Repeated edits
 *   to the same token coalesce (last-write-wins); edits to different tokens never coalesce.
 * - on fire: POST /api/ds/token. ok → record last-known-good + status 'saved'. !ok → revert the
 *   preview to last-known-good (setVar) + status 'error'.
 * - seed(): record the last-persisted value for a token (so rollback has a target).
 */
export class WritebackQueue {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, WritebackEdit>();
  private lastGood = new Map<string, string>();
  /** Names of vars we've applied inline for preview, so clearPreviews() can remove exactly those. */
  private applied = new Set<string>();
  private readonly endpoint: string;

  constructor(private opts: WritebackOpts) {
    this.endpoint = opts.endpoint ?? "/api/ds/token";
  }

  seed(name: string, value: string): void {
    this.lastGood.set(name, value);
  }

  /**
   * Remove every inline preview var we applied. Used when switching the editing block: an inline
   * var on documentElement wins over BOTH :root and .dark, so stale previews would leak the wrong
   * value across blocks. Clearing them lets the page fall back to the file's :root/.dark value.
   */
  clearPreviews(): void {
    for (const name of this.applied) this.opts.clearVar(name);
    this.applied.clear();
  }

  edit(edit: WritebackEdit): void {
    this.opts.setVar(edit.name, edit.value); // optimistic preview, immediate
    this.applied.add(edit.name);
    this.opts.onStatus(edit.name, "dirty");
    this.pending.set(edit.name, edit);
    const existing = this.timers.get(edit.name);
    if (existing) clearTimeout(existing);
    this.timers.set(
      edit.name,
      setTimeout(() => void this.flush(edit.name), this.opts.debounceMs),
    );
  }

  private async flush(name: string): Promise<void> {
    this.timers.delete(name);
    const edit = this.pending.get(name);
    if (!edit) return;
    this.pending.delete(name);
    this.opts.onStatus(name, "saving");
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: edit.name, value: edit.value, theme: edit.theme }),
      });
      if (!res.ok) {
        let msg = `write failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        this.rollback(name, msg);
        return;
      }
      this.lastGood.set(name, edit.value);
      this.opts.onStatus(name, "saved");
    } catch (e) {
      this.rollback(name, (e as Error).message);
    }
  }

  private rollback(name: string, error: string): void {
    const good = this.lastGood.get(name);
    if (good !== undefined) this.opts.setVar(name, good);
    this.opts.onStatus(name, "error", error);
  }
}

/** React hook: a WritebackQueue whose setVar writes the CSS var on the document root for live preview. */
export function useTokenWriteback(
  onStatus: (name: string, status: EditStatus, error?: string) => void,
  debounceMs = 250,
): WritebackQueue {
  return useMemo(
    () =>
      new WritebackQueue({
        debounceMs,
        setVar: (name, value) => document.documentElement.style.setProperty(name, value),
        clearVar: (name) => document.documentElement.style.removeProperty(name),
        onStatus,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
