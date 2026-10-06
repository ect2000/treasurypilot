import {
  get,
  put,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from "@vercel/blob";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// A bounded resource ledger, separate from permanent financial operation claims.
export const DEMO_LIMITS = Object.freeze({
  workspace: 64,
  observation: 600,
  interpretation: 80,
  proposal: 80,
  execution: 80,
  transition: 40,
});
type Resource = keyof typeof DEMO_LIMITS;
export const MAX_RETAINED_WORKSPACES = 128;
type Ledger = {
  day: string;
  used: Partial<Record<Resource, number>>;
  totalWorkspaces: number;
};
export class DemoLimit extends Error {
  constructor(message: string) {
    super(message);
  }
}
const blobPath = "governor/resource-budget.json";
function parse(text: string): Ledger {
  const value = JSON.parse(text) as Ledger;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.day) ||
    !value.used ||
    !Number.isSafeInteger(value.totalWorkspaces) ||
    value.totalWorkspaces < 0 ||
    Object.entries(value.used).some(
      ([key, count]) =>
        !Object.hasOwn(DEMO_LIMITS, key) ||
        !Number.isSafeInteger(count) ||
        count < 0,
    )
  )
    throw new DemoLimit("Resource budget is invalid. Work is stopped.");
  return value;
}
function reserve(
  previous: Ledger | undefined,
  resource: Resource,
  day: string,
): Ledger {
  // A CAS retry crossing midnight must never roll the ledger back to an older day.
  day = previous && previous.day > day ? previous.day : day;
  const ledger: Ledger =
    previous?.day === day
      ? structuredClone(previous)
      : { day, used: {}, totalWorkspaces: previous?.totalWorkspaces ?? 0 };
  if (
    resource === "workspace" &&
    ledger.totalWorkspaces >= MAX_RETAINED_WORKSPACES
  )
    throw new DemoLimit(
      "The retained demo workspace budget is full. Existing workspaces remain readable; financial claims are never reset.",
    );
  const count = ledger.used[resource] ?? 0;
  if (count >= DEMO_LIMITS[resource])
    throw new DemoLimit(
      `Sandbox demo ${resource} budget reached for this UTC day. Existing evidence remains available; no financial identity is reset.`,
    );
  ledger.used[resource] = count + 1;
  if (resource === "workspace") ledger.totalWorkspaces++;
  return ledger;
}
export async function admitDemoWork(resource: Resource, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const prior = await get(blobPath, {
        access: "private",
        useCache: false,
        headers: { "Accept-Encoding": "identity" },
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }).catch((error) => {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      });
      if (
        prior &&
        (prior.statusCode !== 200 ||
          !prior.stream ||
          !prior.blob.etag ||
          prior.blob.etag.startsWith("W/"))
      )
        throw new DemoLimit(
          "Strong resource budget version unavailable. Work is stopped.",
        );
      const next = reserve(
        prior ? parse(await new Response(prior.stream).text()) : undefined,
        resource,
        day,
      );
      try {
        await put(blobPath, JSON.stringify(next), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: Boolean(prior),
          ...(prior ? { ifMatch: prior.blob.etag } : {}),
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        return;
      } catch (error) {
        if (
          !(error instanceof BlobPreconditionFailedError) &&
          !/already exists/i.test(String(error))
        )
          throw error;
        if (attempt < 7)
          await new Promise((resolve) =>
            setTimeout(resolve, 25 * (attempt + 1)),
          );
      }
    }
    throw new DemoLimit(
      "Resource admission changed concurrently. Retry later; no provider work was started.",
    );
  }
  if (process.env.VERCEL)
    throw new DemoLimit(
      "Durable resource budget is not configured. Work is stopped.",
    );
  const dir = join(process.cwd(), ".operator", "governor");
  await mkdir(dir, { recursive: true });
  const lock = join(dir, "resource-budget-lock");
  let acquired = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await mkdir(lock);
      acquired = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  if (!acquired)
    throw new DemoLimit(
      "Resource admission is busy or uncertain. Work is stopped.",
    );
  try {
    const file = join(dir, "resource-budget.json");
    const previous = await readFile(file, "utf8")
      .then(parse)
      .catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return undefined;
        throw error;
      });
    const temporary = join(dir, `${randomUUID()}.budget.tmp`);
    try {
      await writeFile(
        temporary,
        JSON.stringify(reserve(previous, resource, day)),
        { flag: "wx" },
      );
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
  } finally {
    await rmdir(lock);
  }
}

export const WORLD_LIMITS = Object.freeze({
  revisions: 120,
  contexts: 8,
  plans: 32,
  approvals: 16,
  events: 512,
  bytes: 131072,
});
export function assertWorldCapacity(
  state: {
    revision: number;
    contexts: unknown[];
    plans: unknown[];
    approvals: unknown[];
    events: unknown[];
  },
  reserve = 0,
) {
  if (
    state.revision + reserve > WORLD_LIMITS.revisions ||
    state.contexts.length > WORLD_LIMITS.contexts ||
    state.plans.length + (reserve ? 1 : 0) > WORLD_LIMITS.plans ||
    state.approvals.length > WORLD_LIMITS.approvals ||
    state.events.length + (reserve ? 24 : 0) > WORLD_LIMITS.events ||
    Buffer.byteLength(JSON.stringify(state), "utf8") >
      WORLD_LIMITS.bytes - (reserve ? 16384 : 0)
  )
    throw new DemoLimit(
      "This demo workspace reached its retained-state limit. Export its evidence and use a fresh browser context; financial IDs and claims remain permanent.",
    );
}
