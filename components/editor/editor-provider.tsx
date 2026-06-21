"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import designSystem from "@/design-system.json";
import type { Manifest, ManifestToken } from "@/lib/tokens/generate";
import type { Theme } from "@/lib/tokens/types";
import {
  useTokenWriteback,
  type EditStatus,
} from "@/lib/editor/use-token-writeback";

export type PanelAppearance = "dark" | "light";

/** localStorage key for the persisted (cosmetic) editor-chrome appearance. */
const APPEARANCE_KEY = "ds-editor-appearance";

/**
 * Initial chrome appearance. SSR-safe: returns the default on the server (no window).
 * On the client, a stored value wins; otherwise default to "dark" (deterministic — we
 * deliberately don't seed from prefers-color-scheme so the default is predictable).
 */
function initialAppearance(): PanelAppearance {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(APPEARANCE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "dark";
}

export interface PerTokenState {
  original: string;
  current: string;
  status: EditStatus;
  error?: string;
}

/**
 * One committed token change. `prev` is the token+theme value *before* this commit; `next` is the
 * committed value. Stored chronologically (global history across all tokens/blocks) so undo/redo
 * walk the full edit timeline, not a per-token stack.
 */
export interface HistoryEntry {
  token: string;
  theme: Theme;
  prev: string;
  next: string;
}

export interface EditorContextValue {
  enabled: boolean;
  selectedToken: string | null;
  editingBlock: Theme;
  panelAppearance: PanelAppearance;
  perToken: Record<string, PerTokenState>;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  select: (name: string) => void;
  setEditingBlock: (block: Theme) => void;
  setPanelAppearance: (appearance: PanelAppearance) => void;
  editValue: (name: string, value: string) => void;
  /** Live committed value of any token for a block (last edit this session, else manifest). */
  committedValue: (name: string, theme: Theme) => string;
  reset: (name: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

const MANIFEST = designSystem as Manifest;

function tokenByName(name: string): ManifestToken | undefined {
  return MANIFEST.tokens.find((t) => t.name === name);
}

/** Current value of a token for the active editing block (falls back to light). */
function currentValue(name: string, block: Theme): string {
  const tok = tokenByName(name);
  if (!tok) return "";
  return tok.values[block] ?? tok.values.light ?? tok.values.dark ?? "";
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [editingBlock, setEditingBlockState] = useState<Theme>("light");
  // Lazy initializer is SSR-safe (guards window) and reads the persisted value on mount.
  const [panelAppearance, setPanelAppearanceState] =
    useState<PanelAppearance>(initialAppearance);
  const [perToken, setPerToken] = useState<Record<string, PerTokenState>>({});

  // Global, chronological history of committed edits. `undoStack` holds applied edits (top = most
  // recent); `redoStack` holds undone edits ready to re-apply. Booleans are state so the toolbar
  // re-renders; the entry arrays live in refs so synchronous undo/redo can read+mutate them without
  // racing React's batched state (and so a fresh edit can truncate redo immediately).
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  // Last committed value per `${token}|${theme}` — the baseline for the NEXT edit's `prev`. Keyed by
  // theme because the same token has independent values in the light vs dark block. Seeded lazily
  // from the manifest the first time a token+theme is edited (see committedBaseline).
  const committedRef = useRef<Map<string, string>>(new Map());
  const committedBaseline = useCallback((name: string, theme: Theme): string => {
    const key = `${name}|${theme}`;
    const known = committedRef.current.get(key);
    if (known !== undefined) return known;
    return currentValue(name, theme);
  }, []);
  const setCommitted = useCallback((name: string, theme: Theme, value: string) => {
    committedRef.current.set(`${name}|${theme}`, value);
  }, []);

  const onStatus = useCallback(
    (name: string, status: EditStatus, error?: string) => {
      setPerToken((prev) => {
        const existing = prev[name];
        if (!existing) return prev;
        return { ...prev, [name]: { ...existing, status, error } };
      });
    },
    [],
  );

  const queue = useTokenWriteback(onStatus);

  const enable = useCallback(() => setEnabled(true), []);
  const disable = useCallback(() => setEnabled(false), []);
  const toggle = useCallback(() => setEnabled((e) => !e), []);

  const setEditingBlock = useCallback(
    (block: Theme) => {
      setEditingBlockState(block);
      // Forced-dark preview: the page renders dark iff we're editing the dark block, so what
      // you see is what you're editing (globals.css keys dark off the .dark class on the root).
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", block === "dark");
      }
      // An inline preview var on the root wins over BOTH :root and .dark, so a preview applied
      // while editing one block would leak its (overriding) value into the other. Clear them so
      // the newly-active block shows the file's actual :root/.dark value...
      queue.clearPreviews();
      // ...then re-seed the currently-selected token's control + queue from the new block's value.
      if (selectedToken) {
        const value = currentValue(selectedToken, block);
        queue.seed(selectedToken, value);
        setPerToken((prev) => {
          const existing = prev[selectedToken];
          if (!existing) return prev;
          return {
            ...prev,
            [selectedToken]: {
              original: value,
              current: value,
              status: "idle",
              error: undefined,
            },
          };
        });
      }
    },
    [queue, selectedToken],
  );

  const setPanelAppearance = useCallback((appearance: PanelAppearance) => {
    setPanelAppearanceState(appearance);
    // Cosmetic-only: persist the chrome appearance. Guard SSR — only touch localStorage
    // on the client. This never affects the design-system tokens or what gets written.
    if (typeof window !== "undefined") {
      window.localStorage.setItem(APPEARANCE_KEY, appearance);
    }
  }, []);

  const select = useCallback(
    (name: string) => {
      setSelectedToken(name);
      const value = currentValue(name, editingBlock);
      queue.seed(name, value);
      setPerToken((prev) => {
        if (prev[name]) return prev;
        return {
          ...prev,
          [name]: { original: value, current: value, status: "idle" },
        };
      });
    },
    [editingBlock, queue],
  );

  /**
   * Persist a value to a token in a specific block (preview via setVar + debounced write) and
   * reflect it in `perToken`. This is the shared commit primitive — it does NOT touch history, so
   * undo/redo can reuse it to move the pointer without creating new forward history. `status` lets
   * reset pin "idle" (back to baseline, nothing pending) vs. a normal edit's "dirty".
   */
  const applyValue = useCallback(
    (name: string, theme: Theme, value: string, status: EditStatus) => {
      queue.edit({ name, value, theme });
      setCommitted(name, theme, value);
      setPerToken((prev) => {
        const existing = prev[name];
        const original = existing?.original ?? value;
        return {
          ...prev,
          [name]: {
            original,
            current: value,
            status,
            error: undefined,
          },
        };
      });
    },
    [queue, setCommitted],
  );

  const editValue = useCallback(
    (name: string, value: string) => {
      const prev = committedBaseline(name, editingBlock);
      // Skip no-ops: an unchanged value neither persists meaningfully nor earns a history step.
      if (prev === value) return;
      applyValue(name, editingBlock, value, "dirty");
      // A new committed edit extends the timeline and invalidates any redo branch (linear history).
      undoStackRef.current.push({ token: name, theme: editingBlock, prev, next: value });
      redoStackRef.current = [];
      syncHistoryFlags();
    },
    [editingBlock, applyValue, committedBaseline, syncHistoryFlags],
  );

  const reset = useCallback(
    (name: string) => {
      const existing = perToken[name];
      if (!existing) return;
      const { original } = existing;
      const prev = committedBaseline(name, editingBlock);
      // Persist the revert: setVar(name, original) (inside edit) + queue a write so the file reverts
      // too. We pin status 'idle' so the reset reads as "back to the original, nothing pending"; the
      // queue's successful write then transitions it to 'saved'.
      applyValue(name, editingBlock, original, "idle");
      // Reset is itself an undoable step (prev = current value, next = original) so it can be undone.
      // Skip the history push only if it changed nothing.
      if (prev !== original) {
        undoStackRef.current.push({
          token: name,
          theme: editingBlock,
          prev,
          next: original,
        });
        redoStackRef.current = [];
        syncHistoryFlags();
      }
    },
    [editingBlock, perToken, applyValue, committedBaseline, syncHistoryFlags],
  );

  /**
   * Undo/redo move the history pointer WITHOUT creating new forward history: they call applyValue
   * (preview + persist) directly and shuffle the entry between stacks, never going through editValue
   * (which would push a fresh entry and truncate redo). We select the affected token so the panel
   * reflects what changed; if it lives in another block, switch to that block first so the preview
   * is truthful. Both apply with status 'idle' — the change is "settled", not a pending draft.
   */
  const applyHistory = useCallback(
    (entry: HistoryEntry, value: string) => {
      if (entry.theme !== editingBlock) setEditingBlock(entry.theme);
      setSelectedToken(entry.token);
      queue.seed(entry.token, value);
      applyValue(entry.token, entry.theme, value, "idle");
    },
    [editingBlock, setEditingBlock, queue, applyValue],
  );

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(entry);
    applyHistory(entry, entry.prev);
    syncHistoryFlags();
  }, [applyHistory, syncHistoryFlags]);

  const redo = useCallback(() => {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(entry);
    applyHistory(entry, entry.next);
    syncHistoryFlags();
  }, [applyHistory, syncHistoryFlags]);

  const value = useMemo<EditorContextValue>(
    () => ({
      enabled,
      selectedToken,
      editingBlock,
      panelAppearance,
      perToken,
      enable,
      disable,
      toggle,
      select,
      setEditingBlock,
      setPanelAppearance,
      editValue,
      committedValue: committedBaseline,
      reset,
      canUndo,
      canRedo,
      undo,
      redo,
    }),
    [
      enabled,
      selectedToken,
      editingBlock,
      panelAppearance,
      perToken,
      enable,
      disable,
      toggle,
      select,
      setEditingBlock,
      setPanelAppearance,
      editValue,
      committedBaseline,
      reset,
      canUndo,
      canRedo,
      undo,
      redo,
    ],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within an EditorProvider");
  return ctx;
}
