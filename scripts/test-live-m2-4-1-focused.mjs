import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, "$2").trim();
  }
}

if (!process.env.GLM_API_KEY?.trim() || !process.env.DEEPSEEK_API_KEY?.trim() || process.env.USE_MOCK_PROVIDER !== "false") {
  console.error("M2.4.1 Focused Probe not executed: credentials are missing or USE_MOCK_PROVIDER is not false.");
  process.exit(1);
}

const budgetPath = join(process.cwd(), "artifacts", "benchmarks", "m2.4.1-focused-budget.json");
if (existsSync(budgetPath)) {
  console.error("M2.4.1 Focused Probe budget ledger already exists. Refusing to reset or spend a second cycle automatically.");
  process.exit(1);
}

const vitest = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [
  vitest,
  "run",
  "src/lib/providers/live-m2-4-1-focused.test.ts",
  "--reporter=verbose",
], {
  cwd: process.cwd(),
  env: { ...process.env, EOE_M2_4_1_FOCUSED_LIVE: "true" },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
