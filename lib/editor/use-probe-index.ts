"use client";
import { useCallback } from "react";
import designSystem from "@/design-system.json";
import type { Manifest } from "@/lib/tokens/generate";
import type { TokenGroup } from "@/lib/tokens/types";
import {
  GROUP_PROPERTY, GROUP_CANON_PROP, canonicalize,
  type TokenIndex, type ElementValue, type CssProperty,
} from "@/lib/editor/resolve-token";

const MANIFEST = designSystem as Manifest;

/** The probe's inline style property to SET = var(<token>), per group (radius is special — see below). */
const STYLE_PROP: Partial<Record<TokenGroup, "color" | "fontSize" | "fontFamily" | "boxShadow">> = {
  color: "color",
  fontSize: "fontSize",
  fontFamily: "fontFamily",
  shadow: "boxShadow",
};

const read = (el: Element, prop: string) => getComputedStyle(el).getPropertyValue(prop).trim();

/** border-radius: only meaningful when all four corners are equal (a single shorthand). */
function readBorderRadius(el: Element): string | null {
  const cs = getComputedStyle(el);
  const corners = [
    cs.borderTopLeftRadius, cs.borderTopRightRadius,
    cs.borderBottomRightRadius, cs.borderBottomLeftRadius,
  ].map((s) => s.trim());
  return corners.every((c) => c === corners[0]) ? corners[0] : null;
}

/**
 * Reverse-resolution DOM side: builds a fresh token index by probing `var(<token>)` (computed→computed),
 * and reads an element's in-scope computed values. NOT memoized across edits/blocks — `buildIndex` is called
 * per pick so a live token edit (which repaints the page) is reflected (see spec §0 "Index freshness").
 * jsdom can't resolve var()/calc()/real serialization, so this is covered by e2e, not unit tests.
 */
export function useProbeIndex() {
  const buildIndex = useCallback((): TokenIndex => {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;width:0;height:0;opacity:0;overflow:hidden;pointer-events:none;";
    document.body.appendChild(probe);
    const index: TokenIndex = {};
    try {
      for (const t of MANIFEST.tokens) {
        const group = t.group;
        if (!(group in GROUP_PROPERTY)) continue;
        const canonProp = GROUP_CANON_PROP[group]!;
        if (group === "radius") {
          for (const util of t.utilities) {
            probe.className = util;
            const canon = canonicalize("border-radius", readBorderRadius(probe) ?? "");
            if (canon) (index.radius ??= []).push({ token: t.name, canonical: canon });
          }
          probe.className = "";
        } else {
          const styleProp = STYLE_PROP[group]!;
          probe.style[styleProp] = `var(${t.name})`;
          const canon = canonicalize(canonProp, read(probe, canonProp));
          if (canon) (index[group] ??= []).push({ token: t.name, canonical: canon });
          probe.style[styleProp] = "";
        }
      }
    } finally {
      probe.remove();
    }
    return index;
  }, []);

  const readElementValues = useCallback((el: Element): ElementValue[] => {
    const out: ElementValue[] = [];
    for (const [group, props] of Object.entries(GROUP_PROPERTY)) {
      for (const prop of props as CssProperty[]) {
        const raw = prop === "border-radius" ? readBorderRadius(el) : read(el, prop);
        const canon = raw != null ? canonicalize(prop, raw) : null;
        if (canon) out.push({ property: prop, group: group as TokenGroup, canonical: canon });
      }
    }
    return out;
  }, []);

  return { buildIndex, readElementValues };
}
