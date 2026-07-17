import { runIsolatedLive } from "./run-isolated-live.mjs";

const exitCode = await runIsolatedLive({
  mode: "live_probe",
  runPrefix: "m2-4-2-focused",
  port: 3200,
  ledgerPath: "artifacts/benchmarks/m2.4.2-focused-live-budget.json",
  limits: {
    requestBudget: 30,
    tokenBudget: 40_000,
    runtimeBudgetMs: 30 * 60_000,
  },
  enableVariable: "EOE_M2_4_2_FOCUSED_LIVE",
  testFile: "src/lib/providers/live-m2-4-1-focused.test.ts",
  resumeLedger: true,
  extraEnvironment: {
    EOE_M2_4_2_TARGETED_RETRY: "true",
  },
});

process.exitCode = exitCode;
