import type { Finding } from "./types";

export interface BaselineEntry { file: string; rule: string; key: string; count: number; }
export interface Baseline { version: 1; generated: string; entries: BaselineEntry[]; }

/** Stable identity used by BOTH the writer and the filter. Single source of truth. */
export function keyOf(f: Finding): string {
  return `${f.file} ${f.rule} ${f.key}`;
}

/** Snapshot the current baseline-able findings (those with a defined key). Sorted, deduped→counts. */
export function buildBaseline(findings: Finding[], generated: string): Baseline {
  const counts = new Map<string, BaselineEntry>();
  for (const f of findings) {
    if (f.key === undefined) continue;
    const k = keyOf(f);
    const e = counts.get(k);
    if (e) e.count++;
    else counts.set(k, { file: f.file, rule: f.rule, key: f.key, count: 1 });
  }
  const entries = [...counts.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.key.localeCompare(b.key),
  );
  return { version: 1, generated, entries };
}

/** Filter source findings against a baseline. Suppress up to each entry's count; the (count+1)-th is
 *  kept (new). staleEntries = entries whose recorded count exceeds the actual match count. */
export function applyBaseline(
  findings: Finding[],
  baseline: Baseline,
): { kept: Finding[]; suppressed: number; staleEntries: BaselineEntry[] } {
  const budget = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const e of baseline.entries) budget.set(`${e.file} ${e.rule} ${e.key}`, e.count);
  const kept: Finding[] = [];
  let suppressed = 0;
  for (const f of findings) {
    if (f.key === undefined) { kept.push(f); continue; }
    const k = keyOf(f);
    const remaining = budget.get(k) ?? 0;
    const used = seen.get(k) ?? 0;
    if (used < remaining) { seen.set(k, used + 1); suppressed++; }
    else kept.push(f);
  }
  const staleEntries = baseline.entries.filter(
    (e) => (seen.get(`${e.file} ${e.rule} ${e.key}`) ?? 0) < e.count,
  );
  return { kept, suppressed, staleEntries };
}

/** Locked human-facing message printed by `npm run check:baseline` (see spec §7). */
export function baselineSavedMessage(n: number): string {
  return `✓ Saved a snapshot of your existing code (${n} items).

We found ${n} things in your current code that don't follow the design
system's conventions yet — different colors, sizes, that sort of thing.
That's expected: they were written before you added the design system.
We've recorded them as your starting point, so you don't have to fix
anything to get going.

From here on, only NEW code gets checked against the design system, so
everything you build from now on stays consistent with it.

Your existing code is left exactly as it is and keeps working. If you'd
like to bring it in line with the design system too, you can update it
yourself — automatically converting old code isn't part of this template
yet. More in the README.`;
}
