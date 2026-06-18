import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkManifestFresh } from "@/lib/check/manifest-fresh";

const globals = readFileSync(resolve("app/globals.css"), "utf8");
const json = readFileSync(resolve("design-system.json"), "utf8");
const md = readFileSync(resolve("design-system.md"), "utf8");

describe("manifest-fresh", () => {
  it("passes when the committed manifest matches globals", () => {
    expect(checkManifestFresh(globals, json, md)).toEqual([]);
  });
  it("flags a stale json", () => {
    const f = checkManifestFresh(globals, json.replace(/"name"/, '"NAME"'), md);
    expect(f.some((x) => x.rule === "manifest-fresh")).toBe(true);
  });
});
