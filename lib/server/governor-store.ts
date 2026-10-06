import {
  get,
  put,
  BlobNotFoundError,
  BlobPreconditionFailedError,
} from "@vercel/blob";
import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  link,
  unlink,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { GovernorState } from "../governor/types";

export class StateConflict extends Error {
  constructor() {
    super(
      "Context changed concurrently. Refresh the current plan before continuing.",
    );
  }
}
function validateId(id: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id))
    throw new Error("Invalid workspace identity");
}
export function persistenceMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "PRIVATE_BLOB" as const;
  if (process.env.VERCEL)
    throw new Error(
      "Durable private storage is not configured. Actions are stopped.",
    );
  return "LOCAL_REVISIONS" as const;
}
type Stored = { state: GovernorState; etag?: string };
export async function loadWorld(id: string): Promise<Stored | undefined> {
  validateId(id);
  if (persistenceMode() === "PRIVATE_BLOB") {
    try {
      const result = await get(`governor/worlds/${id}.json`, {
        access: "private",
        useCache: false,
        // Compression can produce a weak HTTP ETag, which cannot authorize an If-Match write.
        headers: { "Accept-Encoding": "identity" },
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (!result) return undefined;
      if (result.statusCode !== 200 || !result.stream)
        throw new Error("Could not read durable financial context");
      const state = JSON.parse(
        await new Response(result.stream).text(),
      ) as GovernorState;
      if (state.schema !== 2 || state.id !== id)
        throw new Error("Invalid financial context schema");
      if (!result.blob.etag || result.blob.etag.startsWith("W/"))
        throw new Error(
          "Strong storage version unavailable. Actions are stopped.",
        );
      return { state, etag: result.blob.etag };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return undefined;
      throw error;
    }
  }
  const dir = join(process.cwd(), ".operator", "governor", id);
  try {
    const files = (await readdir(dir))
      .filter((n) => /^\d{8}\.json$/.test(n))
      .sort();
    if (!files.length) return undefined;
    return {
      state: JSON.parse(await readFile(join(dir, files.at(-1)!), "utf8")),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
export async function saveWorld(state: GovernorState, previous?: Stored) {
  validateId(state.id);
  if (state.revision !== (previous?.state.revision ?? 0) + 1)
    throw new StateConflict();
  const payload = JSON.stringify(state);
  if (persistenceMode() === "PRIVATE_BLOB") {
    try {
      await put(`governor/worlds/${state.id}.json`, payload, {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: Boolean(previous),
        ...(previous ? { ifMatch: previous.etag } : {}),
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (error) {
      if (
        error instanceof BlobPreconditionFailedError ||
        /already exists/i.test(String(error))
      ) {
        console.warn(
          JSON.stringify({
            event: "STATE_WRITE_CONFLICT",
            workspace_id: state.id,
            revision: state.revision,
            error_type:
              error instanceof Error ? error.constructor.name : "Unknown",
          }),
        );
        throw new StateConflict();
      }
      throw error;
    }
  } else {
    const dir = join(process.cwd(), ".operator", "governor", state.id);
    await mkdir(dir, { recursive: true });
    const temporary = join(dir, `${randomUUID()}.tmp`);
    await writeFile(temporary, payload, { flag: "wx" });
    try {
      // Publish a complete immutable revision atomically; readers never observe a partial JSON file.
      await link(
        temporary,
        join(dir, `${String(state.revision).padStart(8, "0")}.json`),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new StateConflict();
      throw error;
    } finally {
      await unlink(temporary);
    }
  }
}
// Permanent single-operation claim: response loss leaves an uncertain claim, never a new payment ID.
export async function claimOperation(
  requestId: string,
  payloadFingerprint: string,
) {
  validateId(requestId);
  const payload = JSON.stringify({
    requestId,
    payloadFingerprint,
    claimedAt: new Date().toISOString(),
    state: "CLAIMED_OR_UNCERTAIN",
  });
  if (persistenceMode() === "PRIVATE_BLOB") {
    try {
      await put(`governor/operations/${requestId}.json`, payload, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch {
      throw new Error(
        "Operation already claimed or storage uncertain. Reconcile the original request ID; no financial retry was sent.",
      );
    }
  } else {
    const dir = join(process.cwd(), ".operator", "governor", "operations");
    await mkdir(dir, { recursive: true });
    try {
      await writeFile(join(dir, `${requestId}.json`), payload, { flag: "wx" });
    } catch {
      throw new Error(
        "Operation already claimed or storage uncertain. Reconcile the original request ID; no financial retry was sent.",
      );
    }
  }
}
