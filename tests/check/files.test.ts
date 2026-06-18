import { describe, it, expect } from "vitest";
import { walkSource } from "@/lib/check/files";

describe("walkSource", () => {
  it("collects matching files recursively, skips excluded dirs and non-matching exts", () => {
    const files = walkSource(["tests/check/__fixtures__"], [".tsx"], { excludeDirs: ["skip"] });
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      "tests/check/__fixtures__/a.tsx",
      "tests/check/__fixtures__/nested/b.tsx",
    ]);
  });

  it("honors excludeFiles (repo-relative posix paths)", () => {
    const files = walkSource(["tests/check/__fixtures__"], [".tsx"], {
      excludeDirs: ["skip"],
      excludeFiles: ["tests/check/__fixtures__/a.tsx"],
    });
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual(["tests/check/__fixtures__/nested/b.tsx"]);
  });

  it("returns content for each file", () => {
    const files = walkSource(["tests/check/__fixtures__"], [".tsx"], { excludeDirs: ["skip"] });
    const a = files.find((f) => f.path.endsWith("a.tsx"));
    expect(a?.content).toContain("export const A");
  });
});
