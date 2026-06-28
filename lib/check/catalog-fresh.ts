import type { Finding } from "./types";
import { MSG } from "./messages";
import { exportsOf } from "@/lib/catalog/exports";
import { buildCatalogMarkdown } from "@/lib/catalog/generate";
import { CATALOG } from "@/lib/catalog/registry";

/** Every Capitalized export under components/ui must have a catalog entry; the doc must be fresh.
 *  Findings intentionally omit `key` — catalog coverage is not baseline-suppressible: every primitive
 *  must be catalogued, including pre-existing ones. */
export function checkCatalogFresh(uiFiles: { path: string; content: string }[], committedMd: string): Finding[] {
  const out: Finding[] = [];
  const registered = new Set(CATALOG.flatMap((e) => e.exports));
  const actual = new Set(uiFiles.flatMap((f) => exportsOf(f.content)));
  for (const f of uiFiles)
    for (const sym of exportsOf(f.content))
      if (!registered.has(sym))
        out.push({ file: f.path, line: 0, rule: "catalog-fresh", message: MSG.catalogUnregistered(sym) });
  for (const e of CATALOG)
    for (const sym of e.exports)
      if (!actual.has(sym))
        out.push({ file: e.file, line: 0, rule: "catalog-fresh", message: MSG.catalogPruned(sym) });
  if (committedMd !== buildCatalogMarkdown(CATALOG))
    out.push({ file: "design-system.components.md", line: 0, rule: "catalog-fresh", message: MSG.catalogStale() });
  return out;
}
