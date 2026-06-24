// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { atomicWriteFileSync } from "@/lib/fs/atomic-write";

const P = "tmp-atomic-test.txt";
afterEach(() => { for (const f of [P, `${P}.tmp`]) if (existsSync(f)) rmSync(f); });

describe("atomicWriteFileSync", () => {
  it("writes content and leaves no temp file", () => {
    atomicWriteFileSync(P, "hello");
    expect(readFileSync(P, "utf8")).toBe("hello");
    expect(existsSync(`${P}.tmp`)).toBe(false);
  });
});
