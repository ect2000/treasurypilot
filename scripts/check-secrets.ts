import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
      if (secrets.some((secret) => data.includes(secret)))
        violations.push(path);
    }
  }
}
walk(".");
walk(".next/static", true);
console.log(
  JSON.stringify({
    filesChecked: checked,
    secretLeaks: violations.length,
    ...(violations.length ? { affectedFiles: violations } : {}),
  }),
);
if (violations.length) process.exitCode = 1;
