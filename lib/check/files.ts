import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface SourceFile { path: string; content: string; }

/** Recursively collect files under `roots` with one of `exts`, skipping any path that contains
 *  one of `excludeDirs` segments or matches an `excludeFile` (repo-relative, posix). */
export function walkSource(
  roots: string[],
  exts: string[],
  opts: { excludeDirs?: string[]; excludeFiles?: string[] } = {},
): SourceFile[] {
  const out: SourceFile[] = [];
  const exclDirs = new Set(opts.excludeDirs ?? []);
  const exclFiles = new Set(opts.excludeFiles ?? []);
  const visit = (dir: string) => {
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = join(dir, name);
      const rel = relative(process.cwd(), full).split(sep).join("/");
      if (statSync(full).isDirectory()) {
        if (!exclDirs.has(name)) visit(full);
        continue;
      }
      if (!exts.some((e) => name.endsWith(e))) continue;
      if (exclFiles.has(rel)) continue;
      out.push({ path: rel, content: readFileSync(full, "utf8") });
    }
  };
  for (const r of roots) visit(r);
  return out;
}
