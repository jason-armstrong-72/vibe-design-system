// Pure CSS value-list helpers. No React, no DOM. Shared by gradient.ts, shadow.ts, resolve-token.ts.

/** Split a CSS list on commas at paren-depth 0 (so color-mix(...) / rgb(...) inner commas survive).
 *  Trims each segment and drops empties. */
export function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out.map((p) => p.trim()).filter((p) => p.length > 0);
}
