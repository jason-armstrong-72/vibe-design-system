import type { Finding } from "./types";
import { MSG } from "./messages";
import { parseTokens } from "@/lib/tokens/parse";
import { buildManifest } from "@/lib/tokens/generate";
import { syncThemeMappings } from "@/lib/tokens/sync";
import { radiusStepsFrom } from "@/lib/tokens/regenerate";

/** In-process freshness: the committed manifest must equal what `npm run tokens` would produce.
 *  (CI ALSO runs the authoritative git-dirty check — see .github/workflows/ci.yml.) */
export function checkManifestFresh(globalsCss: string, committedJson: string, committedMd: string): Finding[] {
  const sync = syncThemeMappings(globalsCss);
  const out: Finding[] = [];
  if (sync.changed)
    out.push({ file: "app/globals.css", line: 0, rule: "manifest-fresh",
      message: `missing @theme mapping(s): ${sync.added.join(", ")} — run npm run tokens and commit` });
  const { json, markdown } = buildManifest(parseTokens(sync.css), "app/globals.css", radiusStepsFrom(sync.css));
  const expectedJson = JSON.stringify(json, null, 2) + "\n";
  if (committedJson !== expectedJson)
    out.push({ file: "design-system.json", line: 0, rule: "manifest-fresh", message: MSG.manifestStale("design-system.json") });
  if (committedMd !== markdown)
    out.push({ file: "design-system.md", line: 0, rule: "manifest-fresh", message: MSG.manifestStale("design-system.md") });
  return out;
}
