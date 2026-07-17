import { runIsolatedLive } from "./run-isolated-live.mjs";

const exitCode = await runIsolatedLive({
  mode: "live_probe",
  port: 3200,
  runPrefix: "m2-5-1-targeted-retry-typescript",
  ledgerPath: "artifacts/benchmarks/m2.5.1-targeted-retry-typescript-budget.json",
  enableVariable: "EOE_M2_5_1_LIVE",
  testFile: "src/lib/providers/live-m2-5-text-corpus.test.ts",
  imageInputEnabled: false,
  extraEnvironment: {
    EOE_M2_5_1_CASE_IDS: "core-technical-typescript",
    EOE_M2_5_1_EVIDENCE_PREFIX: "m2.5.1-targeted-retry-typescript",
  },
  limits: {
    requestBudget: 4,
    tokenBudget: 8_000,
    runtimeBudgetMs: 10 * 60_000,
  },
});

process.exit(exitCode);
