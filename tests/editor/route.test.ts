import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const GLOBALS = `:root { --z-modal: 1300; }\n.dark { }\n`;
let dir: string, file: string, prevEnv: string | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ds-")); file = join(dir, "globals.css"); writeFileSync(file, GLOBALS);
  prevEnv = process.env.DS_GLOBALS_PATH; process.env.DS_GLOBALS_PATH = file;
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => {
  process.env.DS_GLOBALS_PATH = prevEnv; vi.unstubAllEnvs(); rmSync(dir, { recursive: true });
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/ds/token/route");
  return POST(new Request("http://x/api/ds/token", { method: "POST", body: JSON.stringify(body) }));
};

describe("POST /api/ds/token", () => {
  it("writes a valid edit and returns ok", async () => {
    const res = await post({ token: "--z-modal", value: "1500", theme: "light" });
    expect(res.status).toBe(200);
    expect(readFileSync(file, "utf8")).toContain("--z-modal: 1500");
  });
  it("rejects an unknown token with 400 and no write", async () => {
    const res = await post({ token: "--nope", value: "1", theme: "light" });
    expect(res.status).toBe(400);
    expect(readFileSync(file, "utf8")).toBe(GLOBALS);
  });
  it("rejects an injection value with 400", async () => {
    const res = await post({ token: "--z-modal", value: "1;}body{x:y", theme: "light" });
    expect(res.status).toBe(400);
  });
  it("is a no-op (404) in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await post({ token: "--z-modal", value: "1500", theme: "light" });
    expect(res.status).toBe(404);
  });
});
