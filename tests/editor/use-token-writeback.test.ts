// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WritebackQueue } from "@/lib/editor/use-token-writeback";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// A fetch mock that records the parsed POST bodies (the existing mocks ignore args).
function capturingFetch(ok = true, status = 200) {
  const bodies: Array<{ token: string; value: string; theme: string }> = [];
  const fn = vi.fn(async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify(ok ? { ok: true } : { error: "bad" }), { status });
  }) as unknown as typeof fetch;
  return { fn, bodies };
}

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
    q.seed("--primary", "light", "oklch(0.2 0 0)");
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

  it("cross-block: same token in light then dark within the debounce → BOTH writes POST", async () => {
    const { fn, bodies } = capturingFetch();
    const { q } = makeQueue(fn);
    q.edit({ name: "--primary", value: "L", theme: "light" });
    q.edit({ name: "--primary", value: "D", theme: "dark" }); // within debounce — must NOT overwrite light
    await vi.advanceTimersByTimeAsync(250);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(bodies).toEqual(
      expect.arrayContaining([
        { token: "--primary", value: "L", theme: "light" },
        { token: "--primary", value: "D", theme: "dark" },
      ]),
    );
  });

  it("same token + same block coalesces to ONE POST carrying the LAST value", async () => {
    const { fn, bodies } = capturingFetch();
    const { q } = makeQueue(fn);
    q.edit({ name: "--primary", value: "oklch(0.3 0 0)", theme: "light" });
    q.edit({ name: "--primary", value: "oklch(0.4 0 0)", theme: "light" });
    await vi.advanceTimersByTimeAsync(250);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(bodies[0]).toEqual({ token: "--primary", value: "oklch(0.4 0 0)", theme: "light" });
  });

  it("cross-block rollback reverts to THAT block's last-good (lastGood is per-block)", async () => {
    const { fn } = capturingFetch(false, 400);
    const { q, applied } = makeQueue(fn);
    q.seed("--primary", "dark", "oklch(0.8 0 0)"); // dark's last-good
    q.edit({ name: "--primary", value: "oklch(0.5 0 0)", theme: "dark" }); // will 400
    await vi.advanceTimersByTimeAsync(250);
    expect(applied.at(-1)).toEqual(["--primary", "oklch(0.8 0 0)"]); // reverted to dark good, not undefined
  });

  it("a failed cross-block flush's rollback re-adds to applied so clearPreviews reclaims it (no leak)", async () => {
    const { fn } = capturingFetch(false, 400);
    const { q, cleared } = makeQueue(fn);
    q.seed("--primary", "light", "oklch(0.2 0 0)");
    q.edit({ name: "--primary", value: "oklch(0.9 0 0)", theme: "light" });
    q.clearPreviews(); // simulate block switch BEFORE the flush — empties applied
    await vi.advanceTimersByTimeAsync(250); // flush fails → rollback setVar + re-add to applied
    cleared.length = 0; // ISOLATE the next clear — only it is sensitive to the applied.add re-arm
    q.clearPreviews();
    expect(cleared).toContain("--primary"); // reclaimable ONLY if rollback re-added it
  });
});
