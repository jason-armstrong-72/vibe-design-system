// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WritebackQueue } from "@/lib/editor/use-token-writeback";

beforeEach(() => vi.useFakeTimers());

function makeQueue(fetchImpl: typeof fetch) {
  vi.stubGlobal("fetch", fetchImpl);
  const applied: Array<[string, string]> = [];
  const cleared: string[] = [];
  const q = new WritebackQueue({
    debounceMs: 250,
    setVar: (name, value) => applied.push([name, value]),
    clearVar: (name) => cleared.push(name),
    onStatus: vi.fn(),
  });
  return { q, applied, cleared };
}

describe("WritebackQueue", () => {
  it("previews immediately, persists once after debounce (same token coalesces)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }))) as unknown as typeof fetch;
    const { q, applied } = makeQueue(fetchMock);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--primary", value: "oklch(0.4 0 0)", theme: "light" });
    expect(applied.at(-1)).toEqual(["--primary", "oklch(0.4 0 0)"]);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("debounces per token — two different tokens both persist", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }))) as unknown as typeof fetch;
    const { q } = makeQueue(fetchMock);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--radius", value: "0.5rem", theme: "light" });
    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rolls back the preview to last-known-good on a rejected write", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: "bad" }), { status: 400 }),
    ) as unknown as typeof fetch;
    const { q, applied } = makeQueue(fetchMock);
    q.seed("--primary", "oklch(0.2 0 0)");
    q.edit({ name: "--primary", value: "oklch(0.9 0 0)", theme: "light" });
    await vi.advanceTimersByTimeAsync(250);
    expect(applied.at(-1)).toEqual(["--primary", "oklch(0.2 0 0)"]);
  });

  it("clearPreviews() clears every inline var it applied (via injected clearVar)", () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true })),
    ) as unknown as typeof fetch;
    const { q, cleared } = makeQueue(fetchMock);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--radius", value: "0.5rem", theme: "light" });
    q.clearPreviews();
    expect(cleared.sort()).toEqual(["--primary", "--radius"]);
    // Clearing twice does nothing the second time (applied set is emptied).
    cleared.length = 0;
    q.clearPreviews();
    expect(cleared).toEqual([]);
  });
});
