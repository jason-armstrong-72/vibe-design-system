import postcss from "postcss";
import { readFile, writeFile, rename } from "node:fs/promises";
import type { TokenEdit } from "./types";
import { groupForName } from "./schema";
import { validateValue } from "./validate";

const SELECTOR_FOR_THEME = { light: ":root", dark: ".dark" } as const;

/**
 * Update exactly one CSS custom property in the correct theme block of `filePath`,
 * preserving all formatting/comments/ordering, validating the value, writing atomically.
 * Re-reads the file first so it never writes against a stale snapshot. Throws if the
 * token does not already exist (the editor edits, it does not create).
 */
export async function writeToken(filePath: string, edit: TokenEdit): Promise<void> {
  const { name, value, theme } = edit;

  // 1. validate (throws before any IO). Pass value so a user-added color
  //    (unknown name, color value) classifies correctly instead of throwing.
  validateValue(groupForName(name, value), value);

  // 2. re-read current file
  const css = await readFile(filePath, "utf8");
  const root = postcss.parse(css);
  const selector = SELECTOR_FOR_THEME[theme];

  // 3. update exactly one declaration in the matching theme block (never @theme)
  let updated = 0;
  root.walkRules((rule) => {
    if (rule.selector.trim() !== selector) return;
    rule.walkDecls(name, (decl) => {
      decl.value = value;
      updated += 1;
    });
  });
  if (updated === 0) throw new Error(`token ${name} not found in ${selector}`);

  // 4. atomic write: temp then rename (the Next watcher never sees a half-written file)
  const out = root.toString();
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, out, "utf8");
  await rename(tmp, filePath);
}
