"use client";

import { useSyncExternalStore } from "react";
import { wcagContrast } from "culori";
import type { ManifestToken } from "@/lib/tokens/generate";
import type { Theme } from "@/lib/tokens/types";
import { foregroundFor } from "@/lib/tokens/schema";
import { useDraftField } from "@/lib/editor/use-draft-field";
import {
  parseOklch,
  formatOklch,
  hexToOklch,
  oklchToHex,
  type Lch,
} from "@/lib/editor/oklch";

/** Minimal type for the (Chromium-only) EyeDropper API; declared locally to avoid a global. */
interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperInstance {
  open: () => Promise<EyeDropperResult>;
}
interface EyeDropperCtor {
  new (): EyeDropperInstance;
}

interface ColorOklchProps {
  token: string;
  value: string;
  onChange: (value: string) => void;
  /** Full token list (the manifest) — used for reuse-a-token swatches + the contrast partner. */
  tokens: ManifestToken[];
  /** The active editing block, so we look up partner/reuse values for the right theme. */
  editingBlock: Theme;
}

const FALLBACK: Lch = { l: 0, c: 0, h: 0 };

/** EyeDropper availability never changes after load, so the store never notifies. */
function subscribeNoop(): () => void {
  return () => {};
}

/** A token's effective value for the active block (dark falls back to light, then dark). */
function blockValue(tok: ManifestToken, block: Theme): string {
  return tok.values[block] ?? tok.values.light ?? tok.values.dark ?? "";
}

/** OKLCH color control: L/C/H sliders, oklch + hex fields, swatch, eyedropper, reuse swatches, contrast badge. */
export function ColorOklch({
  token,
  value,
  onChange,
  tokens,
  editingBlock,
}: ColorOklchProps) {
  const lch = parseOklch(value) ?? FALLBACK;
  const hex = oklchToHex(lch);

  // EyeDropper is a client-only capability; useSyncExternalStore gives a stable SSR
  // snapshot (false) and the real client value without a sync effect.
  const hasEyeDropper = useSyncExternalStore(
    subscribeNoop,
    () => typeof window !== "undefined" && "EyeDropper" in window,
    () => false,
  );

  const emit = (next: Lch) => onChange(formatOklch(next));

  // TEXT fields commit on blur / Enter (Bug 1) and never move the page on blur (Bug 2).
  // The L/C/H sliders, eyedropper, and reuse swatches stay live.
  const oklchField = useDraftField(
    value,
    (draft) => {
      const parsed = parseOklch(draft);
      if (parsed) onChange(formatOklch(parsed));
    },
    (draft) => parseOklch(draft) !== null,
  );
  const hexField = useDraftField(
    hex,
    (draft) => {
      const parsed = hexToOklch(draft);
      if (parsed) onChange(formatOklch(parsed));
    },
    (draft) => hexToOklch(draft) !== null,
  );

  const onEyedropper = async () => {
    if (typeof window === "undefined") return;
    const Ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Ctor) return;
    try {
      const { sRGBHex } = await new Ctor().open();
      const parsed = hexToOklch(sRGBHex);
      if (parsed) onChange(formatOklch(parsed));
    } catch {
      // user cancelled — no-op
    }
  };

  // Reuse-a-token: every OTHER color token.
  const reuseTokens = tokens.filter(
    (t) => t.group === "color" && t.name !== token,
  );

  // Contrast badge: pair with the foreground partner (read-only).
  const partnerName = foregroundFor(token);
  const partner = partnerName
    ? tokens.find((t) => t.name === partnerName)
    : undefined;
  const partnerValue = partner ? blockValue(partner, editingBlock) : undefined;
  let badge: { ratio: number; pass: boolean } | null = null;
  if (partnerValue) {
    const ratio = wcagContrast(value, partnerValue);
    if (Number.isFinite(ratio)) {
      badge = { ratio, pass: ratio >= 4.5 };
    }
  }

  return (
    <div className="ed-color">
      <div className="ed-color-top">
        <span
          data-testid="color-swatch"
          className="ed-color-swatch"
          style={{ background: value }}
          aria-hidden="true"
        />
        {hasEyeDropper ? (
          <button
            type="button"
            className="ed-iconbtn"
            aria-label="Pick color with eyedropper"
            onClick={onEyedropper}
          >
            {/* eyedropper glyph */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m2 22 1-1h3l9-9" />
              <path d="M3 21v-3l9-9" />
              <path d="m15 6 3.3-3.3a2.4 2.4 0 0 1 3.4 3.4L18.4 9.4l-2.8-2.8a2 2 0 0 0-.6-.6Z" />
            </svg>
          </button>
        ) : null}
      </div>

      <label className="ed-slider">
        <span className="ed-label">Lightness</span>
        <input
          type="range"
          aria-label={`${token} lightness`}
          min={0}
          max={1}
          step={0.001}
          value={lch.l}
          onChange={(e) => emit({ ...lch, l: Number(e.target.value) })}
        />
        <span className="ed-slider-val">{lch.l.toFixed(3)}</span>
      </label>

      <label className="ed-slider">
        <span className="ed-label">Chroma</span>
        <input
          type="range"
          aria-label={`${token} chroma`}
          min={0}
          max={0.4}
          step={0.001}
          value={lch.c}
          onChange={(e) => emit({ ...lch, c: Number(e.target.value) })}
        />
        <span className="ed-slider-val">{lch.c.toFixed(3)}</span>
      </label>

      <label className="ed-slider">
        <span className="ed-label">Hue</span>
        <input
          type="range"
          aria-label={`${token} hue`}
          min={0}
          max={360}
          step={1}
          value={lch.h}
          onChange={(e) => emit({ ...lch, h: Number(e.target.value) })}
        />
        <span className="ed-slider-val">{Math.round(lch.h)}</span>
      </label>

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          oklch
        </span>
        <input
          type="text"
          aria-label={`${token} oklch value`}
          value={oklchField.draft}
          onChange={oklchField.onChange}
          onBlur={oklchField.onBlur}
          onKeyDown={oklchField.onKeyDown}
        />
      </div>

      <div className="ed-row">
        <span className="ed-label" aria-hidden="true">
          hex
        </span>
        <input
          type="text"
          aria-label={`${token} hex value`}
          value={hexField.draft}
          onChange={hexField.onChange}
          onBlur={hexField.onBlur}
          onKeyDown={hexField.onKeyDown}
        />
      </div>

      {badge ? (
        <div
          data-testid="contrast-badge"
          className="ed-contrast"
          data-pass={badge.pass}
        >
          <span className="ed-label">contrast</span>
          <span>
            {badge.ratio.toFixed(2)} : 1 — {badge.pass ? "PASS" : "FAIL"} (AA 4.5)
          </span>
        </div>
      ) : null}

      {reuseTokens.length > 0 ? (
        <div className="ed-reuse">
          <span className="ed-label">Reuse a token</span>
          <div className="ed-reuse-strip">
            {reuseTokens.map((t) => {
              const v = blockValue(t, editingBlock);
              return (
                <button
                  key={t.name}
                  type="button"
                  className="ed-reuse-swatch"
                  aria-label={`Reuse ${t.name}`}
                  title={`${t.name} — ${v}`}
                  style={{ background: v }}
                  onClick={() => onChange(v)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
