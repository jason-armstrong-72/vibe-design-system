import { describe, it, expect } from "vitest";
import { mkdtempSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { writeToken } from "@/lib/tokens/write";

const REAL = resolve("app/globals.css");

describe("round-trip against the real globals.css", () => {
  it("every token can be rewritten and re-read losslessly", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-rt-"));
    const file = join(dir, "globals.css");
    copyFileSync(REAL, file);

    const before = parseTokens(readFileSync(file, "utf8"));
    expect(before.length).toBeGreaterThan(20); // sanity: full token set present

    // rewrite each token with its OWN value — must be a no-op-equivalent that still parses
    for (const t of before) {
      await writeToken(file, { name: t.name, value: t.value, theme: t.theme });
    }

    const after = parseTokens(readFileSync(file, "utf8"));
    expect(after).toEqual(before); // same names, values, themes, groups
  });

  it("a changed token lands and nothing else moves", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-rt2-"));
    const file = join(dir, "globals.css");
    copyFileSync(REAL, file);
    const before = readFileSync(file, "utf8");

    await writeToken(file, { name: "--radius", value: "0.75rem", theme: "light" });
    const after = readFileSync(file, "utf8");

    const beforeLines = before.split("\n");
    const diff = after.split("\n").filter((l, i) => l !== beforeLines[i]);
    expect(diff.length).toBe(1);
    expect(diff[0]).toContain("--radius: 0.75rem;");
  });
});
