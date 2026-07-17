import { runIsolatedLive } from "./run-isolated-live.mjs";

const exitCode = await runIsolatedLive({
  mode: "live_corpus",
  port: 3201,
  runPrefix: "m2-5-text-corpus",
  ledgerPath: "artifacts/benchmarks/m2.5-text-corpus-budget.json",
  enableVariable: "EOE_M2_5_TEXT_CORPUS_LIVE",
  testFile: "src/lib/providers/live-m2-5-text-corpus.test.ts",
  imageInputEnabled: false,
  limits: {
    requestBudget: 100,
    tokenBudget: 150_000,
    runtimeBudgetMs: 90 * 60_000,
  },
});

process.exit(exitCode);
