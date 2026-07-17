import { runIsolatedLive } from "./run-isolated-live.mjs";

const exitCode = await runIsolatedLive({
  mode: "live_probe",
  port: 3200,
  runPrefix: "m2-5-1-targeted",
  ledgerPath: "artifacts/benchmarks/m2.5.1-targeted-budget.json",
  enableVariable: "EOE_M2_5_1_LIVE",
  testFile: "src/lib/providers/live-m2-5-text-corpus.test.ts",
  imageInputEnabled: false,
  limits: {
    requestBudget: 20,
    tokenBudget: 35_000,
    runtimeBudgetMs: 30 * 60_000,
  },
});

process.exit(exitCode);
