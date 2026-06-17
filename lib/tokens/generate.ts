import type { Token, TokenGroup } from "./types";
import { utilitiesForToken } from "./utilities";

export interface ManifestToken {
  name: string;
  group: TokenGroup;
  values: { light?: string; dark?: string };
  utilities: string[];
  usage?: string;
}
export interface Manifest {
  generatedFrom: string;
  tokens: ManifestToken[];
}

const GROUP_ORDER: TokenGroup[] = [
  "color", "fontFamily", "fontSize", "lineHeight", "fontWeight",
  "spacing", "radius", "borderWidth", "shadow", "duration", "easing",
  "zIndex", "opacity", "container",
];

function mergeByName(tokens: Token[]): ManifestToken[] {
  const byName = new Map<string, ManifestToken>();
  for (const t of tokens) {
    let entry = byName.get(t.name);
    if (!entry) {
      const hint = utilitiesForToken(t);
      entry = {
        name: t.name,
        group: t.group,
        values: {},
        utilities: hint.utilities,
        ...(hint.usage ? { usage: hint.usage } : {}),
      };
      byName.set(t.name, entry);
    }
    entry.values[t.theme] = t.value;
  }
  // deterministic: group order, then name
  return [...byName.values()].sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
    return g !== 0 ? g : a.name.localeCompare(b.name);
  });
}

const PREAMBLE = `# Design System — token reference

> **Generated from \`app/globals.css\`. Do not edit by hand — run \`npm run tokens\`.**

## Usage rules
- Style with Tailwind utilities that map to tokens (\`bg-primary\`, \`text-lg\`, \`p-4\`, \`rounded-lg\`).
- **Never hardcode** a color / size / font / duration. Off-token color & type utilities won't compile; off-scale spacing is flagged by lint.

## Extension procedure
Need a value the system lacks? **Add a token** to \`app/globals.css\` — for a color, add it to BOTH \`:root\` and \`.dark\` — then run \`npm run tokens\` and use it via its Tailwind utility. **Never hardcode.** The new token auto-appears on \`/design-system\` and becomes editable.
`;

function markdownTable(tokens: ManifestToken[]): string {
  const rows = tokens.map((t) => {
    const util = t.utilities.length ? t.utilities.join(" ") : (t.usage ?? "");
    const value = t.values.dark
      ? `\`${t.values.light ?? ""}\` / \`${t.values.dark}\``
      : `\`${t.values.light ?? ""}\``;
    return `| \`${t.name}\` | ${t.group} | ${value} | ${util} |`;
  });
  return ["| Token | Group | Value (light / dark) | Utilities |", "|---|---|---|---|", ...rows].join("\n");
}

export function buildManifest(tokens: Token[], source = "app/globals.css"): { json: Manifest; markdown: string } {
  const merged = mergeByName(tokens);
  const json: Manifest = { generatedFrom: source, tokens: merged };
  const markdown = `${PREAMBLE}\n## Tokens\n\n${markdownTable(merged)}\n`;
  return { json, markdown };
}
