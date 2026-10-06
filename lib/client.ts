import type { GovernorView } from "./governor/types";
import type { Command } from "./server/governor";
async function request(command?: Command): Promise<GovernorView> {
  const response = await fetch("/api/governor", {
    method: command ? "POST" : "GET",
    cache: "no-store",
    headers: command ? { "Content-Type": "application/json" } : {},
    body: command ? JSON.stringify(command) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "The plan changed in another request. Refresh before continuing."
        : (data.error ?? "Treasury state unavailable"),
    );
  return data;
}
let activeRead: Promise<GovernorView> | undefined;
export function treasuryApi(command?: Command): Promise<GovernorView> {
  if (command) return request(command);
  // React's development remounts share one identity creation; later reads are always fresh.
  activeRead ??= request().finally(() => {
    activeRead = undefined;
  });
  return activeRead;
}
