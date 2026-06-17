"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  reset: (name: string) => void;
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

  const editValue = useCallback(
    (name: string, value: string) => {
      queue.edit({ name, value, theme: editingBlock });
      setPerToken((prev) => {
        const existing = prev[name];
        const original = existing?.original ?? value;
        return {
          ...prev,
          [name]: {
            original,
            current: value,
            status: "dirty",
            error: undefined,
          },
        };
      });
    },
    [editingBlock, queue],
  );

  const reset = useCallback(
    (name: string) => {
      const existing = perToken[name];
      if (!existing) return;
      const { original } = existing;
      // Persist the revert: setVar(name, original) (inside edit) + queue a write so the file
      // reverts too. queue.edit() synchronously flips status to 'dirty' via onStatus; we then
      // pin it back to 'idle' so the reset reads as "back to the original, nothing pending".
      // On the queue's successful write it will transition to 'saved'.
      queue.edit({ name, value: original, theme: editingBlock });
      setPerToken((prev) => {
        const cur = prev[name];
        if (!cur) return prev;
        return {
          ...prev,
          [name]: {
            ...cur,
            current: original,
            status: "idle",
            error: undefined,
          },
        };
      });
    },
    [editingBlock, queue, perToken],
  );

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
      reset,
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
      reset,
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
