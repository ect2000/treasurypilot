import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const names = [
  "AIRWALLEX_CLIENT_ID",
  "AIRWALLEX_API_KEY",
  "OPENROUTER_API_KEY",
  "AUTHORIZATION_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "VERCEL_OIDC_TOKEN",
];
const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
const secrets = names
  .map((name) =>
    lines
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1)
      .trim()
      .replace(/^"|"$/g, ""),
  )
  .filter((value): value is string => Boolean(value && value.length > 8));
const excluded = new Set([
  ".git",
  "node_modules",
  ".vercel",
  ".next",
  ".operator",
  "test-results",
  "playwright-report",
]);
const violations: string[] = [];
let checked = 0;
let historyBytes = 0;
let publicAssetsChecked = 0;
const credentialPatterns = [
  /sk-or-v1-[a-f0-9]{64}/i,
  /vercel_blob_rw_[A-Za-z0-9_]{24,}/,
  /["'][a-f0-9]{96}["']/i,
];
function containsCredential(data: string) {
  return (
    secrets.some((secret) => data.includes(secret)) ||
    credentialPatterns.some((pattern) => pattern.test(data))
  );
}
function walk(dir: string, client = false) {
  for (const name of readdirSync(dir)) {
    if (
      (!client && excluded.has(name)) ||
      name.startsWith(".env") ||
      name.endsWith(".tsbuildinfo")
    )
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, client);
    else if (!/\.(png|jpg|woff2|ico)$/.test(path)) {
      const data = readFileSync(path, "utf8");
      checked++;
      if (containsCredential(data)) violations.push(path);
    }
  }
}
walk(".");
walk(".next/static", true);
if (process.argv.includes("--history")) {
  const history = execFileSync(
    "git",
    ["log", "--all", "--format=", "--patch", "--no-ext-diff", "--no-textconv"],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  historyBytes = Buffer.byteLength(history);
  if (containsCredential(history))
    violations.push("Git history (no credential snippets emitted)");
}
const remote = process.env.VERIFY_URL;
if (remote) {
  const origin = new URL(remote).origin;
  const assets = new Set<string>();
  for (const path of ["/", "/treasury", "/treasury/v1"]) {
    const response = await fetch(new URL(path, origin), { redirect: "error" });
    if (!response.ok)
      throw new Error(`Public page scan failed: HTTP ${response.status}`);
    const html = await response.text();
    publicAssetsChecked++;
    if (containsCredential(html)) violations.push(`Public HTML ${path}`);
    for (const match of html.matchAll(/src="([^"\s]+\.js[^"\s]*)"/g)) {
      const url = new URL(match[1], origin);
      if (url.origin === origin) assets.add(url.href);
    }
  }
  for (const asset of assets) {
    const response = await fetch(asset, { redirect: "error" });
    if (!response.ok)
      throw new Error(`Public script scan failed: HTTP ${response.status}`);
    publicAssetsChecked++;
    if (containsCredential(await response.text()))
      violations.push(new URL(asset).pathname);
  }
}
console.log(
  JSON.stringify({
    filesChecked: checked,
    historyBytesChecked: historyBytes,
    publicAssetsChecked,
    secretLeaks: violations.length,
    ...(violations.length ? { affectedFiles: violations } : {}),
  }),
);
if (violations.length) process.exitCode = 1;
