"use client";

import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import { controlKindForGroup } from "@/lib/editor/control-map";
import { useEditor } from "@/components/editor/editor-provider";
import { NumberField } from "@/components/editor/controls/number-field";
import { ColorOklch } from "@/components/editor/controls/color-oklch";
import { LengthSlider } from "@/components/editor/controls/length-slider";
import { OpacitySlider } from "@/components/editor/controls/opacity-slider";
import { DurationSlider } from "@/components/editor/controls/duration-slider";
import { SelectField } from "@/components/editor/controls/select-field";
import { EasingField } from "@/components/editor/controls/easing-field";
import { TextField } from "@/components/editor/controls/text-field";
import { GradientBuilder } from "@/components/editor/controls/gradient-builder";

const MANIFEST = designSystem as Manifest;

/**
 * Resolves the control component for the selected token's group.
 * Every ControlKind maps to a real control (Task 10).
 */
export function ControlHost() {
  const { selectedToken, editingBlock, perToken, editValue, committedValue } = useEditor();
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
    case "color":
      return (
        <ColorOklch
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
          tokens={MANIFEST.tokens}
          editingBlock={editingBlock}
          committedValue={committedValue}
        />
      );
    case "length":
      return (
        <LengthSlider
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
        />
      );
    case "opacity":
      return (
        <OpacitySlider
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
        />
      );
    case "duration":
      return (
        <DurationSlider
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
        />
      );
    case "select":
      return (
        <SelectField
          token={token.name}
          group={token.group}
          value={value}
          onChange={(v) => editValue(token.name, v)}
          tokens={MANIFEST.tokens}
        />
      );
    case "easing":
      return (
        <EasingField
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
          tokens={MANIFEST.tokens}
        />
      );
    case "text":
      return (
        <TextField
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
        />
      );
    case "gradient":
      return (
        <GradientBuilder
          token={token.name}
          value={value}
          onChange={(v) => editValue(token.name, v)}
          tokens={MANIFEST.tokens}
          disabled={editingBlock === "dark" && token.values.dark === undefined}
        />
      );
    default: {
      const _never: never = kind;
      throw new Error(`ControlHost: unhandled control kind ${_never}`);
    }
  }
}
