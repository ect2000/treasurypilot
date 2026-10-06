import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { get, put } from "@vercel/blob";
import {
  admitDemoWork,
  assertWorldCapacity,
  DEMO_LIMITS,
  MAX_RETAINED_WORKSPACES,
} from "../lib/server/demo-limits";
const memory = vi.hoisted(() => ({
  body: undefined as string | undefined,
  seq: 0,
}));
vi.mock("@vercel/blob", () => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    get: vi.fn(async () =>
      memory.body
        ? {
            statusCode: 200,
            stream: new Response(memory.body).body,
            blob: { etag: String(memory.seq) },
          }
        : null,
    ),
    put: vi.fn(
      async (
        _path: string,
        body: string,
        options: { ifMatch?: string; allowOverwrite?: boolean },
      ) => {
        if (
          (options.ifMatch && options.ifMatch !== String(memory.seq)) ||
          (memory.body && !options.allowOverwrite)
        )
          throw new BlobPreconditionFailedError();
        memory.body = body;
        memory.seq++;
        return {};
      },
    ),
  };
});
beforeEach(() => {
  memory.body = undefined;
  memory.seq = 0;
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "fixture-only");
});
afterEach(() => vi.unstubAllEnvs());
it("uses one fixed durable ledger across concurrency and daily rollover without resetting lifetime admission", async () => {
  const first = new Date("2026-10-06T00:00:00Z"),
    next = new Date("2026-10-07T00:00:00Z");
  await Promise.all([
    admitDemoWork("workspace", first),
    admitDemoWork("workspace", first),
  ]);
  expect(JSON.parse(memory.body!).totalWorkspaces).toBe(2);
  await admitDemoWork("workspace", next);
  expect(JSON.parse(memory.body!)).toEqual({
    day: "2026-10-07",
    used: { workspace: 1 },
    totalWorkspaces: 3,
  });
  expect(new Set(vi.mocked(put).mock.calls.map((call) => call[0])).size).toBe(
    1,
  );
  expect(get).toHaveBeenCalledWith(
    "governor/resource-budget.json",
    expect.objectContaining({
      useCache: false,
      headers: { "Accept-Encoding": "identity" },
    }),
  );
});
it("rejects daily and lifetime exhaustion without writes or additional retained budget objects", async () => {
  const day = new Date("2026-10-06T00:00:00Z");
  memory.body = JSON.stringify({
    day: "2026-10-06",
    used: { interpretation: DEMO_LIMITS.interpretation },
    totalWorkspaces: 1,
  });
  await expect(admitDemoWork("interpretation", day)).rejects.toThrow(
    /budget reached/,
  );
  memory.body = JSON.stringify({
    day: "2026-10-05",
    used: {},
    totalWorkspaces: MAX_RETAINED_WORKSPACES,
  });
  await expect(admitDemoWork("workspace", day)).rejects.toThrow(
    /retained demo workspace budget/,
  );
  expect(put).not.toHaveBeenCalled();
});
it("never resets a newer day when a pre-midnight admission resumes after midnight", async () => {
  memory.body = JSON.stringify({
    day: "2026-10-07",
    used: { observation: DEMO_LIMITS.observation },
    totalWorkspaces: 1,
  });
  await expect(
    admitDemoWork("observation", new Date("2026-10-06T23:59:59Z")),
  ).rejects.toThrow(/budget reached/);
  expect(put).not.toHaveBeenCalled();
});
it("fails closed on missing deployed storage, weak versions and malformed ledgers", async () => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("VERCEL", "1");
  await expect(admitDemoWork("workspace")).rejects.toThrow(/not configured/);
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "fixture-only");
  vi.mocked(get).mockResolvedValueOnce({
    statusCode: 200,
    stream: new Response("{}").body,
    blob: { etag: 'W/"weak"' },
  } as unknown as Awaited<ReturnType<typeof get>>);
  await expect(admitDemoWork("workspace")).rejects.toThrow(
    /Strong resource budget/,
  );
  memory.body = JSON.stringify({
    day: "2026-10-06",
    used: { unknown: 1 },
    totalWorkspaces: 0,
  });
  await expect(admitDemoWork("workspace")).rejects.toThrow(/invalid/);
});
it("caps retained aggregates and reserves execution/reconciliation headroom", () => {
  const state = {
    revision: 1,
    contexts: [],
    plans: [],
    approvals: [],
    events: [],
  };
  expect(() => assertWorldCapacity(state, 20)).not.toThrow();
  expect(() => assertWorldCapacity({ ...state, revision: 101 }, 20)).toThrow(
    /retained-state limit/,
  );
  expect(() =>
    assertWorldCapacity({ ...state, contexts: Array(9).fill({}) }),
  ).toThrow();
  expect(() =>
    assertWorldCapacity({
      ...state,
      events: [{ message: "x".repeat(131072) }],
    }),
  ).toThrow();
});
