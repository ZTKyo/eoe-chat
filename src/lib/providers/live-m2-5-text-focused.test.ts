import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { segmentsToPlainText, type ChatRequest } from "@/domain/chat";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { ProviderGateway } from "./gateway";
import { LiveBudgetGuard, type LiveBudgetLedger } from "./live-budget-guard";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { Provider, ProviderRequest, ProviderResult } from "./types";

const enabled = process.env.EOE_M2_5_TEXT_FOCUSED_LIVE === "true" &&
  process.env.EOE_EXECUTION_MODE === "live_probe" &&
  process.env.EOE_ALLOW_LIVE_PROVIDER === "true" &&
  process.env.USE_MOCK_PROVIDER === "false" &&
  process.env.EOE_ENABLE_IMAGE_INPUT === "false" &&
  Boolean(process.env.EOE_LIVE_RUN_ID?.trim() && process.env.EOE_LIVE_LEDGER_PATH?.trim()) &&
  Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim());
const live = enabled ? describe : describe.skip;
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const reportDirectory = join(process.cwd(), "artifacts", "benchmarks");
const budgetPath = process.env.EOE_LIVE_LEDGER_PATH ??
  join(reportDirectory, "m2.5-text-focused-budget.json");
const reportPath = join(reportDirectory, "m2.5-text-focused-report.md");
const resultPath = join(reportDirectory, "m2.5-text-focused-results.json");
const targetedRetry = process.env.EOE_M2_5_TEXT_FOCUSED_TARGETED_RETRY === "true";
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

function textRequest(id: string, content: string): ChatRequest {
  return {
    conversationId: `m2-5-focused-${id}`,
    messages: [{ id: `${id}-u1`, role: "user", content }],
    attachments: [],
    engineState: {
      recentExposurePhraseIds: [],
      developerMode: true,
      benchmarkType: "live_evidence",
    },
  };
}

function assistanceRequest(): ChatRequest {
  return {
    conversationId: "m2-5-focused-assistance",
    messages: [
      { id: "assist-u1", role: "user", content: "我想安排本周的阅读计划，先从哪一步开始？" },
      {
        id: "assist-a1",
        role: "assistant",
        content: "For now，先确定本周要读完的一本书。",
        segments: [
          {
            type: "english_chunk",
            content: "For now",
            phraseId: "p-for-now",
            isNew: true,
            assistanceAvailable: true,
          },
          { type: "text", content: "，先确定本周要读完的一本书。", language: "zh" },
        ],
      },
      {
        id: "assist-u2",
        role: "user",
        content: "刚才的 For now 是什么意思，怎么读？解释后请继续帮我安排阅读。",
      },
    ],
    attachments: [],
    engineState: {
      recentExposurePhraseIds: ["p-for-now"],
      developerMode: true,
      benchmarkType: "live_evidence",
      assistanceRequest: {
        trigger: "pronunciation",
        sourceMessageId: "assist-a1",
        segmentIndex: 0,
        phraseId: "p-for-now",
      },
    },
  };
}

type FocusedCase = {
  id: string;
  provider: Provider;
  request: ChatRequest;
  check: (result: EngineRunResult, text: string) => string[];
};

type FocusedRecord = {
  id: string;
  status: "PASS" | "FAIL";
  failures: string[];
  provider: string;
  model: string;
  history: Array<{ role: string; content: string }>;
  finalText: string;
  conversationFunction: string;
  responseObligations: string[];
  candidates: string[];
  selectedPhrase?: string;
  englishChunks: string[];
  phrasePosition?: string;
  noFit: boolean;
  noFitSource?: string;
  noFitReason?: string;
  attempts: number;
  violationCodes: string[];
  taskComplete: boolean;
  naturalFallback: boolean;
  latencyMs: number;
  tokens: number;
  assistance?: EngineRunResult["diagnostics"]["assistance"];
  reuse?: EngineRunResult["diagnostics"]["userPhraseReuseOpportunity"];
  providerOutputs: string[];
};

function commonFailures(result: EngineRunResult): string[] {
  return [
    result.diagnostics.finalValidation.valid ? "" : "final_validator_failed",
    result.diagnostics.taskCompleteness.complete
      ? ""
      : `task_incomplete:${result.diagnostics.taskCompleteness.issues.join(",")}`,
    result.diagnostics.naturalFallbackUsed ? "natural_fallback_used" : "",
    result.diagnostics.attempts.length >= 1 && result.diagnostics.attempts.length <= 2
      ? ""
      : `invalid_attempt_count:${result.diagnostics.attempts.length}`,
  ].filter(Boolean);
}

async function runCase(spec: FocusedCase): Promise<FocusedRecord> {
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
      config: { enabled: true, fixedLevel: 2, developerMode: true },
      naturalnessMode: "live",
    });
    const text = segmentsToPlainText(result.response.segments);
    const failures = [...commonFailures(result), ...spec.check(result, text)].filter(Boolean);
    const violationCodes = [
      ...new Set(result.diagnostics.attempts.flatMap((attempt) =>
        attempt.validation.violations.map((violation) => violation.code))),
    ];
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: failures.length === 0 ? "pass" : "fail",
      violationCodes,
      fallback: result.diagnostics.attempts.some((attempt) => attempt.providerFallbackUsed),
      naturalFallback: result.diagnostics.naturalFallbackUsed,
    });
    return {
      id: spec.id,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      finalText: text,
      conversationFunction: result.diagnostics.analysis.primaryFunction,
      responseObligations: result.diagnostics.responseObligations.map((item) => item.id),
      candidates: result.diagnostics.selection.candidates.map((candidate) => candidate.phraseId),
      selectedPhrase: result.diagnostics.selection.selectedPhraseId,
      englishChunks: result.response.segments
        .filter((segment) => segment.type === "english_chunk")
        .map((segment) => segment.content),
      phrasePosition: result.diagnostics.realizedPhrasePosition,
      noFit: result.response.noFit,
      noFitSource: result.diagnostics.noFitDecisionSource,
      noFitReason: result.diagnostics.noFitReason,
      attempts: result.diagnostics.attempts.length,
      violationCodes,
      taskComplete: result.diagnostics.taskCompleteness.complete,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      latencyMs: result.provider.latencyMs,
      tokens: result.provider.usage?.totalTokens ?? 0,
      assistance: result.diagnostics.assistance,
      reuse: result.diagnostics.userPhraseReuseOpportunity,
      providerOutputs: result.diagnostics.attempts
        .map((attempt) => attempt.providerOutputPreview)
        .filter((preview): preview is string => Boolean(preview)),
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
      status: "FAIL",
      failures: [error instanceof Error ? error.message : "unknown_live_error"],
      provider: spec.provider.id,
      model: spec.provider.modelId,
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      finalText: "",
      conversationFunction: "not_reached",
      responseObligations: [],
      candidates: [],
      englishChunks: [],
      noFit: false,
      attempts: 0,
      violationCodes: [],
      taskComplete: false,
      naturalFallback: false,
      latencyMs: 0,
      tokens: 0,
      providerOutputs: [],
    };
  }
}

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function writeEvidence(
  records: FocusedRecord[],
  options: {
    markdownPath?: string;
    jsonPath?: string;
    expectedCount?: number;
    passingStatus?: string;
  } = {},
): void {
  mkdirSync(reportDirectory, { recursive: true });
  const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
  const passed = records.filter((record) => record.status === "PASS").length;
  const expectedCount = options.expectedCount ?? 5;
  const status = passed === expectedCount
    ? options.passingStatus ?? "M2_5_TEXT_FOCUSED_PASS"
    : "M2_TEXT_BETA_STOPPED_WITH_BLOCKERS";
  const report = [
    "# M2.5 Text Focused Live Provider Gate",
    "",
    `- Run ID: \`${ledger.runId}\``,
    `- Status: \`${status}\``,
    `- Result: ${passed}/${expectedCount}`,
    `- Requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    "- Image input: disabled; Vision requests: 0",
    "- Natural Fallback is never counted as PASS.",
    "- Secrets, headers, full Directives, and private environment values are not recorded.",
    "",
    "| Case | Status | Provider / Model | Actual Final Text | Phrase / Position | noFit / Source / Reason | Attempts | Violations | Failures |",
    "|---|---|---|---|---|---|---:|---|---|",
    ...records.map((record) =>
      `| ${record.id} | ${record.status} | ${record.provider} / ${record.model} | ${cell(record.finalText)} | ${cell(record.englishChunks.join(", ") || "none")} / ${record.phrasePosition ?? "none"} | ${record.noFit} / ${record.noFitSource ?? "none"} / ${record.noFitReason ?? "none"} | ${record.attempts} | ${cell(record.violationCodes.join(", ") || "none")} | ${cell(record.failures.join("; ") || "none")} |`),
    "",
    "## Per-scenario Evidence",
    "",
    ...records.flatMap((record) => [
      `### ${record.id}`,
      "",
      `- Actual history: \`${cell(JSON.stringify(record.history))}\``,
      `- Conversation Function: ${record.conversationFunction}`,
      `- Response Obligations: ${record.responseObligations.join(", ") || "none"}`,
      `- Candidate Pool: ${record.candidates.join(", ") || "none"}`,
      `- Selected Phrase: ${record.selectedPhrase ?? "none"}`,
      `- Task Complete: ${record.taskComplete}`,
      `- Natural Fallback: ${record.naturalFallback}`,
      `- Vocabulary Assistance: ${record.assistance ? cell(JSON.stringify(record.assistance)) : "none"}`,
      `- User Phrase Reuse: ${record.reuse ? cell(JSON.stringify(record.reuse)) : "none"}`,
      `- Provider output previews: ${cell(record.providerOutputs.join(" || ")) || "none"}`,
      "",
    ]),
  ].join("\n");
  writeFileSync(options.markdownPath ?? reportPath, `${report}\n`, "utf8");
  writeFileSync(
    options.jsonPath ?? resultPath,
    `${JSON.stringify({ status, ledger, records }, null, 2)}\n`,
    "utf8",
  );
}

live("M2.5 bounded Text Focused Provider Gate", () => {
  it("runs the five text-only release-gate scenarios", async () => {
    const identityResponse = await fetch(
      `http://127.0.0.1:${process.env.EOE_TEST_PORT}/api/runtime-identity`,
    );
    expect(await identityResponse.json()).toMatchObject({
      executionMode: "live_probe",
      runId: process.env.EOE_LIVE_RUN_ID,
      port: 3200,
      providerMode: "LiveProvider",
    });

    const cases: FocusedCase[] = [
      {
        id: "glm-natural-overlay",
        provider: glm,
        request: textRequest(
          "glm-natural-overlay",
          "你觉得每天散步二十分钟值得坚持吗？请说明理由，并给出一个容易开始的做法。",
        ),
        check: (result) => [
          result.response.segments.some((segment) => segment.type === "english_chunk")
            ? ""
            : "english_chunk_missing",
          result.response.noFit ? "unexpected_no_fit" : "",
          result.diagnostics.attempts.some((attempt) =>
            attempt.pipeline?.templateParse === "passed" &&
            attempt.pipeline.mapper === "passed" &&
            attempt.pipeline.domainSchema === "passed" &&
            attempt.pipeline.domainValidator === "passed")
            ? ""
            : "structured_pipeline_incomplete",
        ],
      },
      {
        id: "glm-explicit-chinese",
        provider: glm,
        request: textRequest(
          "glm-explicit-chinese",
          "请只用中文说明我今天应该先做什么，并给出两个具体步骤。",
        ),
        check: (result, text) => [
          result.response.noFit ? "" : "no_fit_missing",
          result.diagnostics.noFitReason === "explicit_chinese_request"
            ? ""
            : `wrong_no_fit_reason:${result.diagnostics.noFitReason}`,
          result.response.segments.some((segment) => segment.type === "english_chunk")
            ? "unexpected_english_chunk"
            : "",
          /[A-Za-z]{2,}/u.test(text) ? "non_chinese_surface" : "",
        ],
      },
      {
        id: "deepseek-actionable-plan",
        provider: deepSeek,
        request: textRequest(
          "deepseek-actionable-plan",
          "帮我制定一个下周学习计划：要有时间或阶段、每阶段具体任务、优先级，以及周末复盘调整方式。",
        ),
        check: (result) => [
          result.diagnostics.responseObligations.some((item) =>
            item.kind === "provide_plan" &&
            item.planRequirements?.needsTimeline &&
            item.planRequirements.needsStages &&
            item.planRequirements.needsTasks &&
            item.planRequirements.needsFeedbackLoop)
            ? ""
            : "plan_requirements_missing",
          result.diagnostics.taskCompleteness.issues.length === 0
            ? ""
            : `plan_issues:${result.diagnostics.taskCompleteness.issues.join(",")}`,
        ],
      },
      {
        id: "glm-vocabulary-assistance",
        provider: glm,
        request: assistanceRequest(),
        check: (result, text) => [
          result.diagnostics.assistance?.resolved ? "" : "assistance_context_unresolved",
          result.diagnostics.assistance?.contextVersion === "eoe.assistance-context.v2"
            ? ""
            : "wrong_assistance_context_version",
          result.diagnostics.assistance?.providerContentPass &&
          !result.diagnostics.assistance.assistanceContentFallback
            ? ""
            : "provider_assistance_not_passed",
          text.includes("For now，先确定本周要读完的一本书。")
            ? ""
            : "source_sentence_missing",
          text.toLocaleLowerCase().includes("for now") ? "" : "phrase_missing",
          text.includes("/fɔːr naʊ/") ? "" : "registry_pronunciation_missing",
          /在这里[：:].*(?:暂时|目前)|在这句话|意思是/u.test(text)
            ? ""
            : "contextual_meaning_missing",
          /继续原来的话题/u.test(text) ? "" : "topic_continuation_missing",
        ],
      },
      {
        id: "deepseek-user-phrase-reuse",
        provider: deepSeek,
        request: textRequest(
          "deepseek-user-phrase-reuse",
          "I think this plan is useful，你怎么看？请给出你的判断和理由。",
        ),
        check: (result) => [
          result.diagnostics.userPhraseReuseOpportunity?.phraseId === "p-i-think"
            ? ""
            : "reuse_opportunity_not_detected",
          result.diagnostics.selection.candidates.some((candidate) =>
            candidate.phraseId === "p-i-think" && candidate.isReuse)
            ? ""
            : "reuse_candidate_missing",
          result.diagnostics.selection.candidates.length > 0
            ? ""
            : "candidate_pool_unexpectedly_empty",
          result.response.noFit && !result.diagnostics.noFitReason
            ? "no_fit_reason_missing"
            : "",
        ],
      },
    ];

    if (targetedRetry) {
      writeFileSync(
        join(reportDirectory, "m2.5-text-focused-cycle-1-report.md"),
        readFileSync(reportPath, "utf8"),
        "utf8",
      );
      writeFileSync(
        join(reportDirectory, "m2.5-text-focused-cycle-1-results.json"),
        readFileSync(resultPath, "utf8"),
        "utf8",
      );
      const affectedIds = new Set([
        "deepseek-actionable-plan",
        "glm-vocabulary-assistance",
      ]);
      const affectedRecords: FocusedRecord[] = [];
      for (const scenario of cases.filter((item) => affectedIds.has(item.id))) {
        affectedRecords.push(await runCase(scenario));
      }
      writeEvidence(affectedRecords, {
        markdownPath: join(reportDirectory, "m2.5-text-focused-targeted-affected-report.md"),
        jsonPath: join(reportDirectory, "m2.5-text-focused-targeted-affected-results.json"),
        expectedCount: 2,
        passingStatus: "M2_5_TEXT_FOCUSED_TARGETED_AFFECTED_PASS",
      });
      const affectedFailures = affectedRecords.filter((record) => record.status === "FAIL");
      expect(
        affectedFailures,
        affectedFailures.map((record) => `${record.id}: ${record.failures.join(", ")}`).join("; "),
      ).toHaveLength(0);
    }

    const records: FocusedRecord[] = [];
    for (const scenario of cases) records.push(await runCase(scenario));
    await liveBudgetGuard?.completeRun();
    writeEvidence(records);
    const failures = records.filter((record) => record.status === "FAIL");
    expect(
      failures,
      failures.map((record) => `${record.id}: ${record.failures.join(", ")}`).join("; "),
    ).toHaveLength(0);
  }, 30 * 60_000);
});
