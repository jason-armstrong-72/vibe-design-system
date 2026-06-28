import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCatalogMarkdown } from "../lib/catalog/generate";
import { CATALOG } from "../lib/catalog/registry";
writeFileSync(resolve("design-system.components.md"), buildCatalogMarkdown(CATALOG), "utf8");
console.log(`catalog: wrote design-system.components.md (${CATALOG.length} primitives)`);
