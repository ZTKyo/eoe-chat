import {
  assertMockE2eEnvironment,
  resolveExecutionContext,
  type EnvironmentLike,
  type ExecutionMode,
} from "./execution-mode";
import { getNativeLiveRequestCount } from "./live-request-monitor";

export interface ServerIdentity {
  executionMode: ExecutionMode;
  runId: string;
  pid: number;
  port: number;
  providerMode: "MockProvider" | "LiveProvider" | "Blocked";
  startTimestamp: string;
  liveRequests: number;
}

const startedAt = new Date().toISOString();

export function serverIdentityFromEnvironment(
  env: EnvironmentLike = process.env,
  pid = process.pid,
): ServerIdentity {
  const context = resolveExecutionContext(env);
  if (context.mode === "mock_e2e") assertMockE2eEnvironment(env);
  const port = Number(env.EOE_SERVER_PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("EOE_SERVER_PORT must be a positive integer.");
  }
  return {
    executionMode: context.mode,
    runId: env.EOE_SERVER_RUN_ID?.trim() || context.liveRunId || "unassigned",
    pid,
    port,
    providerMode: context.mode === "mock_e2e"
      ? "MockProvider"
      : context.mode === "live_probe" || context.mode === "live_corpus"
        ? context.allowLiveProvider
          ? "LiveProvider"
          : "Blocked"
        : "Blocked",
    startTimestamp: env.EOE_SERVER_STARTED_AT?.trim() || startedAt,
    liveRequests: getNativeLiveRequestCount(),
  };
}
