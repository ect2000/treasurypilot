import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const content = readFileSync(".env.local", "utf8");
const names = [
  "AIRWALLEX_BASE_URL",
  "AIRWALLEX_CLIENT_ID",
  "AIRWALLEX_API_KEY",
  "OPENROUTER_API_KEY",
  "LLM_MODEL",
  "LLM_FALLBACK_MODEL",
  "AUTHORIZATION_SECRET",
  "EXECUTION_CAMPAIGN",
  "EXECUTION_ENABLED_UNTIL",
];
for (const name of names) {
  const line = content
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${name}=`));
  const value = line
    ?.slice(name.length + 1)
    .trim()
    .replace(/^"|"$/g, "");
  if (!value) throw new Error(`${name} is not configured locally`);
  const result = spawnSync(
    "vercel.cmd",
    ["env", "add", name, "production", "--yes", "--force"],
    { input: value, encoding: "utf8", shell: true },
  );
  // CLI output is deliberately suppressed because it may include sensitive diagnostics.
  console.log(
    `${name}: ${result.status === 0 ? "configured on Vercel" : "configuration failed"}`,
  );
  if (result.status !== 0) process.exit(1);
}
