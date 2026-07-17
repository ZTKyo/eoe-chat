import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertLiveProviderAuthorization,
  assertMockE2eEnvironment,
  assertProductionProviderAuthorization,
  buildMockE2eEnvironment,
  LIVE_PROVIDER_BLOCKED_CODE,
  resolveExecutionMode,
} from "./execution-mode";

const baseLiveEnvironment = {
  EOE_EXECUTION_MODE: "live_probe",
  EOE_ALLOW_LIVE_PROVIDER: "true",
  EOE_LIVE_RUN_ID: "run-1",
  EOE_LIVE_LEDGER_PATH: "ledger.json",
  GLM_API_KEY: "test-glm-key",
  DEEPSEEK_API_KEY: "test-deepseek-key",
};

describe.sequential("execution mode fail-closed authorization", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults tests to unit mode", () => {
    expect(resolveExecutionMode({ NODE_ENV: "test" })).toBe("unit");
  });

  it("rejects live authorization when EOE_ALLOW_LIVE_PROVIDER is false", () => {
    expect(() =>
      assertLiveProviderAuthorization({ ...baseLiveEnvironment, EOE_ALLOW_LIVE_PROVIDER: "false" }),
    ).toThrow(LIVE_PROVIDER_BLOCKED_CODE);
  });

  it("rejects live authorization without a run ID", () => {
    expect(() =>
      assertLiveProviderAuthorization({ ...baseLiveEnvironment, EOE_LIVE_RUN_ID: "" }),
    ).toThrow(LIVE_PROVIDER_BLOCKED_CODE);
  });

  it("rejects live authorization without a ledger path", () => {
    expect(() =>
      assertLiveProviderAuthorization({ ...baseLiveEnvironment, EOE_LIVE_LEDGER_PATH: "" }),
    ).toThrow(LIVE_PROVIDER_BLOCKED_CODE);
  });

  it("rejects live authorization in a non-live execution mode", () => {
    expect(() =>
      assertLiveProviderAuthorization({ ...baseLiveEnvironment, EOE_EXECUTION_MODE: "replay" }),
    ).toThrow(LIVE_PROVIDER_BLOCKED_CODE);
  });

  it("accepts an explicitly identified live probe", () => {
    expect(assertLiveProviderAuthorization(baseLiveEnvironment)).toMatchObject({
      mode: "live_probe",
      liveRunId: "run-1",
      liveLedgerPath: "ledger.json",
    });
  });

  it("accepts an explicitly authorized production provider without a live ledger", () => {
    expect(assertProductionProviderAuthorization({
      EOE_EXECUTION_MODE: "production",
      EOE_ALLOW_LIVE_PROVIDER: "true",
      USE_MOCK_PROVIDER: "false",
      GLM_API_KEY: "test-glm-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
    })).toMatchObject({ mode: "production", allowLiveProvider: true });
  });

  it("keeps production live providers fail-closed by default", () => {
    expect(() => assertProductionProviderAuthorization({
      EOE_EXECUTION_MODE: "production",
      EOE_ALLOW_LIVE_PROVIDER: "false",
      USE_MOCK_PROVIDER: "false",
      GLM_API_KEY: "test-glm-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
    })).toThrow(LIVE_PROVIDER_BLOCKED_CODE);
  });

  it("requires mock_e2e to disable live providers", () => {
    expect(() =>
      assertMockE2eEnvironment({
        EOE_EXECUTION_MODE: "mock_e2e",
        USE_MOCK_PROVIDER: "true",
        EOE_ALLOW_LIVE_PROVIDER: "true",
      }),
    ).toThrow(LIVE_PROVIDER_BLOCKED_CODE);
  });

  it(".env.local-like inherited values cannot override the explicit mock environment", () => {
    const environment = buildMockE2eEnvironment(
      {
        USE_MOCK_PROVIDER: "false",
        EOE_ALLOW_LIVE_PROVIDER: "true",
        GLM_API_KEY: "test-glm-key",
        DEEPSEEK_API_KEY: "test-deepseek-key",
      },
      { runId: "mock-run", port: 3100, startedAt: "2026-01-01T00:00:00.000Z" },
    );
    expect(environment).toMatchObject({
      EOE_EXECUTION_MODE: "mock_e2e",
      USE_MOCK_PROVIDER: "true",
      EOE_ALLOW_LIVE_PROVIDER: "false",
      EOE_SERVER_RUN_ID: "mock-run",
      EOE_SERVER_PORT: "3100",
    });
    expect(() => assertMockE2eEnvironment(environment)).not.toThrow();
  });
});
