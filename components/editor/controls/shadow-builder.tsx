"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import {
  parseShadow, formatShadow, clampBlur, offsetFromPointer, dotPercent,
  type Shadow, type Layer,
} from "@/lib/editor/shadow";
import { useDraftField } from "@/lib/editor/use-draft-field";
import { ShadowColorPicker } from "@/components/editor/controls/shadow-color-picker";

const PAD_RANGE = 32;
const FALLBACK: Shadow = [{ inset: false, x: 0, y: 4, blur: 6, spread: 0, color: "black", alpha: 10 }];
const ADD_DEFAULT: Layer = { inset: false, x: 0, y: 2, blur: 4, spread: 0, color: "black", alpha: 15 };
const isNum = (v: string) => v.trim().length > 0 && Number.isFinite(Number(v.trim()));
const RAW_VALID = (v: string) =>
  !/[;{}]|\/\*|\*\//.test(v) && /(^|[\s,])(inset|none|var\(|oklch\(|color-mix\(|-?\d*\.?\d+px?)/.test(v.trim());

interface Props {
  token: string; value: string; onChange: (v: string) => void; tokens: ManifestToken[]; disabled?: boolean;
}

/** A labelled numeric input, commit-on-blur/Enter (the keyboard path for x/y/blur/spread). */
function NumField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const f = useDraftField(String(value), (v) => onCommit(Number(v)), isNum);
  return (
    <input
      type="number"
      className="ed-shadow-num"
      aria-label={label}
      step={1}
      value={f.draft}
      onChange={f.onChange}
      onBlur={f.onBlur}
      onKeyDown={f.onKeyDown}
    />
  );
}

/** The expanded layer card: pad + numeric twins + color picker + inset toggle + remove. */
function LayerCard({
  id, n, token, layer, tokens, canRemove, onLayer, onRemove, onPadDown, dot, badge,
}: {
  id: string; n: number; token: string; layer: Layer; tokens: ManifestToken[]; canRemove: boolean;
  onLayer: (l: Layer) => void; onRemove: () => void;
  onPadDown: (e: React.PointerEvent) => void;
  dot: { left: number; top: number }; badge: { x: number; y: number } | null;
}) {
  const lbl = `${token} layer ${n}`;
  return (
    <div className="ed-shadow-card" id={id}>
      <div className="ed-shadow-cardtop">
        <div className="ed-shadow-pad" aria-hidden="true" onPointerDown={onPadDown}>
          <span className="ed-shadow-dot" style={{ left: `${dot.left}%`, top: `${dot.top}%` }} />
          {badge && <span className="ed-shadow-badge">{`x ${badge.x} · y ${badge.y}`}</span>}
        </div>
        <div className="ed-shadow-fields">
          <label className="ed-shadow-axis"><span aria-hidden="true">x</span>
            <NumField label={`${lbl} x offset`} value={layer.x} onCommit={(v) => onLayer({ ...layer, x: v })} /></label>
          <label className="ed-shadow-axis"><span aria-hidden="true">y</span>
            <NumField label={`${lbl} y offset`} value={layer.y} onCommit={(v) => onLayer({ ...layer, y: v })} /></label>
          <label className="ed-shadow-axis"><span aria-hidden="true">blur</span>
            <NumField label={`${lbl} blur`} value={layer.blur} onCommit={(v) => onLayer({ ...layer, blur: clampBlur(v) })} /></label>
          <label className="ed-shadow-axis"><span aria-hidden="true">spread</span>
            <NumField label={`${lbl} spread`} value={layer.spread} onCommit={(v) => onLayer({ ...layer, spread: v })} /></label>
        </div>
      </div>
      <div className="ed-shadow-row2">
        <ShadowColorPicker
          color={layer.color}
          alpha={layer.alpha}
          tokens={tokens}
          label={`layer ${n}`}
          onChange={({ color, alpha }) => onLayer({ ...layer, color, alpha })}
        />
        <button
          type="button"
          className="ed-shadow-inset"
          aria-pressed={layer.inset}
          aria-label={`${lbl} inset`}
          data-on={layer.inset ? "" : undefined}
          onClick={() => onLayer({ ...layer, inset: !layer.inset })}
        >
          inset
        </button>
        <button
          type="button"
          className="ed-iconbtn"
          aria-label={`Remove layer ${n}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** The collapsed one-line layer summary. */
function LayerSummaryRow({
  n, layer, cardId, canRemove, onExpand, onRemove,
}: {
  n: number; layer: Layer; cardId: string; canRemove: boolean; onExpand: () => void; onRemove: () => void;
}) {
  return (
    <div className="ed-shadow-summary">
      <button
        type="button"
        className="ed-shadow-expander"
        aria-expanded={false}
        aria-controls={cardId}
        aria-label={`Expand layer ${n}`}
        onClick={onExpand}
      >
        <span
          className="ed-shadow-summary-swatch"
          aria-hidden="true"
          style={{ background: layer.color === "black" ? "oklch(0 0 0)" : `var(${layer.color})` }}
        />
        <span className="ed-shadow-summary-text">
          {`${layer.x} ${layer.y} · blur ${layer.blur}${layer.inset ? " · inset" : ""}`}
        </span>
      </button>
      <button
        type="button"
        className="ed-iconbtn"
        aria-label={`Remove layer ${n}`}
        disabled={!canRemove}
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  );
}

export function ShadowBuilder({ token, value, onChange, tokens, disabled = false }: Props) {
  const parsed = parseShadow(value);
  const [drag, setDrag] = useState<Shadow | null>(null);
  const display: Shadow = drag ?? parsed ?? FALLBACK;
  const editable = parsed !== null; // unparseable → builder dimmed, raw row authoritative
  const [surfaceDark, setSurfaceDark] = useState(false);
  const [open, setOpen] = useState(0); // accordion open index (transient UI state)
  const [announce, setAnnounce] = useState("");
  const openIdx = Math.min(open, display.length - 1); // clamp if layer count shrank (undo/reset)

  const emit = (s: Shadow) => onChange(formatShadow(s));
  const raw = useDraftField(value, (v) => onChange(v), RAW_VALID);

  const setLayer = (i: number, l: Layer) => emit(display.map((p, j) => (j === i ? l : p)));
  const removeLayer = (i: number) => {
    if (display.length <= 1) return;
    setAnnounce(`Layer ${i + 1} removed, ${display.length - 1} remain`);
    setOpen((o) => Math.max(0, o > i ? o - 1 : o));
    emit(display.filter((_, j) => j !== i));
  };
  const addLayer = () => {
    setAnnounce(`Layer ${display.length + 1} added`);
    setOpen(display.length);
    emit([...display, { ...ADD_DEFAULT }]);
  };

  // ---- pad drag: commit once on pointer-up ----
  const padRef = useRef<HTMLDivElement | null>(null);
  const mode = useRef<{ index: number } | null>(null);
  const working = useRef<Shadow | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const m = mode.current, g = working.current;
      if (!m || !g || !padRef.current) return;
      const { x, y } = offsetFromPointer(e.clientX, e.clientY, padRef.current.getBoundingClientRect(), PAD_RANGE);
      const next = g.map((p, j) => (j === m.index ? { ...p, x, y } : p));
      working.current = next;
      setDrag(next);
    };
    const up = () => {
      if (!mode.current || !working.current) return;
      emit(working.current);
      mode.current = null;
      working.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const startPad = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    padRef.current = e.currentTarget as HTMLDivElement;
    mode.current = { index };
    working.current = display;
    setDrag(display);
  };

  // Dark block is active but this :root-only shadow can't be written there → pre-empt with a disabled
  // state + guidance instead of letting the 400 fire after a drag (hooks already ran above).
  if (disabled) {
    return (
      <div className="ed-shadow" data-disabled="">
        <div className="ed-shadow-preview" data-surface={surfaceDark ? "dark" : "light"}>
          <span className="ed-shadow-card-preview" style={{ boxShadow: value }} aria-hidden="true" />
        </div>
        <p className="ed-shadow-fallback" role="status">
          Shadows are theme-independent — switch to the Light block to edit.
        </p>
      </div>
    );
  }

  return (
    <div className="ed-shadow" data-editable={editable}>
      <span className="ed-sr-only" aria-live="polite">{announce}</span>

      <div className="ed-shadow-preview" data-surface={surfaceDark ? "dark" : "light"}>
        <span className="ed-shadow-card-preview" style={{ boxShadow: value }} aria-hidden="true" />
        <button
          type="button"
          className="ed-shadow-surface"
          aria-label="Toggle preview surface"
          aria-pressed={surfaceDark}
          onClick={() => setSurfaceDark((v) => !v)}
        >
          {surfaceDark ? "dark bg" : "light bg"}
        </button>
      </div>

      <div className="ed-shadow-layers">
        {display.map((layer, i) => {
          const cardId = `ed-shadow-card-${i}`;
          if (i !== openIdx) {
            return (
              <LayerSummaryRow
                key={i}
                n={i + 1}
                layer={layer}
                cardId={cardId}
                canRemove={display.length > 1}
                onExpand={() => setOpen(i)}
                onRemove={() => removeLayer(i)}
              />
            );
          }
          const isDragging = drag !== null && mode.current?.index === i;
          return (
            <LayerCard
              key={i}
              id={cardId}
              n={i + 1}
              token={token}
              layer={layer}
              tokens={tokens}
              canRemove={display.length > 1}
              onLayer={(l) => setLayer(i, l)}
              onRemove={() => removeLayer(i)}
              onPadDown={(e) => startPad(e, i)}
              dot={dotPercent(layer.x, layer.y, PAD_RANGE)}
              badge={isDragging ? { x: layer.x, y: layer.y } : null}
            />
          );
        })}
        <button type="button" className="ed-shadow-addlayer" onClick={addLayer}>+ Add layer</button>
      </div>

      {!editable && (
        <p className="ed-shadow-fallback">Can’t edit this shadow visually — editing the raw value.</p>
      )}

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">raw</span>
        <input
          type="text"
          aria-label={`${token} raw value`}
          value={raw.draft}
          onChange={raw.onChange}
          onBlur={raw.onBlur}
          onKeyDown={raw.onKeyDown}
        />
      </div>
    </div>
  );
}
