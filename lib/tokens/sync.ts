import postcss from "postcss";
import { parseTokens } from "./parse";

export interface SyncResult {
  css: string;
  changed: boolean;
  added: string[];
  warnings: string[];
}

/**
 * Ensure every value token in :root has its `@theme inline` mapping, so its Tailwind utility compiles.
 * Wires colour AND the scale families {fontSize, fontWeight, shadow} — additive and idempotent. This is
 * what makes the extension procedure one step for colour and scales alike: add the value token to
 * :root/.dark and `npm run tokens` wires the utility for you.
 *
 * CLOSED ALLOWLIST: only the 4 groups below are wired; every other group is silently ignored (radius is a
 * single knob; lineHeight is consumed as the fontSize pair; the rest are knob/self-referential). The loop
 * must never throw on an unwired group — a throw would crash `npm run tokens` and `npm run check`.
 */
export function syncThemeMappings(css: string): SyncResult {
  const root = postcss.parse(css);
  const tokens = parseTokens(css).filter((t) => t.theme === "light");
  const names = new Set(tokens.map((t) => t.name));

  let themeRule: postcss.AtRule | undefined;
  root.walkAtRules("theme", (at) => {
    if (/(^|\s)inline(\s|$)/.test(at.params)) themeRule = at;
  });
  if (!themeRule) throw new Error("syncThemeMappings: no `@theme inline` block found");

  // Exact-prop membership over ALL existing decls. The namespace-clear decls (`--color-*: initial`, …)
  // have prop `--color-*` (literal asterisk), so they never collide with a real step like `--text-8xl`.
  const existing = new Set<string>();
  themeRule.walkDecls((d) => {
    existing.add(d.prop);
  });

  const added: string[] = [];
  const warnings: string[] = [];
  const ensure = (prop: string, value: string) => {
    if (!existing.has(prop)) {
      themeRule!.append({ prop, value });
      existing.add(prop);
      added.push(prop);
    }
  };

  for (const t of tokens) {
    const bare = t.name.slice(2);
    switch (t.group) {
      case "color":
        ensure(`--color-${bare}`, `var(${t.name})`);
        break;
      case "fontWeight":
        ensure(`--font-weight-${bare.replace(/^fw-/, "")}`, `var(${t.name})`);
        break;
      case "shadow":
        ensure(`--shadow-${bare.replace(/^elevation-/, "")}`, `var(${t.name})`);
        break;
      case "fontSize": {
        const step = bare.replace(/^fs-/, "");
        ensure(`--text-${step}`, `var(${t.name})`);
        if (names.has(`--lh-${step}`)) ensure(`--text-${step}--line-height`, `var(--lh-${step})`);
        else warnings.push(`text-${step} wired with default line-height; add --lh-${step} for a proper pair`);
        break;
      }
      // all other groups intentionally ignored — DO NOT add a default throw
    }
  }

  return { css: root.toString(), changed: added.length > 0, added, warnings };
}
