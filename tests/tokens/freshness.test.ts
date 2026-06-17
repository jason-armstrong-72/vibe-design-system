import { describe, it, expect } from "vitest";
import { mkdtempSync, copyFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseTokens } from "@/lib/tokens/parse";
import { writeToken } from "@/lib/tokens/write";
import { buildManifest } from "@/lib/tokens/generate";

describe("manifest freshness", () => {
  it("a written token is reflected in a freshly built manifest", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ds-fresh-"));
    const file = join(dir, "globals.css");
    copyFileSync(resolve("app/globals.css"), file);

    await writeToken(file, { name: "--primary", value: "oklch(0.5 0.1 250)", theme: "light" });
    const { json } = buildManifest(parseTokens(readFileSync(file, "utf8")));

    expect(json.tokens.find((t) => t.name === "--primary")?.values.light)
      .toBe("oklch(0.5 0.1 250)");
  });

  it("the committed manifest matches the current globals.css (the M5 gate, in miniature)", () => {
    const live = buildManifest(parseTokens(readFileSync(resolve("app/globals.css"), "utf8"))).json;
    const committed = JSON.parse(readFileSync(resolve("design-system.json"), "utf8"));
    expect(committed).toEqual(live);
  });
});
