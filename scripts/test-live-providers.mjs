import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/u, "$2").trim();
    process.env[match[1]] = value;
  }
}

const credentialsPresent = Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim());
if (!credentialsPresent || process.env.USE_MOCK_PROVIDER !== "false") {
  console.log("SKIPPED — missing user credentials");
  process.exit(0);
}

const vitest = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitest, "run", "src/lib/providers/live-provider-template.test.ts", "--reporter=verbose"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
