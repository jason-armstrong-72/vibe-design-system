import postcss from "postcss";

const SWAPPABLE = new Set([":root", ".dark"]);

/**
 * Replace the :root and .dark rule blocks in `globalsCss` with those from `themeCss`,
 * leaving everything else (imports, @theme inline, @utility, @layer) untouched. A theme
 * is a values-only swap under the fixed token names (spec §13), so the utility layer is
 * invariant. Reuses PostCSS like lib/tokens/parse|write.
 */
export function applyTheme(globalsCss: string, themeCss: string): string {
  const target = postcss.parse(globalsCss);
  const source = postcss.parse(themeCss);

  const replacements = new Map<string, postcss.Rule>();
  source.walkRules((rule) => {
    const sel = rule.selector.trim();
    if (SWAPPABLE.has(sel)) replacements.set(sel, rule);
  });

  target.walkRules((rule) => {
    const sel = rule.selector.trim();
    const next = replacements.get(sel);
    if (next) rule.replaceWith(next.clone());
  });

  return target.toString();
}
