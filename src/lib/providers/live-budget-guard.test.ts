import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLiveBudgetLedger,
  LiveBudgetGuard,
  readLiveBudgetLedger,
  type LiveBudgetLimits,
} from "./live-budget-guard";
import type { ProviderRequest } from "./types";

const limits: LiveBudgetLimits = {
  requestBudget: 3,
  tokenBudget: 100,
  runtimeBudgetMs: 10_000,
};
const request: ProviderRequest = {
  messages: [{ role: "user", content: "test" }],
  attachments: [],
  requestId: "request-1",
  generationAttempt: 2,
  liveMetadata: {
    scenarioId: "scenario-1",
    conversationTurnId: "turn-1",
  },
};

describe.sequential("LiveBudgetGuard ledger", () => {
  let directory: string;
  let ledgerPath: string;
  let environment: Record<string, string>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "eoe-live-budget-"));
    ledgerPath = join(directory, "ledger.json");
    environment = {
      EOE_EXECUTION_MODE: "live_probe",
      EOE_ALLOW_LIVE_PROVIDER: "true",
      EOE_LIVE_RUN_ID: "run-1",
      EOE_LIVE_LEDGER_PATH: ledgerPath,
      GLM_API_KEY: "test-glm-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
    };
    await createLiveBudgetLedger({
      path: ledgerPath,
      runId: "run-1",
      executionMode: "live_probe",
      limits,
    });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("pre-registers an attempt before transport accounting", async () => {
    const handle = await new LiveBudgetGuard(environment).beforeRequest({
      provider: "glm",
      model: "glm-test",
      request,
    });
    const ledger = await readLiveBudgetLedger(ledgerPath);
    expect(ledger.requestCount).toBe(1);
    expect(ledger.attempts[0]).toMatchObject({
      id: handle.attemptId,
      requestId: "request-1",
      scenarioId: "scenario-1",
      conversationTurnId: "turn-1",
      attemptNumber: 2,
      outcome: "pending",
    });
  });

  it("updates token usage and latency after success", async () => {
    const guard = new LiveBudgetGuard(environment);
    const handle = await guard.beforeRequest({ provider: "glm", model: "glm-test", request });
    await guard.completeRequest({
      handle,
      httpStatus: 200,
      usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12 },
      latencyMs: 40,
    });
    const ledger = await readLiveBudgetLedger(ledgerPath);
    expect(ledger).toMatchObject({ requestCount: 1, tokenCount: 12, providerRuntimeMs: 40 });
    expect(ledger.attempts[0]).toMatchObject({ outcome: "success", httpStatus: 200 });
  });

  it("records normalized provider errors", async () => {
    const guard = new LiveBudgetGuard(environment);
    const handle = await guard.beforeRequest({ provider: "deepseek", model: "deepseek-test", request });
    await guard.failRequest({
      handle,
      httpStatus: 429,
      latencyMs: 20,
      errorCategory: "rate_limit",
    });
    expect((await readLiveBudgetLedger(ledgerPath)).attempts[0]).toMatchObject({
      outcome: "error",
      httpStatus: 429,
      errorCategory: "rate_limit",
    });
  });

  it("records timeouts as terminal attempts", async () => {
    const guard = new LiveBudgetGuard(environment);
    const handle = await guard.beforeRequest({ provider: "glm", model: "glm-test", request });
    await guard.failRequest({ handle, latencyMs: 99, errorCategory: "timeout" });
    expect((await readLiveBudgetLedger(ledgerPath)).attempts[0].outcome).toBe("timeout");
  });

  it("records cancellation as a terminal attempt", async () => {
    const guard = new LiveBudgetGuard(environment);
    const handle = await guard.beforeRequest({ provider: "glm", model: "glm-test", request });
    await guard.failRequest({ handle, latencyMs: 1, errorCategory: "cancelled" });
    expect((await readLiveBudgetLedger(ledgerPath)).attempts[0].outcome).toBe("cancelled");
  });

  it("stops before registering a request beyond the request budget", async () => {
    await createLiveBudgetLedger({
      path: ledgerPath,
      runId: "run-1",
      executionMode: "live_probe",
      limits: { ...limits, requestBudget: 1 },
    });
    const guard = new LiveBudgetGuard(environment);
    await guard.beforeRequest({ provider: "glm", model: "glm-test", request });
    await expect(
      guard.beforeRequest({
        provider: "glm",
        model: "glm-test",
        request: { ...request, requestId: "request-2" },
      }),
    ).rejects.toMatchObject({ providerCode: "LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD" });
    expect((await readLiveBudgetLedger(ledgerPath)).requestCount).toBe(1);
  });

  it("rejects a ledger whose run identity does not match", async () => {
    environment.EOE_LIVE_RUN_ID = "different-run";
    const guard = new LiveBudgetGuard(environment);
    await expect(
      guard.beforeRequest({ provider: "glm", model: "glm-test", request }),
    ).rejects.toMatchObject({ providerCode: "LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD" });
  });
});
