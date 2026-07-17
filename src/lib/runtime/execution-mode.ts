import { ProviderError } from "@/lib/providers/types";

export const executionModes = [
  "unit",
  "mock_e2e",
  "structure_benchmark",
  "replay",
  "live_probe",
  "live_corpus",
  "production",
] as const;

export type ExecutionMode = (typeof executionModes)[number];
export type EnvironmentLike = Record<string, string | undefined>;

export interface ExecutionContext {
  mode: ExecutionMode;
  allowLiveProvider: boolean;
  liveRunId?: string;
  liveLedgerPath?: string;
}

export const LIVE_PROVIDER_BLOCKED_CODE = "LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD";

function blocked(details: string): ProviderError {
  return new ProviderError(
    `${LIVE_PROVIDER_BLOCKED_CODE}: ${details}`,
    "invalid_request",
    false,
    403,
    LIVE_PROVIDER_BLOCKED_CODE,
  );
}

export function resolveExecutionMode(env: EnvironmentLike = process.env): ExecutionMode {
  const explicit = env.EOE_EXECUTION_MODE;
  if (explicit && executionModes.includes(explicit as ExecutionMode)) return explicit as ExecutionMode;
  return env.NODE_ENV === "test" ? "unit" : "production";
}

export function resolveExecutionContext(env: EnvironmentLike = process.env): ExecutionContext {
  return {
    mode: resolveExecutionMode(env),
    allowLiveProvider: env.EOE_ALLOW_LIVE_PROVIDER === "true",
    liveRunId: env.EOE_LIVE_RUN_ID?.trim() || undefined,
    liveLedgerPath: env.EOE_LIVE_LEDGER_PATH?.trim() || undefined,
  };
}

export function isLiveExecutionMode(mode: ExecutionMode): mode is "live_probe" | "live_corpus" {
  return mode === "live_probe" || mode === "live_corpus";
}

export function assertMockE2eEnvironment(env: EnvironmentLike = process.env): void {
  const context = resolveExecutionContext(env);
  if (context.mode !== "mock_e2e") throw blocked(`expected mock_e2e, received ${context.mode}`);
  if (env.USE_MOCK_PROVIDER !== "true") throw blocked("mock_e2e requires USE_MOCK_PROVIDER=true");
  if (context.allowLiveProvider) throw blocked("mock_e2e requires EOE_ALLOW_LIVE_PROVIDER=false");
}

export function buildMockE2eEnvironment(
  inherited: EnvironmentLike,
  identity: { runId: string; port: number; startedAt: string },
): EnvironmentLike {
  return {
    ...inherited,
    EOE_EXECUTION_MODE: "mock_e2e",
    USE_MOCK_PROVIDER: "true",
    EOE_ALLOW_LIVE_PROVIDER: "false",
    EOE_SERVER_PORT: String(identity.port),
    EOE_SERVER_RUN_ID: identity.runId,
    EOE_SERVER_STARTED_AT: identity.startedAt,
  };
}

export function assertLiveProviderAuthorization(env: EnvironmentLike = process.env): ExecutionContext & {
  mode: "live_probe" | "live_corpus";
  liveRunId: string;
  liveLedgerPath: string;
} {
  const context = resolveExecutionContext(env);
  if (!isLiveExecutionMode(context.mode)) throw blocked(`execution mode ${context.mode} is not live`);
  if (!context.allowLiveProvider) throw blocked("EOE_ALLOW_LIVE_PROVIDER=true is required");
  if (!context.liveRunId) throw blocked("EOE_LIVE_RUN_ID is required");
  if (!context.liveLedgerPath) throw blocked("EOE_LIVE_LEDGER_PATH is required");
  if (!env.GLM_API_KEY?.trim()) throw blocked("GLM_API_KEY is required");
  if (!env.DEEPSEEK_API_KEY?.trim()) throw blocked("DEEPSEEK_API_KEY is required");
  return {
    ...context,
    mode: context.mode,
    liveRunId: context.liveRunId,
    liveLedgerPath: context.liveLedgerPath,
  };
}

export function assertProductionProviderAuthorization(
  env: EnvironmentLike = process.env,
): ExecutionContext & { mode: "production" } {
  const context = resolveExecutionContext(env);
  if (context.mode !== "production") {
    throw blocked(`execution mode ${context.mode} is not production`);
  }
  if (env.USE_MOCK_PROVIDER !== "false") {
    throw blocked("production live providers require USE_MOCK_PROVIDER=false");
  }
  if (!context.allowLiveProvider) {
    throw blocked("production live providers require EOE_ALLOW_LIVE_PROVIDER=true");
  }
  if (!env.GLM_API_KEY?.trim()) throw blocked("GLM_API_KEY is required");
  if (!env.DEEPSEEK_API_KEY?.trim()) throw blocked("DEEPSEEK_API_KEY is required");
  return { ...context, mode: "production" };
}

export function liveProviderBlocked(details: string): ProviderError {
  return blocked(details);
}
