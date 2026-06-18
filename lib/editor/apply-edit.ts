import { readFile } from "node:fs/promises";
import type { TokenEdit } from "@/lib/tokens/types";
import { parseTokens } from "@/lib/tokens/parse";
import { writeToken } from "@/lib/tokens/write";

export class UnknownTokenError extends Error {}

/**
 * Apply one token edit to a globals.css file: defensive allowlist check (token must already
 * exist in the target theme block) → writeToken (which re-validates value-shape/injection and
 * writes atomically). Does NOT regenerate the manifest — the watcher owns that (spec §3/§8).
 */
export async function applyEdit(filePath: string, edit: TokenEdit): Promise<void> {
  const css = await readFile(filePath, "utf8");
  const present = parseTokens(css).some((t) => t.name === edit.name && t.theme === edit.theme);
  if (!present) throw new UnknownTokenError(`unknown token: ${edit.name} (${edit.theme})`);
  await writeToken(filePath, edit); // re-reads, validates value, atomic temp+rename
}
