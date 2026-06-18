import type { Finding } from "./types";
import { MSG } from "./messages";

const DISABLE_RE = /(?:\/\/|\/\*)\s*ds-disable:\s*(.*?)\s*(?:\*\/|$)/;
const BARE_RE = /(?:\/\/|\/\*)\s*ds-disable\s*(?:\*\/|$)/; // no colon/reason

/** Lines (1-based) that carry a valid ds-disable (reason present). */
export function disabledLines(content: string): Set<number> {
  const set = new Set<number>();
  content.split("\n").forEach((ln, i) => {
    const m = ln.match(DISABLE_RE);
    if (m && m[1].trim()) set.add(i + 1);
  });
  return set;
}

/** Findings for bare ds-disable (no reason). */
export function bareDisableFindings(path: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((ln, i) => {
    if (BARE_RE.test(ln) && !DISABLE_RE.test(ln)) {
      out.push({ file: path, line: i + 1, rule: "ds-disable", message: MSG.bareDisable() });
    }
  });
  return out;
}

/** Drop line-scoped findings whose immediately-preceding line carries a valid ds-disable.
 *  Whole-file findings (line 0) are never suppressible. Returns [kept, suppressedCount]. */
export function applySuppressions(findings: Finding[], content: string): [Finding[], number] {
  const dis = disabledLines(content);
  let suppressed = 0;
  const kept = findings.filter((f) => {
    if (f.line > 0 && (dis.has(f.line - 1) || dis.has(f.line))) { suppressed++; return false; }
    return true;
  });
  return [kept, suppressed];
}
