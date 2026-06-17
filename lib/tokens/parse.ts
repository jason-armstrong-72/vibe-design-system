import postcss from "postcss";
import type { Token, Theme } from "./types";
import { groupForName } from "./schema";

const THEME_FOR_SELECTOR: Record<string, Theme> = {
  ":root": "light",
  ".dark": "dark",
};

/** Parse only the :root and .dark rule blocks into typed tokens. @theme is ignored. */
export function parseTokens(css: string): Token[] {
  const root = postcss.parse(css);
  const tokens: Token[] = [];

  root.walkRules((rule) => {
    const theme = THEME_FOR_SELECTOR[rule.selector.trim()];
    if (!theme) return; // skip @theme (an at-rule anyway) and any other selector
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith("--")) return;
      tokens.push({
        name: decl.prop,
        value: decl.value.trim(),
        theme,
        group: groupForName(decl.prop),
      });
    });
  });

  return tokens;
}
