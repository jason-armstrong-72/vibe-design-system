// tests/ui/no-hardcoded-color.test.ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { checkHardcodedColor } from "@/lib/check/hardcoded-color";

const FILES = ["avatar", "badge", "separator", "code"].map((n) => `components/ui/${n}.tsx`);

describe("new ui primitives are token-only (no hardcoded colors)", () => {
  for (const f of FILES) {
    it(f, () => {
      expect(checkHardcodedColor(f, readFileSync(resolve(f), "utf8"))).toEqual([]);
    });
  }
});
