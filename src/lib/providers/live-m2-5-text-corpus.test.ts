import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  segmentsToPlainText,
  type ChatRequest,
  type MessageSegment,
} from "@/domain/chat";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { GOLDEN_CONVERSATION_CORPUS } from "@/lib/eoe/golden-corpus";
import {
  M24_CORE_CORPUS_IDS,
  M24_MULTI_TURN_CORPUS,
  NATURAL_OVERLAY_OPPORTUNITY_CORPUS,
  type M24MultiTurnScenario,
} from "@/lib/eoe/m2-4-corpora";
import { getPhraseById } from "@/lib/eoe/registry/phrase-registry";
import { ProviderGateway } from "./gateway";
import { LiveBudgetGuard, type LiveBudgetLedger } from "./live-budget-guard";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { Provider, ProviderRequest, ProviderResult } from "./types";

const m251 = process.env.EOE_M2_5_1_LIVE === "true";
const targetedM251 = m251 && process.env.EOE_EXECUTION_MODE === "live_probe";
const finalM251 = m251 && process.env.EOE_EXECUTION_MODE === "live_corpus";
const defaultTargetedIds = [
  "core-advice-choice",
  "core-technical-typescript",
  "opportunity-advice-daily",
  "multi-ambiguity",
];
const targetedCaseIds = targetedM251 && process.env.EOE_M2_5_1_CASE_IDS?.trim()
  ? process.env.EOE_M2_5_1_CASE_IDS.split(",").map((value) => value.trim()).filter(Boolean)
  : defaultTargetedIds;
const targetedExpectedTotal = targetedCaseIds.length;
const legacyM25 = process.env.EOE_M2_5_TEXT_CORPUS_LIVE === "true" &&
  process.env.EOE_EXECUTION_MODE === "live_corpus";
const enabled = (legacyM25 || targetedM251 || finalM251) &&
  process.env.EOE_ALLOW_LIVE_PROVIDER === "true" &&
  process.env.USE_MOCK_PROVIDER === "false" &&
  process.env.EOE_ENABLE_IMAGE_INPUT === "false" &&
  Boolean(process.env.EOE_LIVE_RUN_ID?.trim() && process.env.EOE_LIVE_LEDGER_PATH?.trim()) &&
  Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim());
const live = enabled ? describe : describe.skip;
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const reportDirectory = join(process.cwd(), "artifacts", "benchmarks");
const reviewDirectory = join(
  process.cwd(),
  "artifacts",
  "human-review",
  m251 ? "m2-text-beta-final" : "m2-text-beta",
);
const budgetPath = process.env.EOE_LIVE_LEDGER_PATH ??
  join(
    reportDirectory,
    targetedM251
      ? "m2.5.1-targeted-budget.json"
      : finalM251
        ? "m2.5.1-final-corpus-budget.json"
        : "m2.5-text-corpus-budget.json",
  );
const evidencePrefix = process.env.EOE_M2_5_1_EVIDENCE_PREFIX?.trim() || (
  targetedM251
    ? "m2.5.1-targeted"
    : finalM251
      ? "m2.5.1-final-corpus"
      : "m2.5-text-corpus"
);
const reportPath = join(reportDirectory, `${evidencePrefix}-report.md`);
const resultPath = join(reportDirectory, `${evidencePrefix}-results.json`);
let activeScenarioId = "unassigned";
const liveBudgetGuard = enabled ? new LiveBudgetGuard() : undefined;

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

function createProvider(options: {
  id: "glm" | "deepseek";
  modelId: string;
  apiKey: string;
  baseUrl: string;
}): Provider {
  if (!liveBudgetGuard) return new MockProvider();
  return new ScenarioProvider(new OpenAICompatibleProvider({
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
  }));
}

const glm = createProvider({
  id: "glm",
  modelId: process.env.PRIMARY_MODEL ?? "glm-4.7",
  apiKey: process.env.GLM_API_KEY?.trim() ?? "",
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
});
const deepSeek = createProvider({
  id: "deepseek",
  modelId: process.env.FALLBACK_MODEL ?? "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
  baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});
const mock = new MockProvider();

function textRequest(
  id: string,
  content: string,
  recentExposurePhraseIds: string[] = [],
): ChatRequest {
  return {
    conversationId: `m2-5-corpus-${id}`,
    messages: [{ id: `${id}-u1`, role: "user", content }],
    attachments: [],
    engineState: {
      recentExposurePhraseIds,
      developerMode: true,
      benchmarkType: "live_evidence",
    },
  };
}

function assistantSegments(content: string, phraseId?: string): MessageSegment[] | undefined {
  if (!phraseId) return undefined;
  const phrase = getPhraseById(phraseId);
  if (!phrase) return undefined;
  const surface = [phrase.canonical, ...phrase.variants].find((item) =>
    content.toLocaleLowerCase().includes(item.toLocaleLowerCase()));
  if (!surface) return undefined;
  const index = content.toLocaleLowerCase().indexOf(surface.toLocaleLowerCase());
  const before = content.slice(0, index);
  const actual = content.slice(index, index + surface.length);
  const after = content.slice(index + surface.length);
  return [
    ...(before
      ? [{
          type: "text" as const,
          content: before,
          language: /[\u3400-\u9fff]/u.test(before) ? "zh" as const : "other" as const,
        }]
      : []),
    {
      type: "english_chunk" as const,
      content: actual,
      phraseId,
      isNew: false,
      assistanceAvailable: true,
    },
    ...(after
      ? [{
          type: "text" as const,
          content: after,
          language: /[\u3400-\u9fff]/u.test(after) ? "zh" as const : "other" as const,
        }]
      : []),
  ];
}

function multiTurnRequest(scenario: M24MultiTurnScenario): ChatRequest {
  const messages: ChatRequest["messages"] = scenario.turns.map((turn, index) => ({
    id: `${scenario.id}-${index + 1}`,
    role: turn.role,
    content: turn.content,
    segments: turn.role === "assistant"
      ? assistantSegments(turn.content, turn.phraseId)
      : undefined,
  }));
  let assistanceRequest:
    NonNullable<NonNullable<ChatRequest["engineState"]>["assistanceRequest"]> | undefined;
  if (["meaning", "pronunciation", "click"].includes(scenario.id)) {
    const sourceIndex = [...scenario.turns]
      .map((turn, index) => ({ turn, index }))
      .reverse()
      .find((item) => item.turn.phraseId)?.index;
    const source = sourceIndex === undefined ? undefined : scenario.turns[sourceIndex];
    if (sourceIndex !== undefined && source?.phraseId) {
      assistanceRequest = {
        trigger: scenario.id === "pronunciation"
          ? "pronunciation"
          : scenario.id === "click"
            ? "click"
            : "meaning",
        sourceMessageId: `${scenario.id}-${sourceIndex + 1}`,
        phraseId: source.phraseId,
        segmentIndex: assistantSegments(source.content, source.phraseId)
          ?.findIndex((segment) => segment.type === "english_chunk"),
      };
    }
  }
  if (scenario.id === "click") {
    messages.push({
      id: `${scenario.id}-click`,
      role: "user",
      content: "请简短解释刚才的英文短语，然后继续原来的话题。",
    });
  }
  return {
    conversationId: `m2-5-corpus-multi-${scenario.id}`,
    messages,
    attachments: [],
    engineState: {
      recentExposurePhraseIds: scenario.turns
        .flatMap((turn) => turn.phraseId ? [turn.phraseId] : []),
      developerMode: true,
      benchmarkType: "live_evidence",
      assistanceRequest,
    },
  };
}

type Group = "core" | "opportunity" | "multi_turn";

type LiveCase = {
  id: string;
  group: Group;
  provider: Provider;
  request: ChatRequest;
  fixedLevel: number;
  checks?: (result: EngineRunResult, text: string) => string[];
};

type LiveRecord = {
  id: string;
  group: Group;
  status: "PASS" | "FAIL";
  failures: string[];
  provider: string;
  model: string;
  history: Array<{ role: string; content: string }>;
  finalText: string;
  conversationFunction: string;
  fixedLevel: number;
  effectiveLevel: number;
  responseObligations: string[];
  obligationDetails: EngineRunResult["diagnostics"]["responseObligations"];
  candidatePhrases: string[];
  selectedPhrase?: string;
  userPhraseReuse?: EngineRunResult["diagnostics"]["userPhraseReuseOpportunity"];
  englishChunks: string[];
  phrasePosition?: string;
  noFit: boolean;
  noFitSource?: string;
  noFitReason?: string;
  taskComplete: boolean;
  taskIssues: string[];
  missingObligations: string[];
  attempts: number;
  violationCodes: string[];
  naturalFallback: boolean;
  providerFallback: boolean;
  wrongContextDenial: boolean;
  phraseReplacedTask: boolean;
  assistance?: EngineRunResult["diagnostics"]["assistance"];
  latencyMs: number;
  tokens: number;
  attemptEvidence: Array<{
    attemptNumber: number;
    provider: string;
    model: string;
    requestId: string;
    outcome: string;
    pipelineStage?: string;
    pipeline?: EngineRunResult["diagnostics"]["attempts"][number]["pipeline"];
    violationCodes: string[];
    providerOutputPreview?: string;
    latencyMs: number;
    tokens: number;
  }>;
};

function historyHasPhrase(request: ChatRequest): boolean {
  return request.messages.some((message) =>
    message.role === "assistant" &&
    message.segments?.some((segment) => segment.type === "english_chunk"));
}

async function runCase(spec: LiveCase): Promise<LiveRecord> {
  activeScenarioId = spec.id;
  const gateway = new ProviderGateway(
    { primary: spec.provider, vision: mock, mock, forceMock: false },
    undefined,
    false,
  );
  try {
    const result = await runEoeEngine({
      request: spec.request,
      gateway,
      config: { enabled: true, fixedLevel: spec.fixedLevel, developerMode: true },
      naturalnessMode: "live",
    });
    const text = segmentsToPlainText(result.response.segments);
    const chunks = result.response.segments
      .filter((segment) => segment.type === "english_chunk")
      .map((segment) => segment.content);
    const violationCodes = [
      ...new Set(result.diagnostics.attempts.flatMap((attempt) =>
        attempt.validation.violations.map((violation) => violation.code))),
    ];
    const wrongContextDenial = historyHasPhrase(spec.request) &&
      /没有找到|没找到|未找到|没有(?:看到|使用).{0,12}英文|历史.{0,8}没有/u.test(text);
    const phraseReplacedTask =
      result.diagnostics.taskCompleteness.issues.includes("overlay_replaced_core_answer");
    const failures = [
      result.diagnostics.finalValidation.valid ? "" : "final_validator_failed",
      result.diagnostics.taskCompleteness.complete
        ? ""
        : `task_incomplete:${result.diagnostics.taskCompleteness.issues.join(",")}`,
      result.diagnostics.naturalFallbackUsed ? "natural_fallback_used" : "",
      result.diagnostics.assistance?.engineOwnedClarification
        ? result.diagnostics.attempts.length === 0
          ? ""
          : `engine_clarification_made_provider_attempts:${result.diagnostics.attempts.length}`
        : result.diagnostics.attempts.length >= 1 && result.diagnostics.attempts.length <= 2
        ? ""
        : `invalid_attempt_count:${result.diagnostics.attempts.length}`,
      result.diagnostics.assistance?.engineOwnedClarification ||
      result.provider.modelId === spec.provider.modelId
        ? ""
        : `model_mismatch:${result.provider.modelId}`,
      result.response.noFit && !result.diagnostics.noFitReason
        ? "no_fit_reason_missing"
        : "",
      wrongContextDenial ? "wrong_context_denial" : "",
      phraseReplacedTask ? "phrase_replaced_core_answer" : "",
      ...((spec.checks?.(result, text) ?? []).filter(Boolean)),
    ].filter(Boolean);
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: failures.length === 0 ? "pass" : "fail",
      violationCodes,
      fallback: result.diagnostics.attempts.some((attempt) => attempt.providerFallbackUsed),
      naturalFallback: result.diagnostics.naturalFallbackUsed,
    });
    return {
      id: spec.id,
      group: spec.group,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      finalText: text,
      conversationFunction: result.diagnostics.analysis.primaryFunction,
      fixedLevel: result.diagnostics.decision.fixedLevel,
      effectiveLevel: result.diagnostics.decision.effectiveLevel,
      responseObligations: result.diagnostics.responseObligations.map((item) => item.id),
      obligationDetails: result.diagnostics.responseObligations,
      candidatePhrases: result.diagnostics.selection.candidates.map((item) => item.phraseId),
      selectedPhrase: result.diagnostics.selection.selectedPhraseId,
      userPhraseReuse: result.diagnostics.userPhraseReuseOpportunity,
      englishChunks: chunks,
      phrasePosition: result.diagnostics.realizedPhrasePosition,
      noFit: result.response.noFit,
      noFitSource: result.diagnostics.noFitDecisionSource,
      noFitReason: result.diagnostics.noFitReason,
      taskComplete: result.diagnostics.taskCompleteness.complete,
      taskIssues: result.diagnostics.taskCompleteness.issues,
      missingObligations: result.diagnostics.taskCompleteness.missingObligationIds,
      attempts: result.diagnostics.attempts.length,
      violationCodes,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      providerFallback: result.diagnostics.attempts.some((attempt) =>
        attempt.providerFallbackUsed),
      wrongContextDenial,
      phraseReplacedTask,
      assistance: result.diagnostics.assistance,
      latencyMs: result.provider.latencyMs,
      tokens: result.provider.usage?.totalTokens ?? 0,
      attemptEvidence: result.diagnostics.attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        provider: attempt.providerId,
        model: attempt.modelId,
        requestId: attempt.requestId,
        outcome: attempt.outcome,
        pipelineStage: attempt.pipelineStage,
        pipeline: attempt.pipeline,
        violationCodes: attempt.validation.violations.map((violation) => violation.code),
        providerOutputPreview: attempt.providerOutputPreview,
        latencyMs: attempt.latencyMs,
        tokens: attempt.usage?.totalTokens ?? 0,
      })),
    };
  } catch (error) {
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: "provider_or_pipeline_error",
      violationCodes: [error instanceof Error ? error.name : "unknown_live_error"],
      fallback: false,
      naturalFallback: false,
    });
    return {
      id: spec.id,
      group: spec.group,
      status: "FAIL",
      failures: [error instanceof Error ? error.message : "unknown_live_error"],
      provider: spec.provider.id,
      model: spec.provider.modelId,
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      finalText: "",
      conversationFunction: "not_reached",
      fixedLevel: spec.fixedLevel,
      effectiveLevel: spec.fixedLevel,
      responseObligations: [],
      obligationDetails: [],
      candidatePhrases: [],
      englishChunks: [],
      noFit: false,
      taskComplete: false,
      taskIssues: [],
      missingObligations: [],
      attempts: 0,
      violationCodes: [],
      naturalFallback: false,
      providerFallback: false,
      wrongContextDenial: false,
      phraseReplacedTask: false,
      latencyMs: 0,
      tokens: 0,
      attemptEvidence: [],
    };
  }
}

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function historyCell(record: LiveRecord): string {
  return cell(JSON.stringify(record.history));
}

function compactTable(records: LiveRecord[]): string[] {
  return [
    "| Case | Status | Provider / Model | Actual History | Actual Final Text | Phrase / Position | noFit / Source / Reason | Task | Attempts | Violations |",
    "|---|---|---|---|---|---|---|---|---:|---|",
    ...records.map((record) =>
      `| ${record.id} | ${record.status} | ${record.provider} / ${record.model} | ${historyCell(record)} | ${cell(record.finalText)} | ${cell(record.englishChunks.join(", ") || "none")} / ${record.phrasePosition ?? "none"} | ${record.noFit} / ${record.noFitSource ?? "none"} / ${record.noFitReason ?? "none"} | ${record.taskComplete ? "complete" : cell(record.taskIssues.join(", "))} | ${record.attempts} | ${cell(record.violationCodes.join(", ") || "none")} |`),
  ];
}

type M251FinalState =
  | "M2_TEXT_BETA_READY_FOR_INDEPENDENT_HUMAN_REVIEW"
  | "M2_TEXT_BETA_REVIEWABLE_WITH_ONE_KNOWN_TECHNICAL_FALLBACK"
  | "M2_TEXT_BETA_STOPPED_WITH_BLOCKERS";

function determineM251FinalState(records: LiveRecord[]): M251FinalState {
  const failures = records.filter((record) => record.status === "FAIL");
  const caseA =
    records.length === 39 &&
    failures.length === 0 &&
    records.every((record) => !record.naturalFallback) &&
    records.every((record) => record.taskComplete) &&
    records.every((record) => !record.phraseReplacedTask && !record.wrongContextDenial);
  if (caseA) return "M2_TEXT_BETA_READY_FOR_INDEPENDENT_HUMAN_REVIEW";

  const only = failures[0];
  const caseB =
    records.length === 39 &&
    failures.length === 1 &&
    records.filter((record) => record.status === "PASS").length === 38 &&
    Boolean(only?.id.includes("technical")) &&
    only?.naturalFallback === true &&
    only.taskComplete &&
    !only.phraseReplacedTask &&
    !only.wrongContextDenial &&
    !only.assistance &&
    !only.userPhraseReuse &&
    !only.violationCodes.includes("task_incomplete") &&
    !only.violationCodes.includes("response_obligation_missing") &&
    only.finalText.trim().length > 0;
  return caseB
    ? "M2_TEXT_BETA_REVIEWABLE_WITH_ONE_KNOWN_TECHNICAL_FALLBACK"
    : "M2_TEXT_BETA_STOPPED_WITH_BLOCKERS";
}

function writeCorpusEvidence(records: LiveRecord[], ledger: LiveBudgetLedger): void {
  mkdirSync(reportDirectory, { recursive: true });
  const groupCount = (group: Group) => records.filter((record) => record.group === group);
  const passed = records.filter((record) => record.status === "PASS").length;
  const finalState = m251
    ? determineM251FinalState(records)
    : passed === 39
      ? "M2_TEXT_BETA_READY_FOR_INDEPENDENT_HUMAN_REVIEW"
      : "M2_TEXT_BETA_STOPPED_WITH_BLOCKERS";
  const status = targetedM251
    ? passed === targetedExpectedTotal && records.length === targetedExpectedTotal
      ? "M2_5_1_TARGETED_PASS"
      : "M2_5_1_TARGETED_FAIL"
    : finalState;
  const technicalPass = targetedM251
    ? passed === targetedExpectedTotal && records.length === targetedExpectedTotal
    : finalState !== "M2_TEXT_BETA_STOPPED_WITH_BLOCKERS";
  const noFitDistribution = records.reduce<Record<string, number>>((result, record) => {
    if (record.noFitReason) result[record.noFitReason] = (result[record.noFitReason] ?? 0) + 1;
    return result;
  }, {});
  const report = [
    `# ${targetedM251 ? "M2.5.1 Four-Blocker Targeted Live Gate" : m251 ? "M2.5.1 Final Text Beta Live Corpus Gate" : "M2.5 Text Beta Live Corpus Gate"}`,
    "",
    `- Run ID: \`${ledger.runId}\``,
    `- Status: \`${status}\``,
    `- Result: ${passed}/${targetedM251 ? targetedExpectedTotal : 39}`,
    `- Core: ${groupCount("core").filter((item) => item.status === "PASS").length}/${targetedM251 ? targetedCaseIds.filter((id) => id.startsWith("core-")).length : 19}`,
    `- Opportunity: ${groupCount("opportunity").filter((item) => item.status === "PASS").length}/${targetedM251 ? targetedCaseIds.filter((id) => id.startsWith("opportunity-")).length : 12}`,
    `- Multi-Turn: ${groupCount("multi_turn").filter((item) => item.status === "PASS").length}/${targetedM251 ? targetedCaseIds.filter((id) => id.startsWith("multi-")).length : 8}`,
    `- Requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    `- English Chunk cases: ${records.filter((item) => item.englishChunks.length > 0).length}`,
    `- noFit cases: ${records.filter((item) => item.noFit).length}`,
    `- noFitReason distribution: ${JSON.stringify(noFitDistribution)}`,
    `- Natural Fallback: ${records.filter((item) => item.naturalFallback).length}`,
    `- Task Completeness failures: ${records.filter((item) => !item.taskComplete).length}`,
    `- Phrase replacement: ${records.filter((item) => item.phraseReplacedTask).length}`,
    `- Wrong context denial: ${records.filter((item) => item.wrongContextDenial).length}`,
    "- Deferred Core20 image scenario: image-overview = DEFERRED_BY_TEXT_BETA_SCOPE",
    "- Image input: disabled; Vision requests: 0",
    `- Independent Human Review: ${!targetedM251 && technicalPass ? "PENDING_INDEPENDENT_HUMAN_REVIEW" : "NOT_STARTED_OR_TARGETED_ONLY"}`,
    "- Natural Fallback is never counted as PASS.",
    "- Structural Benchmark is not naturalness evidence.",
    "- M3 blocked; Adaptive Progression disabled.",
    "",
    ...compactTable(records),
    "",
    "## Failures",
    "",
    ...records.filter((record) => record.status === "FAIL")
      .map((record) => `- ${record.id}: ${record.failures.join("; ")}`),
    ...(records.every((record) => record.status === "PASS") ? ["- none"] : []),
    "",
  ].join("\n");
  writeFileSync(reportPath, report, "utf8");
  writeFileSync(
    resultPath,
    `${JSON.stringify({
      status,
      finalState: targetedM251 ? undefined : finalState,
      deferredImageScenario: {
        id: "image-overview",
        status: "DEFERRED_BY_TEXT_BETA_SCOPE",
      },
      ledger,
      records,
    }, null, 2)}\n`,
    "utf8",
  );
}

function writeReviewPackage(
  records: LiveRecord[],
  ledger: LiveBudgetLedger,
  finalState: M251FinalState = "M2_TEXT_BETA_READY_FOR_INDEPENDENT_HUMAN_REVIEW",
): void {
  mkdirSync(reviewDirectory, { recursive: true });
  const byGroup = (group: Group) => records.filter((item) => item.group === group);
  const write = (name: string, title: string, body: string[]) => writeFileSync(
    join(reviewDirectory, name),
    [
      `# ${title}`,
      "",
      "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
      "",
      "图片功能在本 Text Beta 中暂不开放；历史 Vision 失败仍然存在，不计入 Text Beta PASS，后续作为独立 Vision Track 处理。",
      "",
      ...body,
      "",
    ].join("\n"),
    "utf8",
  );

  write("TEXT_CORE_CORPUS_REVIEW.md", "Text Core19 Corpus Review", [
    "原 Core20 的 `image-overview` 记录为 `DEFERRED_BY_TEXT_BETA_SCOPE`；下表为全部 19 条原始非图片场景。",
    "",
    ...compactTable(byGroup("core")),
  ]);
  write("NATURAL_OVERLAY_REVIEW.md", "Natural Overlay Opportunity12 Review", [
    "本表不设置 English Chunk 数量配额。请逐条判断候选、noFit 与实际回答是否自然。",
    "",
    ...compactTable(byGroup("opportunity")),
    "",
    "| Case | Candidate Pool | Selected | User Reuse | Natural Fallback |",
    "|---|---|---|---|---|",
    ...byGroup("opportunity").map((item) =>
      `| ${item.id} | ${cell(item.candidatePhrases.join(", ") || "none")} | ${item.selectedPhrase ?? "none"} | ${cell(item.userPhraseReuse ? JSON.stringify(item.userPhraseReuse) : "none")} | ${item.naturalFallback} |`),
  ]);
  write("MULTI_TURN_REVIEW.md", "Multi-Turn8 Review", [
    "实际 Message History、最终文本、Source Context 和状态如下。",
    "",
    ...compactTable(byGroup("multi_turn")),
    "",
    "| Case | Assistance | Reuse | Fixed / Effective | Wrong Context Denial |",
    "|---|---|---|---|---|",
    ...byGroup("multi_turn").map((item) =>
      `| ${item.id} | ${cell(item.assistance ? JSON.stringify(item.assistance) : "none")} | ${cell(item.userPhraseReuse ? JSON.stringify(item.userPhraseReuse) : "none")} | ${item.fixedLevel} / ${item.effectiveLevel} | ${item.wrongContextDenial} |`),
  ]);
  const assistanceRecords = byGroup("multi_turn").filter((item) =>
    ["multi-meaning", "multi-pronunciation", "multi-click"].includes(item.id));
  write("VOCABULARY_ASSISTANCE_REVIEW.md", "Vocabulary Assistance Review", [
    ...compactTable(assistanceRecords),
    "",
    "| Case | Assistance Context | Source Error | Fallback |",
    "|---|---|---|---|",
    ...assistanceRecords.map((item) =>
      `| ${item.id} | ${cell(item.assistance ? JSON.stringify(item.assistance) : "none")} | ${item.taskIssues.some((issue) => issue.startsWith("assistance_"))} | ${item.assistance?.assistanceContentFallback ?? "none"} |`),
  ]);
  const reuseRecords = records.filter((item) => item.userPhraseReuse);
  write("PHRASE_REUSE_REVIEW.md", "User Phrase Reuse Review", [
    ...compactTable(reuseRecords),
    "",
    "| Case | Reuse Evidence | Candidate Pool | Selected |",
    "|---|---|---|---|",
    ...reuseRecords.map((item) =>
      `| ${item.id} | ${cell(JSON.stringify(item.userPhraseReuse))} | ${cell(item.candidatePhrases.join(", "))} | ${item.selectedPhrase ?? "none"} |`),
  ]);
  write("TASK_COMPLETENESS_REVIEW.md", "Task Completeness Review", [
    "| Case | Complete | Obligations | Missing | Issues | Phrase Replaced Task | Final Text |",
    "|---|---|---|---|---|---|---|",
    ...records.map((item) =>
      `| ${item.id} | ${item.taskComplete} | ${cell(item.responseObligations.join(", "))} | ${cell(item.missingObligations.join(", ") || "none")} | ${cell(item.taskIssues.join(", ") || "none")} | ${item.phraseReplacedTask} | ${cell(item.finalText)} |`),
  ]);
  write("NO_FIT_REVIEW.md", "noFit Review", [
    "| Case | Source | Reason | Candidate Pool | Actual Final Text | Complete |",
    "|---|---|---|---|---|---|",
    ...records.filter((item) => item.noFit).map((item) =>
      `| ${item.id} | ${item.noFitSource} | ${item.noFitReason} | ${cell(item.candidatePhrases.join(", ") || "none")} | ${cell(item.finalText)} | ${item.taskComplete} |`),
  ]);
  const technicalRecords = records.filter((item) =>
    item.id.includes("technical") || item.naturalFallback);
  write("TECHNICAL_FALLBACK_REVIEW.md", "Technical Fallback Review", [
    `- Technical gate state: \`${finalState}\``,
    `- Natural Fallback count: ${records.filter((item) => item.naturalFallback).length}`,
    "- A Natural Fallback is shown as a failure and is never relabeled PASS.",
    "",
    ...compactTable(technicalRecords),
    "",
    "## Attempt evidence",
    "",
    "```json",
    JSON.stringify(technicalRecords.map((item) => ({
      id: item.id,
      finalText: item.finalText,
      status: item.status,
      naturalFallback: item.naturalFallback,
      taskComplete: item.taskComplete,
      attemptEvidence: item.attemptEvidence,
    })), null, 2),
    "```",
  ]);
  write("BETA_UI_REVIEW.md", "Text Beta UI Review", [
    "Technical evidence only; this is not a pre-filled human UX PASS.",
    "",
    "- Desktop screenshot: `../../screenshots/m2.5-text-beta-desktop.png`",
    "- 390×844 screenshot: `../../screenshots/m2.5-text-beta-mobile-390x844.png`",
    "- Mock E2E: 22/22, Live requests=0.",
    "- Technical checks cover normal chat landing, image entry absent, text send, English Chunk click, topic continuation, hidden Developer Panel, PWA manifest, history, new conversation and conversation switching.",
    "",
    "- [ ] Human reviewer confirms the app feels like normal chat.",
    "- [ ] Human reviewer confirms English Chunk styling is subtle.",
    "- [ ] Human reviewer confirms Assistance returns naturally to the topic.",
    "- [ ] Human reviewer confirms no course, check-in, task, or learning-score UI appears.",
  ]);
  write("LIVE_BUDGET_AUDIT.md", "Live Budget Audit", [
    `- Run ID: \`${ledger.runId}\``,
    `- Execution Mode: \`${ledger.executionMode}\``,
    `- Requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider Runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    `- Pending attempts: ${ledger.attempts.filter((item) => item.outcome === "pending").length}`,
    `- Unannotated attempts: ${ledger.attempts.filter((item) => item.pipelineOutcome === undefined).length}`,
    `- Vision attempts: ${ledger.attempts.filter((item) => item.provider.includes("vision")).length}`,
    "",
    "| Scenario | Provider / Model | Attempt | Outcome | Pipeline | Tokens | Latency |",
    "|---|---|---:|---|---|---:|---:|",
    ...ledger.attempts.map((item) =>
      `| ${item.scenarioId} | ${item.provider} / ${item.model} | ${item.attemptNumber} | ${item.outcome} | ${item.pipelineOutcome ?? "none"} | ${item.usage?.totalTokens ?? 0} | ${item.latencyMs ?? 0} |`),
    "",
    "No API key, Authorization header, full Directive, private environment value, or image byte is included.",
  ]);
  write("INDEPENDENT_REVIEW_CHECKLIST.md", "Independent Human Review Checklist", [
    "Do not infer human naturalness PASS from automated or structural PASS. Read every actual final text first.",
    "",
    "- [ ] Core19 has zero major task-completeness failures.",
    "- [ ] No Phrase replaces the actual answer.",
    "- [ ] No wrong denial of known Phrase history appears.",
    "- [ ] Vocabulary Assistance uses the correct source sentence and resumes the topic.",
    "- [ ] Explicit Chinese scope is respected.",
    "- [ ] Displayed English Chunks are natural in their actual sentences.",
    "- [ ] noFit is conservative without avoiding obvious opportunities.",
    "- [ ] No Teacher Mode, repeated translation, or label-like Overlay appears.",
    "- [ ] UI feels like ordinary chat on Desktop and Mobile.",
    "- [ ] Overall result: ____________________",
  ]);
  write("REVIEW_INDEX.md", "EOE Chat Text-First Beta Independent Review", [
    `Technical gate state: \`${finalState}\`.`,
    "",
    "Codex has not declared product naturalness PASS. Only an independent reviewer may set `M2_TEXT_BETA_HUMAN_REVIEW_PASS`.",
    "",
    "1. [Text Core19](./TEXT_CORE_CORPUS_REVIEW.md)",
    "2. [Natural Overlay Opportunity12](./NATURAL_OVERLAY_REVIEW.md)",
    "3. [Multi-Turn8](./MULTI_TURN_REVIEW.md)",
    "4. [Vocabulary Assistance](./VOCABULARY_ASSISTANCE_REVIEW.md)",
    "5. [Phrase Reuse](./PHRASE_REUSE_REVIEW.md)",
    "6. [Task Completeness](./TASK_COMPLETENESS_REVIEW.md)",
    "7. [noFit](./NO_FIT_REVIEW.md)",
    "8. [Beta UI](./BETA_UI_REVIEW.md)",
    "9. [Live Budget Audit](./LIVE_BUDGET_AUDIT.md)",
    "10. [Technical Fallback](./TECHNICAL_FALLBACK_REVIEW.md)",
    "11. [Independent Checklist](./INDEPENDENT_REVIEW_CHECKLIST.md)",
  ]);
}

live("M2.5 bounded Text Beta Corpus Gate", () => {
  it("runs Core19, Opportunity12, and Multi-Turn8 without Vision", async () => {
    const identityResponse = await fetch(
      `http://127.0.0.1:${process.env.EOE_TEST_PORT}/api/runtime-identity`,
    );
    expect(await identityResponse.json()).toMatchObject({
      executionMode: targetedM251 ? "live_probe" : "live_corpus",
      runId: process.env.EOE_LIVE_RUN_ID,
      port: targetedM251 ? 3200 : 3201,
      providerMode: "LiveProvider",
    });

    const coreCases = M24_CORE_CORPUS_IDS
      .map((id, originalIndex): LiveCase | undefined => {
        const scenario = GOLDEN_CONVERSATION_CORPUS.find((item) => item.id === id);
        if (!scenario || scenario.hasImage) return undefined;
        let request = textRequest(
          `core-${id}`,
          scenario.userMessage,
          scenario.recentExposurePhraseIds,
        );
        let checks: LiveCase["checks"];
        if (id === "ask-phrase-clarify") {
          request = multiTurnRequest({
            id: "core-ask-phrase-clarify",
            purpose: "history-grounded clarification",
            turns: [
              { role: "user", content: "这个方案先怎么处理？" },
              {
                role: "assistant",
                content: "For now，先保留可逆方案。",
                phraseId: "p-for-now",
              },
              { role: "user", content: scenario.userMessage },
            ],
          });
          checks = (result) => [
            result.diagnostics.assistance?.resolved
              ? ""
              : "phrase_history_not_resolved",
          ];
        }
        return {
          id: `core-${id}`,
          group: "core",
          provider: originalIndex % 2 === 0 ? glm : deepSeek,
          request,
          fixedLevel: scenario.fixedLevel ?? 2,
          checks,
        };
      })
      .filter((item): item is LiveCase => Boolean(item));
    expect(coreCases).toHaveLength(19);

    const opportunityCases: LiveCase[] = NATURAL_OVERLAY_OPPORTUNITY_CORPUS.map(
      (scenario) => ({
        id: `opportunity-${scenario.id}`,
        group: "opportunity",
        provider: scenario.provider === "glm" ? glm : deepSeek,
        request: textRequest(`opportunity-${scenario.id}`, scenario.userMessage),
        fixedLevel: scenario.fixedLevel,
      }),
    );
    const multiTurnCases: LiveCase[] = M24_MULTI_TURN_CORPUS.map(
      (scenario, index) => ({
        id: `multi-${scenario.id}`,
        group: "multi_turn",
        provider: index % 2 === 0 ? glm : deepSeek,
        request: multiTurnRequest(scenario),
        fixedLevel: 2,
        checks: (result, text) => [
          scenario.id === "difficulty" &&
          result.diagnostics.decision.effectiveLevel >= result.diagnostics.decision.fixedLevel
            ? "difficulty_did_not_lower_effective_level"
            : "",
          scenario.id === "chinese-scope" &&
          result.diagnostics.noFitDecisionSource !== "explicit_chinese_no_fit"
            ? "chinese_only_scope_not_respected"
            : "",
          scenario.id === "resume-english" &&
          result.diagnostics.userPhraseReuseOpportunity?.phraseId !== "p-i-think"
            ? "user_english_did_not_resume_overlay"
            : "",
          scenario.id === "reuse" && !result.diagnostics.userPhraseReuseOpportunity
            ? "user_phrase_reuse_not_detected"
            : "",
          ["meaning", "pronunciation", "click"].includes(scenario.id) &&
          (!result.diagnostics.assistance?.resolved ||
            !result.diagnostics.assistance.providerContentPass ||
            result.diagnostics.assistance.assistanceContentFallback)
            ? "vocabulary_assistance_provider_path_failed"
            : "",
          scenario.id === "ambiguity" &&
          (result.diagnostics.assistance?.resolved ||
            !result.diagnostics.assistance?.engineOwnedClarification ||
            result.diagnostics.attempts.length !== 0 ||
            !/哪一个|哪句|具体指/u.test(text))
            ? "multiple_phrase_ambiguity_not_clarified"
            : "",
        ].filter(Boolean),
      }),
    );

    const allCases = [...coreCases, ...opportunityCases, ...multiTurnCases];
    const targetedIds = new Set(targetedCaseIds);
    const selectedCases = targetedM251
      ? allCases.filter((scenario) => targetedIds.has(scenario.id))
      : allCases;
    if (targetedM251) {
      expect(selectedCases.map((scenario) => scenario.id)).toEqual(targetedCaseIds);
    }

    const records: LiveRecord[] = [];
    for (const scenario of selectedCases) {
      records.push(await runCase(scenario));
    }
    await liveBudgetGuard?.completeRun();
    const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
    writeCorpusEvidence(records, ledger);
    const finalState = determineM251FinalState(records);
    const technicalPass =
      (targetedM251
        ? records.length === targetedExpectedTotal && records.every((record) => record.status === "PASS")
        : m251
          ? finalState !== "M2_TEXT_BETA_STOPPED_WITH_BLOCKERS"
          : records.length === 39 && records.every((record) => record.status === "PASS")) &&
      ledger.attempts.every((attempt) =>
        attempt.outcome !== "pending" && attempt.pipelineOutcome !== undefined) &&
      ledger.attempts.every((attempt) => !attempt.provider.includes("vision"));
    if (technicalPass && !targetedM251) {
      writeReviewPackage(records, ledger, m251
        ? finalState
        : "M2_TEXT_BETA_READY_FOR_INDEPENDENT_HUMAN_REVIEW");
    }
    const failures = records.filter((record) => record.status === "FAIL");
    expect(
      technicalPass,
      failures.map((record) => `${record.id}: ${record.failures.join(", ")}`).join("; "),
    ).toBe(true);
  }, 90 * 60_000);
});
