"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import {
  parseGradient, formatGradient, rampGradient, stopColor, positionFromPointer,
  clampPct, type Gradient, type Stop,
} from "@/lib/editor/gradient";
import { useDraftField } from "@/lib/editor/use-draft-field";
import { GradientStopPicker } from "@/components/editor/controls/gradient-stop-picker";

const RAW_VALID = /^((linear|radial|conic)-gradient\(.+\)|var\(--[\w-]+\))$/;
const FALLBACK: Gradient = {
  type: "linear",
  angle: 180,
  stops: [
    { color: "--foreground", alpha: 100, position: 0 },
    { color: "transparent", alpha: 0, position: 100 },
  ],
};

const isNum = (v: string) => v.trim().length > 0 && Number.isFinite(Number(v.trim()));
const withStops = (g: Gradient, stops: Stop[]): Gradient => ({ ...g, stops });

interface Props {
  token: string;
  value: string;
  onChange: (v: string) => void;
  tokens: ManifestToken[];
}

/** One precise stop row: color picker + position numeric input + remove (the keyboard path). */
function StopRow({
  index, stop, token, tokens, canRemove, onStop, onRemove,
}: {
  index: number; stop: Stop; token: string; tokens: ManifestToken[];
  canRemove: boolean; onStop: (s: Stop) => void; onRemove: () => void;
}) {
  const n = index + 1;
  const pos = useDraftField(
    String(stop.position),
    (v) => onStop({ ...stop, position: clampPct(Number(v)) }),
    isNum,
  );
  return (
    <div className="ed-gradient-stoprow">
      <GradientStopPicker stop={stop} tokens={tokens} onChange={onStop} label={`stop ${n}`} />
      <div className="ed-gradient-stoprow-foot">
        <input
          type="number"
          className="ed-gradient-pos"
          aria-label={`${token} stop ${n} position`}
          min={0}
          max={100}
          step={1}
          value={pos.draft}
          onChange={pos.onChange}
          onBlur={pos.onBlur}
          onKeyDown={pos.onKeyDown}
        />
        <span className="ed-gradient-pos-unit" aria-hidden="true">%</span>
        <button
          type="button"
          className="ed-iconbtn"
          aria-label={`Remove stop ${n}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function GradientBuilder({ token, value, onChange, tokens }: Props) {
  const parsed = parseGradient(value);
  const [drag, setDrag] = useState<Gradient | null>(null);
  const display: Gradient = drag ?? parsed ?? FALLBACK;
  const editable = parsed !== null; // unparseable → builder dimmed, raw row authoritative

  const emit = (g: Gradient) => onChange(formatGradient(g));
  const raw = useDraftField(value, (v) => onChange(v), (v) => RAW_VALID.test(v.trim()));

  const setType = (type: Gradient["type"]) => {
    if (type === display.type) return;
    emit(
      type === "linear"
        ? { type: "linear", angle: 180, stops: display.stops }
        : { type: "radial", shape: "circle", cx: 50, cy: 50, stops: display.stops },
    );
  };

  // ---- stop edits (discrete, emit once each) ----
  const replaceStop = (i: number, s: Stop) => emit(withStops(display, display.stops.map((p, j) => (j === i ? s : p))));
  const removeStop = (i: number) => {
    if (display.stops.length <= 2) return;
    emit(withStops(display, display.stops.filter((_, j) => j !== i)));
  };
  const addStop = () => {
    // insert at the midpoint of the largest gap between consecutive positions
    const sorted = [...display.stops].sort((a, b) => a.position - b.position);
    let gap = -1, at = 50, after = sorted[0];
    for (let i = 0; i < sorted.length - 1; i++) {
      const d = sorted[i + 1].position - sorted[i].position;
      if (d > gap) { gap = d; at = (sorted[i].position + sorted[i + 1].position) / 2; after = sorted[i]; }
    }
    emit(withStops(display, [...display.stops, { color: after.color, alpha: after.alpha, position: clampPct(at) }]));
  };

  // ---- ramp handle drag (commit once on pointer-up) ----
  const rampRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number | null>(null);
  const working = useRef<Gradient | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragIndex.current === null || !rampRef.current || !working.current) return;
      const pos = positionFromPointer(e.clientX, rampRef.current.getBoundingClientRect());
      const g = working.current;
      const next = withStops(g, g.stops.map((p, j) => (j === dragIndex.current ? { ...p, position: pos } : p)));
      working.current = next;
      setDrag(next);
    };
    const up = () => {
      if (dragIndex.current === null || !working.current) return;
      emit(working.current);
      dragIndex.current = null;
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

  const onHandleDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragIndex.current = i;
    working.current = display;
    setDrag(display);
  };

  return (
    <div className="ed-gradient" data-editable={editable}>
      <div className="ed-gradient-preview" style={{ background: value }} aria-hidden="true" />

      <div className="ed-gradient-types" role="radiogroup" aria-label={`${token} gradient type`}>
        {(["linear", "radial"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={display.type === t}
            className="ed-gradient-type"
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Geometry slot — filled in Task 6 */}

      <div className="ed-gradient-stops">
        <div className="ed-gradient-ramp" ref={rampRef} style={{ backgroundImage: rampGradient(display.stops) }} aria-hidden="true">
          {display.stops.map((s, i) => (
            <button
              key={i}
              type="button"
              className="ed-gradient-handle"
              style={{ left: `${clampPct(s.position)}%`, background: stopColor(s) }}
              data-checker={s.color === "transparent" ? "" : undefined}
              tabIndex={-1}
              aria-hidden="true"
              onPointerDown={onHandleDown(i)}
            />
          ))}
        </div>
        {display.stops.map((s, i) => (
          <StopRow
            key={i}
            index={i}
            stop={s}
            token={token}
            tokens={tokens}
            canRemove={display.stops.length > 2}
            onStop={(ns) => replaceStop(i, ns)}
            onRemove={() => removeStop(i)}
          />
        ))}
        <button type="button" className="ed-gradient-addstop" onClick={addStop}>+ Add stop</button>
      </div>

      {!editable && (
        <p className="ed-gradient-fallback">Can’t edit this gradient visually — editing the raw value.</p>
      )}

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          raw
        </span>
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
