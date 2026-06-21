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
  private timers = new Map<string, ReturnType<typeof setTimeout>>(); // keyed by name|theme
  private pending = new Map<string, WritebackEdit>(); // keyed by name|theme
  private lastGood = new Map<string, string>(); // keyed by name|theme (per-block rollback target)
  /** Names of inline preview vars — keyed by NAME (the DOM var is global per name; one block shown). */
  private applied = new Set<string>();
  private readonly endpoint: string;

  constructor(private opts: WritebackOpts) {
    this.endpoint = opts.endpoint ?? "/api/ds/token";
  }

  /** Composite persist key — same idiom as the provider's committedRef Map<"name|theme", value>. */
  private key(name: string, theme: Theme): string {
    return `${name}|${theme}`;
  }

  seed(name: string, theme: Theme, value: string): void {
    this.lastGood.set(this.key(name, theme), value);
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
    this.opts.setVar(edit.name, edit.value); // optimistic preview, immediate (name-keyed DOM var)
    this.applied.add(edit.name);
    this.opts.onStatus(edit.name, "dirty");
    const k = this.key(edit.name, edit.theme);
    this.pending.set(k, edit);
    const existing = this.timers.get(k);
    if (existing) clearTimeout(existing);
    this.timers.set(k, setTimeout(() => void this.flush(k), this.opts.debounceMs));
  }

  private async flush(k: string): Promise<void> {
    this.timers.delete(k);
    const edit = this.pending.get(k);
    if (!edit) return;
    this.pending.delete(k);
    this.opts.onStatus(edit.name, "saving");
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
        this.rollback(edit, msg);
        return;
      }
      this.lastGood.set(k, edit.value);
      this.opts.onStatus(edit.name, "saved");
    } catch (e) {
      this.rollback(edit, (e as Error).message);
    }
  }

  private rollback(edit: WritebackEdit, error: string): void {
    const good = this.lastGood.get(this.key(edit.name, edit.theme));
    if (good !== undefined) {
      this.opts.setVar(edit.name, good);
      this.applied.add(edit.name); // re-arm: a block switch may have emptied applied; keep it reclaimable
    }
    this.opts.onStatus(edit.name, "error", error);
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
