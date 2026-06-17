import postcss from "postcss";
import { parseTokens } from "./parse";

export interface SyncResult {
  css: string;
  changed: boolean;
  added: string[];
}

/**
 * Ensure every color token in :root has a `--color-<name>: var(--<name>)` mapping in the
 * `@theme inline` block, so its `bg-/text-/border-` utility compiles. Additive and
 * idempotent — this is what lets the extension procedure be one step: a vibe coder adds
 * `--highlight: oklch(...)` to :root/.dark and `npm run tokens` wires the utility for them.
 *
 * Only colors are auto-wired (the common extension case). Other groups (type/shadow/…) are
 * hand-maintained scales and are left untouched.
 */
export function syncThemeColorMappings(css: string): SyncResult {
  const root = postcss.parse(css);

  const colorNames = parseTokens(css)
    .filter((t) => t.theme === "light" && t.group === "color")
    .map((t) => t.name);

  let themeRule: postcss.AtRule | undefined;
  root.walkAtRules("theme", (at) => {
    if (/(^|\s)inline(\s|$)/.test(at.params)) themeRule = at;
  });
  if (!themeRule) throw new Error("syncThemeColorMappings: no `@theme inline` block found");

  const existing = new Set<string>();
  themeRule.walkDecls((d) => {
    if (d.prop.startsWith("--color-")) existing.add(d.prop);
  });

  const added: string[] = [];
  for (const name of colorNames) {
    const themeVar = `--color-${name.slice(2)}`;
    if (!existing.has(themeVar)) {
      themeRule.append({ prop: themeVar, value: `var(${name})` });
      added.push(themeVar);
    }
  }

  return { css: root.toString(), changed: added.length > 0, added };
}
