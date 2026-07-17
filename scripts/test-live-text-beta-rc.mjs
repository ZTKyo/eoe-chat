import { runIsolatedLive } from "./run-isolated-live.mjs";

const exitCode = await runIsolatedLive({
  mode: "live_corpus",
  port: 3201,
  runPrefix: "text-beta-rc",
  ledgerPath: "artifacts/benchmarks/text-beta-rc-live-budget.json",
  enableVariable: "EOE_TEXT_BETA_RC_LIVE",
  testFile: "src/lib/providers/live-text-beta-rc.test.ts",
  imageInputEnabled: false,
  limits: {
    requestBudget: 50,
    tokenBudget: 80_000,
    runtimeBudgetMs: 45 * 60_000,
  },
});

process.exitCode = exitCode;
