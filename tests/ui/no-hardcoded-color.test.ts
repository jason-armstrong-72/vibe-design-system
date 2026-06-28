// tests/ui/no-hardcoded-color.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const FILES = readdirSync(resolve("components/ui"))
  .filter((n) => n.endsWith(".tsx"))
  .map((n) => `components/ui/${n}`);

describe("all ui primitives are token-only (no hardcoded colors)", () => {
  for (const f of FILES) {
    it(f, () => {
      expect(checkHardcodedColor(f, readFileSync(resolve(f), "utf8"))).toEqual([]);
    });
  }
});
