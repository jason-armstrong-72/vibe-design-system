"use client";

import { useRef, useState } from "react";
import type { ManifestToken } from "@/lib/tokens/generate";
import { useDraftField } from "@/lib/editor/use-draft-field";
import {
  type Cubic,
  parseBezier,
  formatBezier,
  clampX,
  clampY,
  toSvg,
  fromSvg,
  Y_MIN,
  Y_MAX,
  GEOM_DEFAULT as G,
} from "@/lib/editor/bezier";

interface EasingFieldProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
  tokens: ManifestToken[];
}

const KEYWORDS = ["ease", "ease-in", "ease-out", "ease-in-out", "linear"];
// Raw escape-hatch validator: cubic-bezier | keyword | steps() | var().
const RAW_VALID =
  /^(cubic-bezier\(.+\)|linear|ease|ease-in|ease-out|ease-in-out|steps\(.+\)|var\(.+\))$/;
const DEFAULT_CURVE: Cubic = [0.25, 0.1, 0.25, 1]; // `ease`, last-resort fallback

function tokenValue(t: ManifestToken): string {
  return t.values.light ?? t.values.dark ?? "";
}

/** One numeric axis input (start/end × x/y) wired through useDraftField (commit on blur/Enter). */
function AxisInput({
  token,
  label,
  axisName,
  value,
  min,
  max,
  onCommit,
}: {
  token: string;
  label: string;
  axisName: string;
  value: number;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  // Round the displayed value to 2dp so a live drag doesn't show full-precision float noise.
  // The drag buffer keeps full precision internally (smooth curve); commit re-rounds via formatBezier.
  const field = useDraftField(
    String(Math.round(value * 100) / 100),
    (draft) => onCommit(Number(draft)),
    (draft) => {
      const n = Number(draft);
      return draft.trim() !== "" && Number.isFinite(n) && n >= min && n <= max;
    },
  );
  return (
    <div className="ed-row">
      <span className="ed-label" aria-hidden="true">
        {label}
      </span>
      <input
        type="number"
        step="0.01"
        aria-label={`${token} ${axisName}`}
        value={field.draft}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onKeyDown={field.onKeyDown}
      />
    </div>
  );
}

/**
 * Draggable cubic-bezier curve editor for easing tokens. SVG canvas with two draggable handles
 * (committed once on pointer-up — one history entry, no preview strobe), four numeric x/y inputs
 * (commit on blur/Enter — the keyboard/a11y path), preset chips (token curves + CSS keywords),
 * an animated preview, and a raw-value escape-hatch row for steps()/var()/paste.
 *
 * The curve is derived from `value` each render; the only local state is a transient drag buffer.
 * Always emits a normalised `cubic-bezier(...)` (keywords are converted). Never emits on mount.
 */
export function EasingField({ token, value, onChange, tokens }: EasingFieldProps) {
  const parsed = parseBezier(value);
  const fallback =
    parseBezier(
      tokenValue(tokens.find((t) => t.name === "--ease-standard") ?? ({} as ManifestToken)) || "",
    ) ?? DEFAULT_CURVE;
  const [drag, setDrag] = useState<Cubic | null>(null);
  const display: Cubic = drag ?? parsed ?? fallback;
  const drawable = drag !== null || parsed !== null;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Cubic | null>(null);
  const activeHandle = useRef<1 | 2 | null>(null);

  function clientToCurve(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * G.width;
    const sy = ((e.clientY - rect.top) / rect.height) * G.height;
    return fromSvg(sx, sy, G);
  }

  function onHandleDown(handle: 1 | 2, e: React.PointerEvent) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    activeHandle.current = handle;
    dragRef.current = display;
    setDrag(display);
  }
  function onHandleMove(e: React.PointerEvent) {
    if (activeHandle.current === null) return;
    const { x, y } = clientToCurve(e);
    const base = dragRef.current ?? display;
    const next: Cubic = [...base];
    if (activeHandle.current === 1) {
      next[0] = x;
      next[1] = y;
    } else {
      next[2] = x;
      next[3] = y;
    }
    dragRef.current = next;
    setDrag(next);
  }
  function onHandleUp(e: React.PointerEvent) {
    if (activeHandle.current === null) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    activeHandle.current = null;
    const final = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (final) onChange(formatBezier(final));
  }

  function commitAxis(index: 0 | 1 | 2 | 3, n: number) {
    const next: Cubic = [...display];
    next[index] = index === 0 || index === 2 ? clampX(n) : clampY(n);
    onChange(formatBezier(next));
  }

  // Preset chips: token curves + CSS keywords, deduped by normalised value.
  const seen = new Set<string>();
  const presets: { label: string; value: string }[] = [];
  for (const k of KEYWORDS) presets.push({ label: k, value: k });
  for (const t of tokens.filter((t) => t.group === "easing")) {
    const v = tokenValue(t);
    if (v) presets.push({ label: t.name.replace(/^--ease-?/, "") || t.name, value: v });
  }
  const dedupedPresets = presets.filter((p) => {
    const c = parseBezier(p.value);
    const key = c ? formatBezier(c) : p.value;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  function applyPreset(v: string) {
    const c = parseBezier(v);
    if (c) onChange(formatBezier(c));
  }

  // Preview: animation timing = committed curve; replay on commit (value change) + button.
  const previewEase = parsed ? formatBezier(parsed) : "linear";
  const [replay, setReplay] = useState(0);

  const pts = toSvg(display, G);
  const path = `M${pts.anchorStart.sx},${pts.anchorStart.sy} C${pts.p1.sx},${pts.p1.sy} ${pts.p2.sx},${pts.p2.sy} ${pts.anchorEnd.sx},${pts.anchorEnd.sy}`;
  const bandTop = G.padTop;
  const bandH = G.height - G.padTop - G.padBottom;

  const rawField = useDraftField(
    value,
    (draft) => onChange(draft.trim()),
    (d) => RAW_VALID.test(d.trim()),
  );

  return (
    <div className="ed-bezier">
      <p className="ed-bezier-legend ed-label">X = time → · Y = progress ↑ · past 0–1 = overshoot</p>

      <svg
        ref={svgRef}
        className={`ed-bezier-canvas${drawable ? "" : " ed-bezier-canvas--fallback"}`}
        viewBox={`0 0 ${G.width} ${G.height}`}
        width={G.width}
        height={G.height}
        role="img"
        aria-label={`${token} easing curve`}
      >
        {/* [0,1] progress reference band */}
        <rect x={G.padX} y={bandTop} width={G.width - 2 * G.padX} height={bandH} className="ed-bezier-band" />
        {/* control arms */}
        <line x1={pts.anchorStart.sx} y1={pts.anchorStart.sy} x2={pts.p1.sx} y2={pts.p1.sy} className="ed-bezier-arm" />
        <line x1={pts.anchorEnd.sx} y1={pts.anchorEnd.sy} x2={pts.p2.sx} y2={pts.p2.sy} className="ed-bezier-arm" />
        {/* the curve */}
        <path d={path} className="ed-bezier-path" fill="none" />
        {/* anchors */}
        <circle cx={pts.anchorStart.sx} cy={pts.anchorStart.sy} r={4} className="ed-bezier-anchor" />
        <circle cx={pts.anchorEnd.sx} cy={pts.anchorEnd.sy} r={4} className="ed-bezier-anchor" />
        {/* draggable handles (pointer-only; numeric inputs are the keyboard path) */}
        <circle
          data-testid="ed-bezier-handle-1"
          aria-hidden="true"
          cx={pts.p1.sx}
          cy={pts.p1.sy}
          r={6}
          className="ed-bezier-handle"
          onPointerDown={(e) => onHandleDown(1, e)}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        />
        <circle
          data-testid="ed-bezier-handle-2"
          aria-hidden="true"
          cx={pts.p2.sx}
          cy={pts.p2.sy}
          r={6}
          className="ed-bezier-handle"
          onPointerDown={(e) => onHandleDown(2, e)}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        />
      </svg>

      {!drawable && (
        <p className="ed-bezier-note ed-label">Not a curve — drag or pick a preset to convert.</p>
      )}

      <div className="ed-bezier-inputs">
        <AxisInput token={token} label="start x" axisName="start x" value={display[0]} min={0} max={1} onCommit={(n) => commitAxis(0, n)} />
        <AxisInput token={token} label="start y" axisName="start y" value={display[1]} min={Y_MIN} max={Y_MAX} onCommit={(n) => commitAxis(1, n)} />
        <AxisInput token={token} label="end x" axisName="end x" value={display[2]} min={0} max={1} onCommit={(n) => commitAxis(2, n)} />
        <AxisInput token={token} label="end y" axisName="end y" value={display[3]} min={Y_MIN} max={Y_MAX} onCommit={(n) => commitAxis(3, n)} />
      </div>

      <div className="ed-reuse">
        <span className="ed-label" aria-hidden="true">
          presets
        </span>
        <div className="ed-reuse-strip">
          {dedupedPresets.map((p) => (
            <button key={p.label} type="button" className="ed-bezier-preset" onClick={() => applyPreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ed-bezier-preview-row">
        <div key={`${previewEase}-${replay}`} className="ed-bezier-preview" style={{ ["--ed-bezier-ease" as string]: previewEase }}>
          <span className="ed-bezier-dot" />
        </div>
        <button type="button" className="ed-bezier-preset" onClick={() => setReplay((r) => r + 1)}>
          replay
        </button>
      </div>

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          raw
        </span>
        <input
          type="text"
          aria-label={`${token} raw value`}
          placeholder="cubic-bezier() / steps() / var()"
          value={rawField.draft}
          onChange={rawField.onChange}
          onBlur={rawField.onBlur}
          onKeyDown={rawField.onKeyDown}
        />
      </div>
    </div>
  );
}
