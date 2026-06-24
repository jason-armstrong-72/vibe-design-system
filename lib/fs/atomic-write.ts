import { writeFileSync, renameSync } from "node:fs";

/** Write via temp-then-rename so a reader/watcher never sees a half-written file.
 *  Sync (build-time scripts). lib/tokens/write.ts keeps its own async postcss variant. */
export function atomicWriteFileSync(path: string, data: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data, "utf8");
  renameSync(tmp, path);
}
