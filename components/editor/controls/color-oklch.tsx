"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { wcagContrast } from "culori";
import type { ManifestToken } from "@/lib/tokens/generate";
import type { Theme } from "@/lib/tokens/types";
import { minRatio, partnerOf } from "@/lib/tokens/schema";
import { measurable } from "@/lib/tokens/contrast";
import { useDraftField } from "@/lib/editor/use-draft-field";
import {
  parseOklch,
  formatOklch,
  hexToOklch,
  oklchToHex,
  nearestPassingL,
  type Lch,
} from "@/lib/editor/oklch";

const THEMES: Theme[] = ["light", "dark"];

/** One block's contrast outcome (or null when unmeasurable / no partner). */
interface BlockReport {
  theme: Theme;
  ratio: number;
  min: number;
  pass: boolean;
  partnerValue: string; // gamut-source partner value (for the fix search)
}

/** Resolve a one-level var(--x) reference to the referenced token's value for the theme. */
function resolveOneLevel(
  v: string,
  theme: Theme,
  committed: (name: string, theme: Theme) => string,
): string {
  const m = v.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return m ? committed(m[1], theme) : v;
}

/** Gamut-map a measurable color string to the hex actually rendered (for honest contrast). */
function gamutHex(v: string): string | null {
  const lch = parseOklch(v);
  return lch ? oklchToHex(lch) : null;
}

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
  /** Live committed value of any token for a block (edited > manifest). Optional — defaults to the
   *  manifest snapshot so the control renders standalone (e.g. in tests). */
  committedValue?: (name: string, theme: Theme) => string;
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
  committedValue,
}: ColorOklchProps) {
  const lch = parseOklch(value) ?? FALLBACK;
  const hex = oklchToHex(lch);

  // Live value of any token for a block. Default to the manifest snapshot when not provided.
  const committed =
    committedValue ??
    ((name: string, theme: Theme) => {
      const t = tokens.find((x) => x.name === name);
      return t ? blockValue(t, theme) : "";
    });

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

  // Contrast report: BOTH blocks, gate-aligned (structural partnerOf + minRatio + measurable).
  const present = new Set(tokens.map((t) => t.name));
  const partnerName = partnerOf(token, present);
  // The threshold is keyed on the foreground side of the pair (3.0 for --muted-foreground, else 4.5).
  const fgName =
    token === "--foreground" || token.endsWith("-foreground") ? token : partnerName;
  const min = fgName ? minRatio(fgName) : 4.5;
  // The edited token's own value is editable only as a literal oklch (you can't nudge L of an alias).
  const fixable = parseOklch(value) !== null && !/^var\(/.test(value);

  const report: Record<Theme, BlockReport | null> = { light: null, dark: null };
  if (partnerName) {
    for (const theme of THEMES) {
      // Edited token: the live in-progress value for the active block; committed for the other.
      const editedRaw = theme === editingBlock ? value : committed(token, theme);
      const edited = resolveOneLevel(editedRaw, theme, committed);
      const partnerRaw = committed(partnerName, theme);
      const partner = resolveOneLevel(partnerRaw, theme, committed);
      if (!measurable(edited) || !measurable(partner)) continue; // can't measure → no report
      const eHex = gamutHex(edited);
      const pHex = gamutHex(partner);
      if (!eHex || !pHex) continue;
      const ratio = wcagContrast(eHex, pHex);
      if (!Number.isFinite(ratio)) continue;
      report[theme] = { theme, ratio, min, pass: ratio >= min, partnerValue: partner };
    }
  }

  // a11y: announce only on a pass↔fail transition (not on every slider tick).
  const passKey = `${report.light?.pass ?? "-"}|${report.dark?.pass ?? "-"}`;
  const [announce, setAnnounce] = useState("");
  const prevKey = useRef(passKey);
  useEffect(() => {
    if (prevKey.current !== passKey) {
      prevKey.current = passKey;
      const fails = THEMES.filter((t) => report[t] && !report[t]!.pass);
      setAnnounce(
        fails.length
          ? `Contrast below AA in ${fails.join(" and ")}`
          : partnerName
            ? "Contrast passes AA"
            : "",
      );
    }
  }, [passKey, partnerName]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {partnerName ? (
        <div data-testid="contrast-badge" className="ed-contrast-report" aria-describedby={undefined}>
          <span className="ed-label">contrast vs {partnerName}</span>
          {THEMES.map((theme) => {
            const r = report[theme];
            if (!r) {
              return (
                <div key={theme} className="ed-contrast-row" data-theme={theme}>
                  <span className="ed-contrast-block">{theme}</span>
                  <span className="ed-contrast-na">not measurable</span>
                </div>
              );
            }
            const isActive = theme === editingBlock;
            const fixedValue = !r.pass && fixable
              ? nearestPassingL(value, r.partnerValue, r.min)
              : null;
            return (
              <div key={theme} className="ed-contrast-row" data-theme={theme} data-pass={r.pass}>
                <span className="ed-contrast-block">{theme}</span>
                <span className="ed-contrast-ratio">
                  {r.ratio.toFixed(2)} : 1 — {r.pass ? "PASS" : `below ${r.min}`}
                </span>
                {!r.pass && isActive && fixedValue ? (
                  <button
                    type="button"
                    className="ed-contrast-fix"
                    onClick={() => onChange(fixedValue)}
                  >
                    Fix {theme} → L {parseOklch(fixedValue)!.l.toFixed(2)}
                  </button>
                ) : null}
                {!r.pass && isActive && fixable && !fixedValue ? (
                  <span className="ed-contrast-na">can&apos;t reach AA at this chroma — lower Chroma or change Hue</span>
                ) : null}
                {!r.pass && isActive && !fixable ? (
                  <span className="ed-contrast-na">aliased — edit the source token</span>
                ) : null}
                {!r.pass && !isActive ? (
                  <span className="ed-contrast-na">switch to {theme} to fix</span>
                ) : null}
              </div>
            );
          })}
          <span className="ed-sr-only" aria-live="polite">{announce}</span>
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
