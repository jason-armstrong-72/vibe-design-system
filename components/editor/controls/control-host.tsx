"use client";

import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { controlKindForGroup } from "@/lib/editor/control-map";
import { useEditor } from "@/components/editor/editor-provider";
import { NumberField } from "@/components/editor/controls/number-field";

const MANIFEST = designSystem as Manifest;

/**
 * Resolves the control component for the selected token's group.
 * Task 5 wires only the `number` control; every other kind renders a stub.
 */
export function ControlHost() {
  const { selectedToken, editingBlock, perToken, editValue } = useEditor();
  if (!selectedToken) return null;

  const token = MANIFEST.tokens.find((t) => t.name === selectedToken);
  if (!token) return <p className="ed-stub">Unknown token.</p>;

  const state = perToken[selectedToken];
  const value =
    state?.current ??
    token.values[editingBlock] ??
    token.values.light ??
    token.values.dark ??
    "";

  const kind = controlKindForGroup(token.group);

  switch (kind) {
    case "number":
      return (
        <NumberField
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
        />
      );
    default:
      return <p className="ed-stub">{kind} control coming soon</p>;
  }
}
