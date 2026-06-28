// @vitest-environment node
import { describe, it, expect } from "vitest";
import { exportsOf } from "@/lib/catalog/exports";
import { checkCatalogFresh } from "@/lib/check/catalog-fresh";
import { buildCatalogMarkdown } from "@/lib/catalog/generate";
import { CATALOG } from "@/lib/catalog/registry";

describe("exportsOf", () => {
  it("picks Capitalized exports, ignores lowercase helpers", () => {
    expect(exportsOf(`export { Badge, badgeVariants }`).sort()).toEqual(["Badge"]);
    expect(exportsOf(`export function Card() {}`)).toEqual(["Card"]);
  });
});

describe("checkCatalogFresh", () => {
  const md = buildCatalogMarkdown(CATALOG);
  it("is green for the committed registry + fresh doc", () => {
    const files = CATALOG.map((e) => ({ path: e.file, content: e.exports.map((x) => `export function ${x}() {}`).join("\n") }));
    expect(checkCatalogFresh(files, md)).toEqual([]);
  });
  it("flags an unregistered export", () => {
    const files = [{ path: "components/ui/zzz.tsx", content: "export function Zzz() {}" }];
    expect(checkCatalogFresh(files, md).map((f) => f.rule)).toContain("catalog-fresh");
  });
  it("flags a stale doc", () => {
    const files = CATALOG.map((e) => ({ path: e.file, content: e.exports.map((x) => `export function ${x}() {}`).join("\n") }));
    expect(checkCatalogFresh(files, md + "drift").map((f) => f.rule)).toContain("catalog-fresh");
  });
});
