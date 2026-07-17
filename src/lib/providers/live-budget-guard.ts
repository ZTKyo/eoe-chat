import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ProviderRequest, ProviderUsage } from "./types";
import {
  assertLiveProviderAuthorization,
  liveProviderBlocked,
  type EnvironmentLike,
  type ExecutionMode,
} from "@/lib/runtime/execution-mode";

export type LiveAttemptOutcome = "pending" | "success" | "error" | "timeout" | "cancelled";

export interface LiveBudgetAttempt {
  id: string;
  requestId: string;
  provider: string;
  model: string;
  scenarioId: string;
  conversationTurnId: string;
  attemptNumber: number;
  preRegisteredAt: string;
  completedAt?: string;
  httpStatus?: number;
  usage?: ProviderUsage;
  latencyMs?: number;
  outcome: LiveAttemptOutcome;
  pipelineOutcome?: string;
  violationCodes: string[];
  fallback: boolean;
  naturalFallback: boolean;
  securityStop: boolean;
  errorCategory?: string;
}

export interface LiveBudgetLedger {
  schemaVersion: "eoe.live-budget.v2";
  runId: string;
  executionMode: "live_probe" | "live_corpus";
  startedAt: string;
  completedAt?: string;
  requestBudget: number;
  tokenBudget: number;
  runtimeBudgetMs: number;
  requestCount: number;
  tokenCount: number;
  providerRuntimeMs: number;
  attempts: LiveBudgetAttempt[];
}

export interface LiveBudgetLimits {
  requestBudget: number;
  tokenBudget: number;
  runtimeBudgetMs: number;
}

export interface LiveAttemptHandle {
  attemptId: string;
  requestId: string;
}

async function atomicWrite(path: string, value: LiveBudgetLedger): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export async function createLiveBudgetLedger(input: {
  path: string;
  runId: string;
  executionMode: "live_probe" | "live_corpus";
  limits: LiveBudgetLimits;
  startedAt?: string;
}): Promise<LiveBudgetLedger> {
  const ledger: LiveBudgetLedger = {
    schemaVersion: "eoe.live-budget.v2",
    runId: input.runId,
    executionMode: input.executionMode,
    startedAt: input.startedAt ?? new Date().toISOString(),
    requestBudget: input.limits.requestBudget,
    tokenBudget: input.limits.tokenBudget,
    runtimeBudgetMs: input.limits.runtimeBudgetMs,
    requestCount: 0,
    tokenCount: 0,
    providerRuntimeMs: 0,
    attempts: [],
  };
  await atomicWrite(resolve(input.path), ledger);
  return ledger;
}

export async function readLiveBudgetLedger(path: string): Promise<LiveBudgetLedger> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as LiveBudgetLedger;
}

export class LiveBudgetGuard {
  readonly ledgerPath: string;
  readonly runId: string;
  readonly executionMode: "live_probe" | "live_corpus";
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly env: EnvironmentLike = process.env,
  ) {
    const authorized = assertLiveProviderAuthorization(env);
    this.ledgerPath = resolve(authorized.liveLedgerPath);
    this.runId = authorized.liveRunId;
    this.executionMode = authorized.mode;
  }

  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const result = this.queue.then(action, action);
    this.queue = result.then(() => undefined, () => undefined);
    return result;
  }

  private async loadAndValidate(): Promise<LiveBudgetLedger> {
    const authorized = assertLiveProviderAuthorization(this.env);
    const ledger = await readLiveBudgetLedger(this.ledgerPath);
    if (authorized.liveRunId !== ledger.runId || this.runId !== ledger.runId) {
      throw liveProviderBlocked("Live Run ID does not match Ledger");
    }
    if (authorized.mode !== ledger.executionMode || this.executionMode !== ledger.executionMode) {
      throw liveProviderBlocked("Execution Mode does not match Ledger");
    }
    return ledger;
  }

  async beforeRequest(input: {
    provider: string;
    model: string;
    request: ProviderRequest;
  }): Promise<LiveAttemptHandle> {
    return this.serialize(async () => {
      const ledger = await this.loadAndValidate();
      if (
        ledger.requestCount >= ledger.requestBudget ||
        ledger.tokenCount >= ledger.tokenBudget ||
        ledger.providerRuntimeMs >= ledger.runtimeBudgetMs
      ) {
        throw liveProviderBlocked("Live budget exhausted");
      }
      const id = `live-attempt-${crypto.randomUUID()}`;
      ledger.requestCount += 1;
      ledger.attempts.push({
        id,
        requestId: input.request.requestId,
        provider: input.provider,
        model: input.model,
        scenarioId: input.request.liveMetadata?.scenarioId ?? "unassigned",
        conversationTurnId: input.request.liveMetadata?.conversationTurnId ?? input.request.requestId,
        attemptNumber: input.request.generationAttempt ?? 1,
        preRegisteredAt: new Date().toISOString(),
        outcome: "pending",
        violationCodes: [],
        fallback: false,
        naturalFallback: false,
        securityStop: false,
      });
      await atomicWrite(this.ledgerPath, ledger);
      return { attemptId: id, requestId: input.request.requestId };
    });
  }

  async completeRequest(input: {
    handle: LiveAttemptHandle;
    httpStatus: number;
    usage?: ProviderUsage;
    latencyMs: number;
  }): Promise<void> {
    await this.finish(input.handle, {
      outcome: "success",
      httpStatus: input.httpStatus,
      usage: input.usage,
      latencyMs: input.latencyMs,
    });
  }

  async failRequest(input: {
    handle: LiveAttemptHandle;
    httpStatus?: number;
    latencyMs: number;
    errorCategory: string;
  }): Promise<void> {
    const outcome: LiveAttemptOutcome = input.errorCategory === "timeout"
      ? "timeout"
      : input.errorCategory === "cancelled"
        ? "cancelled"
        : "error";
    await this.finish(input.handle, {
      outcome,
      httpStatus: input.httpStatus,
      latencyMs: input.latencyMs,
      errorCategory: input.errorCategory,
    });
  }

  private async finish(
    handle: LiveAttemptHandle,
    update: Pick<LiveBudgetAttempt, "outcome" | "latencyMs"> &
      Partial<Pick<LiveBudgetAttempt, "httpStatus" | "usage" | "errorCategory">>,
  ): Promise<void> {
    await this.serialize(async () => {
      const ledger = await this.loadAndValidate();
      const attempt = ledger.attempts.find((item) => item.id === handle.attemptId);
      if (!attempt || attempt.outcome !== "pending") {
        throw liveProviderBlocked("Ledger attempt is missing or already completed");
      }
      Object.assign(attempt, update, { completedAt: new Date().toISOString() });
      ledger.tokenCount += update.usage?.totalTokens ?? 0;
      ledger.providerRuntimeMs += update.latencyMs ?? 0;
      await atomicWrite(this.ledgerPath, ledger);
    });
  }

  async annotatePipeline(input: {
    requestId: string;
    pipelineOutcome: string;
    violationCodes: string[];
    fallback: boolean;
    naturalFallback: boolean;
    securityStop?: boolean;
  }): Promise<void> {
    await this.serialize(async () => {
      const ledger = await this.loadAndValidate();
      const attempts = ledger.attempts.filter((item) => item.requestId === input.requestId);
      for (const attempt of attempts) {
        attempt.pipelineOutcome = input.pipelineOutcome;
        attempt.violationCodes = [...input.violationCodes];
        attempt.fallback = input.fallback;
        attempt.naturalFallback = input.naturalFallback;
        attempt.securityStop = input.securityStop ?? false;
      }
      await atomicWrite(this.ledgerPath, ledger);
    });
  }

  async annotateScenario(input: {
    scenarioId: string;
    pipelineOutcome: string;
    violationCodes: string[];
    fallback: boolean;
    naturalFallback: boolean;
    securityStop?: boolean;
  }): Promise<void> {
    await this.serialize(async () => {
      const ledger = await this.loadAndValidate();
      const attempts = ledger.attempts.filter(
        (item) => item.scenarioId === input.scenarioId && item.pipelineOutcome === undefined,
      );
      for (const attempt of attempts) {
        attempt.pipelineOutcome = input.pipelineOutcome;
        attempt.violationCodes = [...input.violationCodes];
        attempt.fallback = input.fallback;
        attempt.naturalFallback = input.naturalFallback;
        attempt.securityStop = input.securityStop ?? false;
      }
      await atomicWrite(this.ledgerPath, ledger);
    });
  }

  async completeRun(): Promise<void> {
    await this.serialize(async () => {
      const ledger = await this.loadAndValidate();
      ledger.completedAt = new Date().toISOString();
      await atomicWrite(this.ledgerPath, ledger);
    });
  }
}

export function isLiveMode(value: ExecutionMode): value is "live_probe" | "live_corpus" {
  return value === "live_probe" || value === "live_corpus";
}
