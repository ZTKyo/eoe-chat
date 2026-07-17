import { runIsolatedLive } from "./run-isolated-live.mjs";

const targetIds = process.env.EOE_TEXT_BETA_RC_FINAL_TARGET_IDS?.trim();
if (!targetIds) {
  throw new Error(
    "EOE_TEXT_BETA_RC_FINAL_TARGET_IDS is required for the one allowed targeted retry",
  );
}

const exitCode = await runIsolatedLive({
  mode: "live_probe",
  port: 3201,
  runPrefix: "text-beta-rc-final",
  ledgerPath: "artifacts/benchmarks/text-beta-rc-final-budget.json",
  enableVariable: "EOE_TEXT_BETA_RC_FINAL_LIVE",
  testFile: "src/lib/providers/live-text-beta-rc-final.test.ts",
  imageInputEnabled: false,
  resumeLedger: true,
  extraEnvironment: {
    EOE_TEXT_BETA_RC_FINAL_TARGETED_RETRY: "true",
    EOE_TEXT_BETA_RC_FINAL_TARGET_IDS: targetIds,
  },
  limits: {
    requestBudget: 12,
    tokenBudget: 20_000,
    runtimeBudgetMs: 15 * 60_000,
  },
});

process.exitCode = exitCode;

