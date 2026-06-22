"use client";

import { useEffect, useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import {
  parseGradient, formatGradient, rampGradient, stopColor, positionFromPointer, centerFromPointer,
  clampPct, clampAngle, type Gradient, type Stop,
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

type DragMode = { kind: "stop"; index: number } | { kind: "pad" } | null;

interface Props {
  token: string;
  value: string;
  onChange: (v: string) => void;
  tokens: ManifestToken[];
}

/** A labelled numeric input, commit-on-blur/Enter (the keyboard path for angle/x/y/position). */
function NumField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const f = useDraftField(String(value), (v) => onCommit(Number(v)), isNum);
  return (
    <input
      type="number"
      className="ed-gradient-pos"
      aria-label={label}
      min={0}
      max={100}
      step={1}
      value={f.draft}
      onChange={f.onChange}
      onBlur={f.onBlur}
      onKeyDown={f.onKeyDown}
    />
  );
}

/** One precise stop row: color picker + position numeric input + remove (the keyboard path). */
function StopRow({
  index, stop, token, tokens, canRemove, onStop, onRemove,
}: {
  index: number; stop: Stop; token: string; tokens: ManifestToken[];
  canRemove: boolean; onStop: (s: Stop) => void; onRemove: () => void;
}) {
  const n = index + 1;
  return (
    <div className="ed-gradient-stoprow">
      <GradientStopPicker stop={stop} tokens={tokens} onChange={onStop} label={`stop ${n}`} />
      <div className="ed-gradient-stoprow-foot">
        <NumField
          label={`${token} stop ${n} position`}
          value={stop.position}
          onCommit={(v) => onStop({ ...stop, position: clampPct(v) })}
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
    const sorted = [...display.stops].sort((a, b) => a.position - b.position);
    let gap = -1, at = 50, after = sorted[0];
    for (let i = 0; i < sorted.length - 1; i++) {
      const d = sorted[i + 1].position - sorted[i].position;
      if (d > gap) { gap = d; at = (sorted[i].position + sorted[i + 1].position) / 2; after = sorted[i]; }
    }
    emit(withStops(display, [...display.stops, { color: after.color, alpha: after.alpha, position: clampPct(at) }]));
  };

  // ---- drag (stop handle OR radial pad): commit once on pointer-up ----
  const rampRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const mode = useRef<DragMode>(null);
  const working = useRef<Gradient | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const m = mode.current, g = working.current;
      if (!m || !g) return;
      let next = g;
      if (m.kind === "stop" && rampRef.current) {
        const pos = positionFromPointer(e.clientX, rampRef.current.getBoundingClientRect());
        next = withStops(g, g.stops.map((p, j) => (j === m.index ? { ...p, position: pos } : p)));
      } else if (m.kind === "pad" && padRef.current && g.type === "radial") {
        const { cx, cy } = centerFromPointer(e.clientX, e.clientY, padRef.current.getBoundingClientRect());
        next = { ...g, cx, cy };
      }
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

  const startDrag = (m: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    mode.current = m;
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

      {display.type === "linear" ? (
        <div className="ed-gradient-geom">
          <span className="ed-label" aria-hidden="true">angle</span>
          <input
            type="range"
            aria-label={`${token} angle`}
            min={0}
            max={360}
            step={1}
            value={display.angle}
            onChange={(e) => emit({ ...display, angle: clampAngle(Number(e.target.value)) })}
          />
          <span className="ed-gradient-geom-val" aria-hidden="true">{display.angle}°</span>
        </div>
      ) : (
        <div className="ed-gradient-geom ed-gradient-geom-radial">
          <select
            className="ed-gradient-shape"
            aria-label={`${token} shape`}
            value={display.shape}
            onChange={(e) => emit({ ...display, shape: e.target.value as "circle" | "ellipse" })}
          >
            <option value="circle">circle</option>
            <option value="ellipse">ellipse</option>
          </select>
          <div className="ed-gradient-pad" ref={padRef} aria-hidden="true" onPointerDown={startDrag({ kind: "pad" })}>
            <span className="ed-gradient-pad-dot" style={{ left: `${clampPct(display.cx)}%`, top: `${clampPct(display.cy)}%` }} />
          </div>
          <div className="ed-gradient-center">
            <NumField label={`${token} position x`} value={display.cx} onCommit={(n) => emit({ ...display, cx: clampPct(n) })} />
            <NumField label={`${token} position y`} value={display.cy} onCommit={(n) => emit({ ...display, cy: clampPct(n) })} />
          </div>
        </div>
      )}

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
              onPointerDown={startDrag({ kind: "stop", index: i })}
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
