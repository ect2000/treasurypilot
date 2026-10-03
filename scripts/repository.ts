import { execFileSync } from "node:child_process";
// Use the already-configured Git credential helper; never display or persist its credential.
async function main() {
  const raw = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
  });
  const credential = Object.fromEntries(
    raw
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
  if (!credential.password)
    throw new Error("GitHub credential helper is not authenticated");
  const headers = {
    Authorization: `Bearer ${credential.password}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  let response = await fetch(
    "https://api.github.com/repos/ect2000/treasurypilot",
    { headers, redirect: "error" },
  );
  if (response.status === 404)
    response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "treasurypilot",
        description:
          "Adaptive treasury controller built with Airwallex Sandbox and free-only OpenRouter inference.",
        private: false,
      }),
      redirect: "error",
    });
  if (!response.ok)
    throw new Error(`GitHub repository access failed: HTTP ${response.status}`);
  let repo = await response.json();
  if (repo.private) {
    response = await fetch(
      "https://api.github.com/repos/ect2000/treasurypilot",
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          private: false,
          description: "Adaptive treasury controller · Airwallex Sandbox only",
        }),
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(
        `Cannot make requested repository public: HTTP ${response.status}`,
      );
    repo = await response.json();
  }
  console.log(
    JSON.stringify({
      repository: repo.html_url,
      public: !repo.private,
      defaultBranch: repo.default_branch,
    }),
  );
}
main().catch(() => {
  console.error(
    "GitHub setup could not complete with the existing credential helper. No credential was displayed.",
  );
  process.exitCode = 1;
});
