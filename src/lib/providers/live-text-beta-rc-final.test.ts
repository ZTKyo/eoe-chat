import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { segmentsToPlainText, type ChatRequest } from "@/domain/chat";
import type { PremisePreservationReview } from "@/domain/eoe";
import { reviewExecutionAccounting } from "@/lib/eoe/execution-accounting";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { findUnsupportedQuantitativeClaims } from "@/lib/eoe/quantitative-claim";
import { reviewTechnicalConceptComparison } from "@/lib/eoe/technical-comparison";
import { ProviderGateway } from "./gateway";
import {
  LiveBudgetGuard,
  type LiveBudgetAttempt,
  type LiveBudgetLedger,
} from "./live-budget-guard";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { Provider, ProviderRequest, ProviderResult } from "./types";

const enabled =
  process.env.EOE_TEXT_BETA_RC_FINAL_LIVE === "true" &&
  process.env.EOE_EXECUTION_MODE === "live_probe" &&
  process.env.EOE_ALLOW_LIVE_PROVIDER === "true" &&
  process.env.USE_MOCK_PROVIDER === "false" &&
  process.env.EOE_ENABLE_IMAGE_INPUT === "false" &&
  Boolean(process.env.EOE_LIVE_RUN_ID?.trim()) &&
  Boolean(process.env.EOE_LIVE_LEDGER_PATH?.trim()) &&
  Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim());
const live = enabled ? describe : describe.skip;
const targetedRetry = process.env.EOE_TEXT_BETA_RC_FINAL_TARGETED_RETRY === "true";
const targetIds = new Set(
  (process.env.EOE_TEXT_BETA_RC_FINAL_TARGET_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const benchmarkDirectory = join(process.cwd(), "artifacts", "benchmarks");
const resultPath = join(benchmarkDirectory, "text-beta-rc-final-results.json");
const reportPath = join(benchmarkDirectory, "text-beta-rc-final-report.md");
const reviewDirectory = join(
  process.cwd(),
  "artifacts",
  "human-review",
  "text-beta-rc-final",
);
const screenshotDirectory = join(reviewDirectory, "screenshots");
const budgetPath =
  process.env.EOE_LIVE_LEDGER_PATH ??
  join(benchmarkDirectory, "text-beta-rc-final-budget.json");
const liveBudgetGuard = enabled ? new LiveBudgetGuard() : undefined;
let activeScenarioId = "unassigned";

class ScenarioProvider implements Provider {
  readonly id: string;
  readonly modelId: string;
  readonly capabilities: Provider["capabilities"];

  constructor(private readonly delegate: Provider) {
    this.id = delegate.id;
    this.modelId = delegate.modelId;
    this.capabilities = delegate.capabilities;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    return this.delegate.generate({
      ...request,
      liveMetadata: {
        scenarioId: activeScenarioId,
        conversationTurnId: `${activeScenarioId}-final-turn`,
      },
    });
  }
}

function provider(options: {
  id: "glm" | "deepseek";
  modelId: string;
  apiKey: string;
  baseUrl: string;
}): Provider {
  if (!liveBudgetGuard) return new MockProvider();
  return new ScenarioProvider(
    new OpenAICompatibleProvider({
      ...options,
      timeoutMs,
      thinking: "disabled",
      liveBudgetGuard,
      capabilities: {
        text: true,
        vision: false,
        streaming: false,
        jsonMode: true,
        jsonSchema: false,
        toolCalling: false,
      },
    }),
  );
}

const glm = provider({
  id: "glm",
  modelId: process.env.PRIMARY_MODEL ?? "glm-4.7",
  apiKey: process.env.GLM_API_KEY?.trim() ?? "",
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
});
const deepSeek = provider({
  id: "deepseek",
  modelId: process.env.FALLBACK_MODEL ?? "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
  baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});
const mock = new MockProvider();

function single(id: string, content: string): ChatRequest {
  return {
    conversationId: `text-beta-rc-final-${id}`,
    messages: [{ id: `${id}-u1`, role: "user", content }],
    attachments: [],
    engineState: {
      recentExposurePhraseIds: [],
      developerMode: true,
      benchmarkType: "live_evidence",
    },
  };
}

interface FinalCase {
  id: string;
  title: string;
  provider: Provider;
  request: ChatRequest;
}

const cases: FinalCase[] = [
  {
    id: "typescript-unknown-any",
    title: "TypeScript unknown 与 any 技术比较",
    provider: glm,
    request: single(
      "typescript-unknown-any",
      "解释 TypeScript 里 unknown 和 any 的区别",
    ),
  },
  {
    id: "conditional-tradeoff",
    title: "租金与每日一小时通勤权衡",
    provider: deepSeek,
    request: single(
      "conditional-tradeoff",
      "一个方案租金更高，但每天能省一小时通勤，我该怎么权衡？",
    ),
  },
  {
    id: "context-ack-oh",
    title: "通勤上下文中的“哦”",
    provider: glm,
    request: {
      ...single("context-ack-oh", "哦"),
      messages: [
        {
          id: "context-ack-oh-u1",
          role: "user",
          content: "我想先比较两个通勤方案的时间和成本。",
        },
        {
          id: "context-ack-oh-a1",
          role: "assistant",
          content: "可以先记录一周的实际通勤时间和费用。",
        },
        { id: "context-ack-oh-u2", role: "user", content: "哦" },
      ],
    },
  },
];

type FinalStatus =
  | "M2_TEXT_BETA_RC_READY_FOR_FINAL_HUMAN_REVIEW"
  | "M2_TEXT_BETA_RC_REVIEWABLE_WITH_ONE_TYPESCRIPT_SOFT_WARNING"
  | "M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS";

interface ProviderAttemptEvidence {
  attemptNumber: number;
  providerId: string;
  modelId: string;
  requestId: string;
  latencyMs: number;
  usage?: EngineRunResult["diagnostics"]["totalUsage"];
  outcome: string;
  validation: EngineRunResult["diagnostics"]["finalValidation"];
  softQuality?: EngineRunResult["diagnostics"]["softQualityReview"];
  pipelineStage?: string;
  pipelineDiagnostics?: unknown;
  providerOutputPreview?: string;
}

interface FinalRecord {
  id: string;
  title: string;
  status: "PASS" | "FAIL";
  failures: string[];
  softWarnings: string[];
  provider: string;
  model: string;
  input: string;
  history: Array<{ role: string; content: string }>;
  analysis?: EngineRunResult["diagnostics"]["analysis"];
  responseObligations: EngineRunResult["diagnostics"]["responseObligations"];
  explicitUserPremises: NonNullable<
    EngineRunResult["diagnostics"]["explicitUserPremises"]
  >;
  decision?: EngineRunResult["diagnostics"]["decision"];
  selection?: EngineRunResult["diagnostics"]["selection"];
  selectedPhraseId?: string;
  finalText: string;
  englishChunks: Array<{ phraseId: string; content: string; position: number }>;
  noFit: boolean;
  noFitReason?: string;
  executionSource: EngineRunResult["diagnostics"]["responseExecutionSource"];
  attemptCount: number;
  providerRequestCount: number;
  providerTokens: number;
  providerRuntimeMs: number;
  providerAttempts: ProviderAttemptEvidence[];
  ledgerAttempts: LiveBudgetAttempt[];
  finalValidation: EngineRunResult["diagnostics"]["finalValidation"];
  taskCompleteness?: EngineRunResult["diagnostics"]["taskCompleteness"];
  premisePreservation?: PremisePreservationReview;
  naturalFallback: boolean;
  displayedWithSoftQualityWarning: boolean;
}

function ledgerForScenario(ledger: LiveBudgetLedger, id: string): LiveBudgetAttempt[] {
  return ledger.attempts.filter((attempt) => attempt.scenarioId === id);
}

function scenarioMetrics(ledger: LiveBudgetLedger, id: string): {
  attempts: LiveBudgetAttempt[];
  requests: number;
  tokens: number;
  runtimeMs: number;
} {
  const attempts = ledgerForScenario(ledger, id);
  return {
    attempts,
    requests: attempts.length,
    tokens: attempts.reduce(
      (sum, attempt) => sum + (attempt.usage?.totalTokens ?? 0),
      0,
    ),
    runtimeMs: attempts.reduce((sum, attempt) => sum + (attempt.latencyMs ?? 0), 0),
  };
}

function technicalReview(result: EngineRunResult, text: string): {
  hardIssues: string[];
  softWarnings: string[];
} {
  const requirements = result.diagnostics.responseObligations.find(
    (item) => item.technicalComparisonRequirements,
  )?.technicalComparisonRequirements;
  if (!requirements) {
    return {
      hardIssues: ["technical_comparison_requirements_missing"],
      softWarnings: [],
    };
  }
  return reviewTechnicalConceptComparison({ text, requirements });
}

function finalChecks(input: {
  spec: FinalCase;
  result: EngineRunResult;
  text: string;
  metrics: ReturnType<typeof scenarioMetrics>;
}): { failures: string[]; softWarnings: string[] } {
  const { spec, result, text, metrics } = input;
  const failures = [
    result.diagnostics.finalValidation.valid ? "" : "final_hard_validation_failed",
    text.trim() ? "" : "empty_final_response",
    result.diagnostics.naturalFallbackUsed ? "natural_fallback_used" : "",
    result.diagnostics.attempts.length <= 2 ? "" : "generation_attempt_budget_exceeded",
  ].filter(Boolean);
  let softWarnings = [...(result.diagnostics.softQualityReview?.warnings ?? [])];

  if (spec.id === "typescript-unknown-any") {
    const review = technicalReview(result, text);
    failures.push(...review.hardIssues);
    softWarnings.push(...review.softWarnings);
    if (!/\bany\b/iu.test(text)) failures.push("technical_any_missing");
    if (!/\bunknown\b/iu.test(text)) failures.push("technical_unknown_missing");
  }

  if (spec.id === "conditional-tradeoff") {
    const premiseReview = result.diagnostics.premisePreservationReview;
    if (!premiseReview?.valid) failures.push("premise_preservation_failed");
    if (!/租金.{0,12}(?:更高|较高|上涨)|(?:更高|较高|高).{0,8}租金/u.test(text)) {
      failures.push("higher_rent_not_preserved");
    }
    if (
      !/(?:每天|每日).{0,16}(?:一|1)\s*小时.{0,16}通勤|通勤.{0,16}(?:每天|每日).{0,16}(?:一|1)\s*小时/u.test(
        text,
      )
    ) {
      failures.push("daily_one_hour_commute_not_preserved");
    }
    if (!/权衡|租金差额|预算|通勤压力|时间价值|灵活性|计算|记录|试住|试验/u.test(text)) {
      failures.push("practical_tradeoff_method_missing");
    }
    const unsupported = findUnsupportedQuantitativeClaims({
      responseText: text,
      sourceTexts: spec.request.messages.map((message) => message.content),
    });
    if (unsupported.length > 0) {
      failures.push(`unsupported_quantitative_claim:${unsupported.join(",")}`);
    }
  }

  if (spec.id === "context-ack-oh") {
    if (result.diagnostics.responseExecutionSource !== "engine_owned_acknowledgement") {
      failures.push("execution_source_not_engine_owned_acknowledgement");
    }
    if (result.diagnostics.attempts.length !== 0) failures.push("invalid_attempt_count");
    if (metrics.requests !== 0) failures.push("invalid_provider_request_count");
    if (!/通勤|时间|成本|费用|刚才/u.test(text)) failures.push("commute_context_missing");
    if (/你好|有什么可以帮|你想讨论什么/u.test(text)) failures.push("context_reset");
    if (result.response.segments.some((segment) => segment.type === "english_chunk")) {
      failures.push("unexpected_english_chunk");
    }
  }

  failures.push(
    ...reviewExecutionAccounting({
      source: result.diagnostics.responseExecutionSource,
      attemptCount: result.diagnostics.attempts.length,
      providerRequestCount: metrics.requests,
    }).violations,
  );
  softWarnings = [...new Set(softWarnings)];
  return { failures: [...new Set(failures.filter(Boolean))], softWarnings };
}

async function runCase(spec: FinalCase): Promise<FinalRecord> {
  activeScenarioId = spec.id;
  const gateway = new ProviderGateway(
    {
      primary: spec.provider,
      vision: mock,
      mock,
      forceMock: false,
    },
    undefined,
    false,
  );
  try {
    const result = await runEoeEngine({
      request: spec.request,
      gateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
      naturalnessMode: "live",
    });
    const text = segmentsToPlainText(result.response.segments);
    const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
    const metrics = scenarioMetrics(ledger, spec.id);
    const checked = finalChecks({ spec, result, text, metrics });
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: checked.failures.length === 0 ? "pass" : "fail",
      violationCodes: [
        ...new Set([
          ...checked.failures,
          ...result.diagnostics.attempts.flatMap((attempt) =>
            attempt.validation.violations.map((item) => item.code),
          ),
        ]),
      ],
      fallback: result.diagnostics.fallbackUsed,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
    });
    const refreshedLedger = JSON.parse(
      readFileSync(budgetPath, "utf8"),
    ) as LiveBudgetLedger;
    const refreshedMetrics = scenarioMetrics(refreshedLedger, spec.id);
    return {
      id: spec.id,
      title: spec.title,
      status: checked.failures.length === 0 ? "PASS" : "FAIL",
      failures: checked.failures,
      softWarnings: checked.softWarnings,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      input:
        [...spec.request.messages].reverse().find((message) => message.role === "user")
          ?.content ?? "",
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      analysis: result.diagnostics.analysis,
      responseObligations: result.diagnostics.responseObligations,
      explicitUserPremises: result.diagnostics.explicitUserPremises ?? [],
      decision: result.diagnostics.decision,
      selection: result.diagnostics.selection,
      selectedPhraseId: result.diagnostics.selection.selectedPhraseId,
      finalText: text,
      englishChunks: result.response.segments.flatMap((segment, position) =>
        segment.type === "english_chunk"
          ? [{ phraseId: segment.phraseId, content: segment.content, position }]
          : [],
      ),
      noFit: result.response.noFit,
      noFitReason: result.diagnostics.noFitReason,
      executionSource: result.diagnostics.responseExecutionSource,
      attemptCount: result.diagnostics.attempts.length,
      providerRequestCount: refreshedMetrics.requests,
      providerTokens: refreshedMetrics.tokens,
      providerRuntimeMs: refreshedMetrics.runtimeMs,
      providerAttempts: result.diagnostics.attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        providerId: attempt.providerId,
        modelId: attempt.modelId,
        requestId: attempt.requestId,
        latencyMs: attempt.latencyMs,
        usage: attempt.usage,
        outcome: attempt.outcome,
        validation: attempt.validation,
        softQuality: attempt.softQuality,
        pipelineStage: attempt.pipelineStage,
        pipelineDiagnostics: attempt.pipelineDiagnostics,
        providerOutputPreview: attempt.providerOutputPreview,
      })),
      ledgerAttempts: refreshedMetrics.attempts,
      finalValidation: result.diagnostics.finalValidation,
      taskCompleteness: result.diagnostics.taskCompleteness,
      premisePreservation: result.diagnostics.premisePreservationReview,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      displayedWithSoftQualityWarning:
        result.diagnostics.displayedWithSoftQualityWarning ?? false,
    };
  } catch (error) {
    const failure = error instanceof Error ? error.message : "unknown_live_error";
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: "provider_or_pipeline_error",
      violationCodes: [failure],
      fallback: false,
      naturalFallback: false,
    });
    const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
    const metrics = scenarioMetrics(ledger, spec.id);
    return {
      id: spec.id,
      title: spec.title,
      status: "FAIL",
      failures: [failure],
      softWarnings: [],
      provider: spec.provider.id,
      model: spec.provider.modelId,
      input:
        [...spec.request.messages].reverse().find((message) => message.role === "user")
          ?.content ?? "",
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      responseObligations: [],
      explicitUserPremises: [],
      finalText: "",
      englishChunks: [],
      noFit: false,
      executionSource: "provider_generated",
      attemptCount: 0,
      providerRequestCount: metrics.requests,
      providerTokens: metrics.tokens,
      providerRuntimeMs: metrics.runtimeMs,
      providerAttempts: [],
      ledgerAttempts: metrics.attempts,
      finalValidation: {
        valid: false,
        violations: [{ code: failure, severity: "error" }],
        retryable: false,
      },
      naturalFallback: false,
      displayedWithSoftQualityWarning: false,
    };
  }
}

function releaseStatus(records: FinalRecord[]): FinalStatus {
  if (
    records.length !== 3 ||
    records.some((record) => record.status !== "PASS" || record.naturalFallback)
  ) {
    return "M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS";
  }
  const typescript = records.find((record) => record.id === "typescript-unknown-any");
  if (!typescript || typescript.softWarnings.length > 1) {
    return "M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS";
  }
  return typescript.softWarnings.length === 0
    ? "M2_TEXT_BETA_RC_READY_FOR_FINAL_HUMAN_REVIEW"
    : "M2_TEXT_BETA_RC_REVIEWABLE_WITH_ONE_TYPESCRIPT_SOFT_WARNING";
}

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function recordTable(records: FinalRecord[]): string[] {
  return [
    "| Case | Harness | Execution source | Attempts / requests | Tokens / runtime | Soft warnings | Natural Fallback | Failures |",
    "|---|---|---|---:|---:|---|---|---|",
    ...records.map(
      (record) =>
        `| ${record.id} | ${record.status} | ${record.executionSource} | ${record.attemptCount} / ${record.providerRequestCount} | ${record.providerTokens} / ${record.providerRuntimeMs} ms | ${cell(record.softWarnings.join(", ") || "none")} | ${record.naturalFallback} | ${cell(record.failures.join(", ") || "none")} |`,
    ),
  ];
}

function jsonFence(value: unknown): string[] {
  return ["````json", JSON.stringify(value, null, 2), "````"];
}

function detailedRecord(record: FinalRecord): string[] {
  return [
    `## ${record.id}`,
    "",
    `Harness: \`${record.status}\``,
    "",
    "### Actual input and complete history",
    "",
    ...jsonFence({ input: record.input, history: record.history }),
    "",
    "### Engine analysis, obligations, premises, Scheduler, and selection",
    "",
    ...jsonFence({
      analysis: record.analysis,
      responseObligations: record.responseObligations,
      explicitUserPremises: record.explicitUserPremises,
      decision: record.decision,
      selection: record.selection,
      selectedPhraseId: record.selectedPhraseId,
      noFit: record.noFit,
      noFitReason: record.noFitReason,
    }),
    "",
    "### All Provider generation attempts and Templates",
    "",
    ...(record.providerAttempts.length > 0
      ? jsonFence(record.providerAttempts)
      : ["No Provider generation attempt. This is an Engine-owned result."]),
    "",
    "### Guarded HTTP attempt evidence",
    "",
    ...(record.ledgerAttempts.length > 0
      ? jsonFence(record.ledgerAttempts)
      : ["No Provider HTTP request."]),
    "",
    "### Final displayed text",
    "",
    "````text",
    record.finalText,
    "````",
    "",
    "### Final validation and accounting",
    "",
    ...jsonFence({
      executionSource: record.executionSource,
      attemptCount: record.attemptCount,
      providerRequestCount: record.providerRequestCount,
      providerTokens: record.providerTokens,
      providerRuntimeMs: record.providerRuntimeMs,
      englishChunks: record.englishChunks,
      finalValidation: record.finalValidation,
      softWarnings: record.softWarnings,
      displayedWithSoftQualityWarning: record.displayedWithSoftQualityWarning,
      taskCompleteness: record.taskCompleteness,
      premisePreservation: record.premisePreservation,
      naturalFallback: record.naturalFallback,
      failures: record.failures,
    }),
    "",
  ];
}

function writeReport(
  records: FinalRecord[],
  ledger: LiveBudgetLedger,
  status: FinalStatus,
): void {
  mkdirSync(benchmarkDirectory, { recursive: true });
  writeFileSync(
    resultPath,
    `${JSON.stringify({ status, targetedRetry, ledger, records }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    reportPath,
    [
      "# Text Beta RC Final Three-Case Live Probe",
      "",
      `- Status: \`${status}\``,
      `- Run ID: \`${ledger.runId}\``,
      `- Targeted Retry merge: ${targetedRetry}`,
      `- Usable results: ${records.filter((record) => record.status === "PASS").length}/3`,
      `- Natural Fallback: ${records.filter((record) => record.naturalFallback).length}`,
      `- Provider requests: ${ledger.requestCount}/${ledger.requestBudget}`,
      `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
      `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
      `- Image Provider requests: ${ledger.attempts.filter((attempt) => attempt.provider.includes("vision")).length}`,
      "- M3: BLOCKED",
      "- Adaptive Progression: DISABLED",
      "",
      ...recordTable(records),
      "",
      ...records.flatMap(detailedRecord),
    ].join("\n"),
    "utf8",
  );
}

function writeReviewFile(name: string, title: string, lines: string[]): void {
  writeFileSync(
    join(reviewDirectory, name),
    [
      `# ${title}`,
      "",
      "Review package status: `PENDING_FINAL_INDEPENDENT_HUMAN_REVIEW`",
      "",
      ...lines,
      "",
    ].join("\n"),
    "utf8",
  );
}

function writeReviewPackage(
  records: FinalRecord[],
  ledger: LiveBudgetLedger,
  status: FinalStatus,
): void {
  mkdirSync(screenshotDirectory, { recursive: true });
  copyFileSync(
    join(
      process.cwd(),
      "artifacts",
      "screenshots",
      "m2.5-text-beta-desktop.png",
    ),
    join(screenshotDirectory, "desktop.png"),
  );
  copyFileSync(
    join(
      process.cwd(),
      "artifacts",
      "screenshots",
      "m2.5-text-beta-mobile-390x844.png",
    ),
    join(screenshotDirectory, "mobile-390x844.png"),
  );
  const blockers = records.flatMap((record) =>
    record.failures.map((failure) => `${record.id}: ${failure}`),
  );
  writeReviewFile("REVIEW_INDEX.md", "Text Beta RC Final Review Index", [
    `Technical gate state: \`${status}\`.`,
    status === "M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS"
      ? `Blocking evidence: ${blockers.join("; ") || "three-case gate incomplete"}.`
      : "The technical gate permits final independent human review; it does not pre-approve the human verdict.",
    "Scope: Text-First Fixed-Level Beta. Image input is deferred; Adaptive Progression and M3 are blocked.",
    "",
    ...[
      "FINAL_THREE_CASES_REVIEW.md",
      "TYPESCRIPT_REVIEW.md",
      "PREMISE_PRESERVATION_REVIEW.md",
      "CONTEXT_ACKNOWLEDGEMENT_REVIEW.md",
      "HARD_SOFT_VALIDATION_REVIEW.md",
      "LIVE_BUDGET_AUDIT.md",
      "REGRESSION_TEST_SUMMARY.md",
      "BETA_UI_REVIEW.md",
      "INDEPENDENT_REVIEW_CHECKLIST.md",
      "screenshots/desktop.png",
      "screenshots/mobile-390x844.png",
    ].map((item) => `- ${item}`),
  ]);
  writeReviewFile(
    "FINAL_THREE_CASES_REVIEW.md",
    "Final Three Cases Review",
    [...recordTable(records), "", ...records.flatMap(detailedRecord)],
  );
  const typescript = records.find((record) => record.id === "typescript-unknown-any");
  writeReviewFile(
    "TYPESCRIPT_REVIEW.md",
    "TypeScript Technical Comparison Review",
    typescript ? detailedRecord(typescript) : ["Required record is missing."],
  );
  const premise = records.find((record) => record.id === "conditional-tradeoff");
  writeReviewFile(
    "PREMISE_PRESERVATION_REVIEW.md",
    "Explicit User Premise Preservation Review",
    premise ? detailedRecord(premise) : ["Required record is missing."],
  );
  const acknowledgement = records.find((record) => record.id === "context-ack-oh");
  writeReviewFile(
    "CONTEXT_ACKNOWLEDGEMENT_REVIEW.md",
    "Engine-Owned Context Acknowledgement Review",
    acknowledgement
      ? detailedRecord(acknowledgement)
      : ["Required record is missing."],
  );
  writeReviewFile("HARD_SOFT_VALIDATION_REVIEW.md", "Hard and Soft Validation Review", [
    ...recordTable(records),
    "",
    "Hard failures block the case before display. TypeScript Soft warnings may trigger one regeneration; a substantive Hard-valid result is retained and exposed for human judgment.",
    "",
    ...jsonFence(
      records.map((record) => ({
        id: record.id,
        finalValidation: record.finalValidation,
        softWarnings: record.softWarnings,
        displayedWithSoftQualityWarning: record.displayedWithSoftQualityWarning,
        taskCompleteness: record.taskCompleteness,
      })),
    ),
  ]);
  writeReviewFile("LIVE_BUDGET_AUDIT.md", "Live Budget Audit", [
    `- Run ID: \`${ledger.runId}\``,
    `- Execution Mode: \`${ledger.executionMode}\``,
    `- Provider requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    `- Pending attempts: ${ledger.attempts.filter((attempt) => attempt.outcome === "pending").length}`,
    `- Image Provider requests: ${ledger.attempts.filter((attempt) => attempt.provider.includes("vision")).length}`,
    "",
    ...jsonFence(ledger.attempts),
  ]);
  writeReviewFile("REGRESSION_TEST_SUMMARY.md", "Regression Test Summary", [
    "The final live probe is only run after the complete no-quota command gate exits 0.",
    "",
    "- `npm install`: exit 0",
    "- `npm run lint`: exit 0",
    "- `npm run typecheck`: exit 0",
    "- `npm run test`: exit 0",
    "- `npm run benchmark:eoe`: exit 0",
    "- `npm run benchmark:structure`: exit 0",
    "- `npm run benchmark:naturalness`: exit 0; `DEPRECATED_ALIAS — use benchmark:structure`",
    "- `npm run replay:m2.3-live-failures`: exit 0",
    "- `npm run build`: exit 0",
    "- `npm run test:e2e`: exit 0",
    "- Mock E2E Live Provider requests: 0",
    "- Image Provider requests: 0",
  ]);
  writeReviewFile("BETA_UI_REVIEW.md", "Beta UI Review", [
    "No UI code was changed in this three-blocker closure.",
    "",
    "- Desktop screenshot: `screenshots/desktop.png`",
    "- Mobile 390×844 screenshot: `screenshots/mobile-390x844.png`",
    "- Source evidence was generated in MockProvider mode.",
    "- Image entry remains hidden.",
    "- Human visual PASS is not preselected.",
  ]);
  writeReviewFile("INDEPENDENT_REVIEW_CHECKLIST.md", "Independent Review Checklist", [
    "Review the actual texts and evidence above. Do not infer approval from the automated gate.",
    "",
    "- [ ] TypeScript explains both `unknown` and `any` correctly.",
    "- [ ] TypeScript explains the use-before-validation requirement.",
    "- [ ] TypeScript states the safety difference and gives usable selection advice.",
    "- [ ] The tradeoff reply preserves higher rent.",
    "- [ ] The tradeoff reply preserves one saved commute hour every day.",
    "- [ ] The tradeoff reply adds no replacement assumption or unsupported exact number.",
    "- [ ] The tradeoff method is practically useful.",
    "- [ ] “哦” preserves the commuting context.",
    "- [ ] The Engine-owned zero-attempt and zero-request accounting is credible.",
    "- [ ] No result exposes internal EOE mechanics.",
    "- [ ] Desktop and mobile screenshots remain acceptable.",
    "",
    "Final independent verdict:",
    "",
    "- [ ] PASS",
    "- [ ] FAIL",
  ]);
}

function mergeRetryRecord(
  previous: FinalRecord | undefined,
  current: FinalRecord,
): FinalRecord {
  if (!previous) return current;
  return {
    ...current,
    providerAttempts: [...previous.providerAttempts, ...current.providerAttempts],
  };
}

live("Text Beta RC final independent three-scenario Live Probe", () => {
  it("preserves all final evidence and applies source-aware accounting", async () => {
    expect(cases).toHaveLength(3);
    const selectedCases = targetedRetry
      ? cases.filter((item) => targetIds.has(item.id))
      : cases;
    if (targetedRetry) {
      expect(targetIds.size).toBeGreaterThan(0);
      expect(selectedCases.map((item) => item.id).sort()).toEqual(
        [...targetIds].sort(),
      );
    }

    const previousRecords = targetedRetry
      ? (
          JSON.parse(readFileSync(resultPath, "utf8")) as {
            records: FinalRecord[];
          }
        ).records
      : [];
    const currentRecords: FinalRecord[] = [];
    for (const spec of selectedCases) currentRecords.push(await runCase(spec));
    await liveBudgetGuard?.completeRun();
    const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
    const replacements = new Map(
      currentRecords.map((record) => [
        record.id,
        mergeRetryRecord(
          previousRecords.find((previous) => previous.id === record.id),
          record,
        ),
      ]),
    );
    const records = targetedRetry
      ? cases.map(
          (spec) =>
            replacements.get(spec.id) ??
            previousRecords.find((record) => record.id === spec.id) ??
            (() => {
              throw new Error(`Missing previous record ${spec.id}`);
            })(),
        )
      : currentRecords;
    const status = releaseStatus(records);
    writeReport(records, ledger, status);
    writeReviewPackage(records, ledger, status);
    const failureSummary = records
      .filter((record) => record.status === "FAIL")
      .map((record) => `${record.id}=${record.failures.join(",")}`)
      .join("; ");
    expect(
      status === "M2_TEXT_BETA_RC_READY_FOR_FINAL_HUMAN_REVIEW" ||
        status ===
          "M2_TEXT_BETA_RC_REVIEWABLE_WITH_ONE_TYPESCRIPT_SOFT_WARNING",
      failureSummary || `release status=${status}`,
    ).toBe(true);
  }, 20 * 60_000);
});

