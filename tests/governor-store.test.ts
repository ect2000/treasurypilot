import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { initializeWorld } from "../lib/server/governor";
import {
  loadWorld,
  saveWorld,
  claimOperation,
  StateConflict,
} from "../lib/server/governor-store";
import { verifiedSnapshot } from "./fixtures/governor";
import { get } from "@vercel/blob";
const memory = vi.hoisted(() => ({
  blobs: new Map<string, { body: string; etag: string }>(),
  seq: 0,
}));
vi.mock("@vercel/blob", () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    get: vi.fn(async (path: string) => {
      const blob = memory.blobs.get(path);
      return blob
        ? {
            statusCode: 200,
            stream: new Response(blob.body).body,
            blob: { etag: blob.etag },
          }
        : null;
    }),
    put: vi.fn(
      async (
        path: string,
        body: string,
        options: { ifMatch?: string; allowOverwrite?: boolean },
      ) => {
        const prior = memory.blobs.get(path);
        if (options.ifMatch && prior?.etag !== options.ifMatch)
          throw new BlobPreconditionFailedError();
        if (prior && !options.allowOverwrite && !options.ifMatch)
          throw new Error("already exists");
        const etag = String(++memory.seq);
        memory.blobs.set(path, { body, etag });
        return { etag };
      },
    ),
  };
});
beforeEach(() => {
  memory.blobs.clear();
  memory.seq = 0;
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "unit-test-only");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("durable world concurrency", () => {
  it("round-trips the full aggregate without frontend state", async () => {
    const world = initializeWorld("test-world-1", verifiedSnapshot());
    await saveWorld(world);
    const loaded = await loadWorld(world.id);
    expect(loaded!.state.plans).toEqual(world.plans);
    expect(loaded!.state.operations).toHaveLength(3);
    expect(loaded!.state.receivables).toHaveLength(2);
    expect(loaded!.state.obligations).toHaveLength(5);
    expect(get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        useCache: false,
        headers: { "Accept-Encoding": "identity" },
      }),
    );
  });
  it("stops when a compressed response supplies a weak storage version", async () => {
    const state = initializeWorld("test-world-weak", verifiedSnapshot());
    vi.mocked(get).mockResolvedValueOnce({
      statusCode: 200,
      stream: new Response(JSON.stringify(state)).body,
      blob: { etag: 'W/"compressed"' },
    } as unknown as Awaited<ReturnType<typeof get>>);
    await expect(loadWorld(state.id)).rejects.toThrow(
      /Strong storage version unavailable/,
    );
  });
  it("accepts only one concurrent update for an observed revision", async () => {
    const world = initializeWorld("test-world-2", verifiedSnapshot());
    await saveWorld(world);
    const base = (await loadWorld(world.id))!;
    const a = { ...structuredClone(base.state), revision: 2 },
      b = { ...structuredClone(base.state), revision: 2 };
    const results = await Promise.allSettled([
      saveWorld(a, base),
      saveWorld(b, base),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(StateConflict);
  });
  it("keeps a permanent claim after response loss and rejects reuse or changed payload", async () => {
    await claimOperation("campaign-operation-1", "amount-corridor-hash");
    await expect(
      claimOperation("campaign-operation-1", "amount-corridor-hash"),
    ).rejects.toThrow(/already claimed/);
    await expect(
      claimOperation("campaign-operation-1", "changed-amount"),
    ).rejects.toThrow(/already claimed/);
    expect(memory.blobs.size).toBe(1);
  });
  it("does not fall back to ephemeral storage when deployed storage is missing", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "1");
    await expect(loadWorld("test-world-3")).rejects.toThrow(
      /Durable private storage/,
    );
  });
});
