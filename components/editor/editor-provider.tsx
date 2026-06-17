"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import designSystem from "@/design-system.json";
import type { Manifest, ManifestToken } from "@/lib/tokens/generate";
import type { Theme } from "@/lib/tokens/types";
import {
  useTokenWriteback,
  type EditStatus,
} from "@/lib/editor/use-token-writeback";

export type PanelAppearance = "dark" | "light";

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
  const [panelAppearance, setPanelAppearanceState] =
    useState<PanelAppearance>("dark");
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
      setPerToken((prev) => {
        const existing = prev[name];
        if (!existing) return prev;
        queue.edit({ name, value: existing.original, theme: editingBlock });
        return {
          ...prev,
          [name]: { ...existing, current: existing.original, status: "dirty" },
        };
      });
    },
    [editingBlock, queue],
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
