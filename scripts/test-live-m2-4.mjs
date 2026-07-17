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
  console.error("M2.4 Live validation not executed: credentials are missing or USE_MOCK_PROVIDER is not false.");
  process.exit(1);
}

const budgetPath = join(process.cwd(), "artifacts", "benchmarks", "m2.4-live-budget.json");
const repairCycle = Number(process.env.EOE_M2_4_REPAIR_CYCLE ?? "1");
if (![1, 2].includes(repairCycle)) {
  console.error("EOE_M2_4_REPAIR_CYCLE must be 1 or 2.");
  process.exit(1);
}
if (repairCycle === 1 && existsSync(budgetPath)) {
  console.error("M2.4 Live budget ledger already exists. Refusing to reset the bounded budget automatically.");
  process.exit(1);
}
if (repairCycle === 2 && !existsSync(budgetPath)) {
  console.error("M2.4 repair cycle 2 requires the preserved cycle 1 budget ledger.");
  process.exit(1);
}

const vitest = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(
  process.execPath,
  [vitest, "run", "src/lib/providers/live-m2-4.test.ts", "--reporter=verbose"],
  {
    cwd: process.cwd(),
    env: { ...process.env, EOE_M2_4_LIVE: "true", EOE_M2_4_REPAIR_CYCLE: String(repairCycle) },
    stdio: "inherit",
  },
);
process.exit(result.status ?? 1);
