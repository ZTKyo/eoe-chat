import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { segmentsToPlainText, type ChatRequest, type WireAttachment } from "@/domain/chat";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import type { Provider, ProviderRequest, ProviderResult } from "./types";
import { ProviderGateway } from "./gateway";
import { LiveBudgetGuard, type LiveBudgetLedger } from "./live-budget-guard";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";

const enabled = process.env.EOE_M2_4_2_FOCUSED_LIVE === "true" &&
  process.env.EOE_EXECUTION_MODE === "live_probe" &&
  process.env.EOE_ALLOW_LIVE_PROVIDER === "true" &&
  process.env.USE_MOCK_PROVIDER === "false" &&
  Boolean(process.env.EOE_LIVE_RUN_ID?.trim() && process.env.EOE_LIVE_LEDGER_PATH?.trim()) &&
  Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim());
const live = enabled ? describe : describe.skip;
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const reportDirectory = join(process.cwd(), "artifacts", "benchmarks");
const budgetPath = process.env.EOE_LIVE_LEDGER_PATH ?? join(reportDirectory, "m2.4.2-focused-live-budget.json");
const reportPath = join(reportDirectory, "m2.4.2-focused-probe-report.md");
const targetedRetry = process.env.EOE_M2_4_2_TARGETED_RETRY === "true";
let activeCaseId = "unassigned";
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
        scenarioId: activeCaseId,
        conversationTurnId: `${activeCaseId}-turn-final`,
      },
    });
  }
}

function provider(options: { id: string; modelId: string; apiKey: string; baseUrl: string; vision?: boolean }): Provider {
  if (!liveBudgetGuard) return new MockProvider();
  return new ScenarioProvider(new OpenAICompatibleProvider({
    id: options.id,
    modelId: options.modelId,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    timeoutMs,
    thinking: "disabled",
    liveBudgetGuard,
    capabilities: {
      text: true,
      vision: options.vision ?? false,
      streaming: false,
      jsonMode: !(options.vision ?? false),
      jsonSchema: false,
      toolCalling: false,
    },
  }));
}

const glm = provider({
  id: "glm",
  modelId: process.env.PRIMARY_MODEL ?? "glm-4.7",
  apiKey: process.env.GLM_API_KEY?.trim() ?? "",
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
});
const vision = provider({
  id: "glm-vision",
  modelId: process.env.VISION_MODEL ?? "glm-4.6v",
  apiKey: process.env.GLM_API_KEY?.trim() ?? "",
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
  vision: true,
});
const deepSeek = provider({
  id: "deepseek",
  modelId: process.env.FALLBACK_MODEL ?? "deepseek-v4-flash",
  apiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
  baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});
const mock = new MockProvider();

async function renderFixture(name: string): Promise<WireAttachment> {
  const source = readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
    await page.setContent(source);
    const bytes = await page.screenshot({ type: "png" });
    return {
      id: `fixture-${name}`,
      name: name.replace(/\.svg$/u, ".png"),
      mimeType: "image/png",
      size: bytes.length,
      dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    };
  } finally {
    await browser.close();
  }
}

function request(id: string, content: string, attachment?: WireAttachment): ChatRequest {
  return {
    conversationId: `m2-4-1-${id}`,
    messages: [{ id: `${id}-u1`, role: "user", content }],
    attachments: attachment ? [attachment] : [],
    engineState: { recentExposurePhraseIds: [], developerMode: true, benchmarkType: "live_evidence" },
  };
}

function assistanceRequest(): ChatRequest {
  return {
    conversationId: "m2-4-1-assistance",
    messages: [
      { id: "assist-u1", role: "user", content: "我想安排本周的阅读计划，先从哪一步开始？" },
      {
        id: "assist-a1",
        role: "assistant",
        content: "For now，先确定本周要读完的一本书。",
        segments: [
          { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: true, assistanceAvailable: true },
          { type: "text", content: "，先确定本周要读完的一本书。", language: "zh" },
        ],
      },
      { id: "assist-u2", role: "user", content: "刚才的 For now 是什么意思，怎么读？解释后请继续帮我安排阅读。" },
    ],
    attachments: [],
    engineState: {
      recentExposurePhraseIds: ["p-for-now"],
      developerMode: true,
      benchmarkType: "live_evidence",
      assistanceRequest: { trigger: "pronunciation", sourceMessageId: "assist-a1", segmentIndex: 0, phraseId: "p-for-now" },
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
  input: string;
  finalText: string;
  englishChunks: string[];
  noFit: boolean;
  noFitReason?: string;
  noFitSource?: string;
  candidates: string[];
  attempts: number;
  taskComplete: boolean;
  naturalFallback: boolean;
  observation?: EngineRunResult["diagnostics"]["visionObservation"];
  assistance?: EngineRunResult["diagnostics"]["assistance"];
  reuse?: EngineRunResult["diagnostics"]["userPhraseReuseOpportunity"];
  providerOutputs: string[];
};

function commonFailures(result: EngineRunResult): string[] {
  return [
    result.diagnostics.finalValidation.valid ? "" : "final_validator_failed",
    result.diagnostics.taskCompleteness.complete ? "" : `task_incomplete:${result.diagnostics.taskCompleteness.issues.join(",")}`,
    result.diagnostics.naturalFallbackUsed ? "natural_fallback_used" : "",
    result.diagnostics.attempts.length > 2 ? "attempt_budget_exceeded" : "",
  ].filter(Boolean);
}

async function runCase(spec: FocusedCase): Promise<FocusedRecord> {
  activeCaseId = spec.id;
  const gateway = new ProviderGateway({ primary: spec.provider, vision: spec.provider, mock, forceMock: false });
  try {
    const result = await runEoeEngine({
      request: spec.request,
      gateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
      naturalnessMode: "live",
    });
    const text = segmentsToPlainText(result.response.segments);
    const failures = [...commonFailures(result), ...spec.check(result, text)].filter(Boolean);
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: failures.length === 0 ? "pass" : "fail",
      violationCodes: [
        ...new Set(result.diagnostics.attempts.flatMap((attempt) =>
          attempt.validation.violations.map((violation) => violation.code))),
      ],
      fallback: result.diagnostics.attempts.some((attempt) => attempt.providerFallbackUsed),
      naturalFallback: result.diagnostics.naturalFallbackUsed,
    });
    return {
      id: spec.id,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      input: [...spec.request.messages].reverse().find((message) => message.role === "user")?.content ?? "",
      finalText: text,
      englishChunks: result.response.segments.filter((segment) => segment.type === "english_chunk").map((segment) => segment.content),
      noFit: result.response.noFit,
      noFitReason: result.diagnostics.noFitReason,
      noFitSource: result.diagnostics.noFitDecisionSource,
      candidates: result.diagnostics.selection.candidates.map((candidate) => candidate.phraseId),
      attempts: result.diagnostics.attempts.length,
      taskComplete: result.diagnostics.taskCompleteness.complete,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      observation: result.diagnostics.visionObservation,
      assistance: result.diagnostics.assistance,
      reuse: result.diagnostics.userPhraseReuseOpportunity,
      providerOutputs: [
        result.diagnostics.visionObservation?.providerOutputPreview,
        ...result.diagnostics.attempts.map((attempt) => attempt.providerOutputPreview),
      ].filter((value): value is string => Boolean(value)),
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
      input: [...spec.request.messages].reverse().find((message) => message.role === "user")?.content ?? "",
      finalText: "",
      englishChunks: [],
      noFit: false,
      candidates: [],
      attempts: 0,
      taskComplete: false,
      naturalFallback: false,
      providerOutputs: [],
    };
  }
}

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function writeReport(
  records: FocusedRecord[],
  targetPath = reportPath,
  expectedCount = 7,
  passingStatus = "M2_4_2_FOCUSED_PROBE_PASS",
): void {
  mkdirSync(reportDirectory, { recursive: true });
  const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
  const passed = records.filter((record) => record.status === "PASS").length;
  const status = passed === expectedCount ? passingStatus : "M2_4_2_STOPPED_WITH_BLOCKERS";
  const body = [
    "# M2.4.2 Focused Live Provider Probe",
    "",
    `- Run ID: \`${ledger.runId}\``,
    `- Status: \`${status}\``,
    `- Result: ${passed}/${expectedCount}`,
    `- Requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    "- Natural Fallback is never counted as PASS.",
    "- Assistance Engine fallback is usable but is not a Provider Assistance PASS.",
    "- Secrets, Authorization headers, full Directives, and image bytes are not recorded.",
    "",
    "| Case | Status | Provider / Model | Actual Input | Actual Final Text | English / noFit | Attempts | Failures |",
    "|---|---|---|---|---|---|---:|---|",
    ...records.map((record) => `| ${record.id} | ${record.status} | ${record.provider} / ${record.model} | ${cell(record.input)} | ${cell(record.finalText)} | ${cell(record.englishChunks.join(", ") || "none")} / ${record.noFit} / ${record.noFitSource ?? "none"} / ${record.noFitReason ?? "none"} | ${record.attempts} | ${cell(record.failures.join("; ") || "none")} |`),
    "",
    "## Grounding, Assistance, and Reuse Evidence",
    "",
    ...records.map((record) => [
      `### ${record.id}`,
      "",
      `- Candidate IDs: ${record.candidates.join(", ") || "none"}`,
      `- Task complete: ${record.taskComplete}`,
      `- Natural Fallback: ${record.naturalFallback}`,
      `- Observation: ${record.observation ? cell(JSON.stringify({ valid: record.observation.valid, envelope: record.observation.envelope, violations: record.observation.violationCodes })) : "none"}`,
      `- Assistance: ${record.assistance ? cell(JSON.stringify(record.assistance)) : "none"}`,
      `- Reuse: ${record.reuse ? cell(JSON.stringify(record.reuse)) : "none"}`,
      `- Provider outputs: ${record.providerOutputs.length ? cell(record.providerOutputs.join(" || ")) : "none"}`,
      "",
    ]).flat(),
  ].join("\n");
  writeFileSync(targetPath, `${body}\n`, "utf8");
}

live("M2.4.2 isolated bounded Focused Provider Probe", () => {
  it("runs the corrected seven-scenario gate", async () => {
    const identityResponse = await fetch(`http://127.0.0.1:${process.env.EOE_TEST_PORT}/api/runtime-identity`);
    const identity = await identityResponse.json() as Record<string, unknown>;
    expect(identity).toMatchObject({
      executionMode: "live_probe",
      runId: process.env.EOE_LIVE_RUN_ID,
      port: 3200,
      providerMode: "LiveProvider",
    });
    const geometry = await renderFixture("m2.4-geometry.svg");
    const ui = await renderFixture("m2.4-ui-text.svg");
    const cases: FocusedCase[] = [
      {
        id: "glm-natural-english-chunk",
        provider: glm,
        request: request("glm-natural-english-chunk", "你觉得每天散步二十分钟值得坚持吗？请说明理由。"),
        check: (result) => [
          result.response.segments.some((segment) => segment.type === "english_chunk") ? "" : "english_chunk_missing",
          result.response.noFit ? "unexpected_no_fit" : "",
          result.diagnostics.attempts.some((attempt) => attempt.pipeline?.templateParse === "passed" && attempt.pipeline?.mapper === "passed" && attempt.pipeline?.domainSchema === "passed" && attempt.pipeline?.domainValidator === "passed") ? "" : "structured_pipeline_incomplete",
        ],
      },
      {
        id: "glm-explicit-chinese-no-fit",
        provider: glm,
        request: request("glm-explicit-chinese-no-fit", "请只用中文说明我今天应该先做什么，并给出两个具体步骤。"),
        check: (result, text) => [
          result.response.noFit ? "" : "no_fit_missing",
          result.diagnostics.noFitReason === "explicit_chinese_request" ? "" : `wrong_no_fit_reason:${result.diagnostics.noFitReason}`,
          result.response.segments.some((segment) => segment.type === "english_chunk") ? "unexpected_english_chunk" : "",
          /[A-Za-z]{2,}/u.test(text) ? "non_chinese_surface" : "",
        ],
      },
      {
        id: "glm-vision-grounded-image",
        provider: vision,
        request: request("glm-vision-grounded-image", "请分析图中可见的形状、颜色和相对位置，并区分观察与推测。", geometry),
        check: (result) => [
          result.diagnostics.visionObservation?.valid ? "" : "vision_observation_invalid",
          result.diagnostics.visionObservation?.envelope?.observations.length ? "" : "vision_observation_empty",
          result.diagnostics.decision.mode === "disabled_for_image" ? "" : `wrong_overlay_mode:${result.diagnostics.decision.mode}`,
          result.response.segments.some((segment) => segment.type === "english_chunk") ? "unexpected_automatic_overlay" : "",
          result.response.noFit && result.diagnostics.noFitDecisionSource === "image_overlay_deferred" ? "" : "image_no_fit_source_mismatch",
        ],
      },
      {
        id: "glm-vision-chinese-image",
        provider: vision,
        request: request("glm-vision-chinese-image", "请只用中文分析界面中的标题、按钮和状态信息，并说明哪些内容无法确定。", ui),
        check: (result, text) => [
          result.diagnostics.visionObservation?.valid ? "" : "vision_observation_invalid",
          result.diagnostics.decision.mode === "disabled_for_image" ? "" : `wrong_overlay_mode:${result.diagnostics.decision.mode}`,
          result.response.segments.some((segment) => segment.type === "english_chunk") ? "unexpected_automatic_overlay" : "",
          /[A-Za-z]{2,}/u.test(text) ? "non_chinese_surface" : "",
          ["image_overlay_deferred", "explicit_chinese_request"].includes(result.diagnostics.noFitReason ?? "") ? "" : `wrong_no_fit_reason:${result.diagnostics.noFitReason}`,
        ],
      },
      {
        id: "deepseek-actionable-plan",
        provider: deepSeek,
        request: request("deepseek-actionable-plan", "帮我制定一个下周学习计划：要有时间或阶段、每阶段具体任务、优先级，以及周末复盘调整方式。"),
        check: (result) => [
          result.diagnostics.responseObligations.some((item) => item.kind === "provide_plan" && item.planRequirements?.needsTimeline && item.planRequirements.needsStages && item.planRequirements.needsTasks && item.planRequirements.needsFeedbackLoop) ? "" : "plan_requirements_missing",
          result.diagnostics.taskCompleteness.issues.length === 0 ? "" : `plan_issues:${result.diagnostics.taskCompleteness.issues.join(",")}`,
        ],
      },
      {
        id: "glm-vocabulary-assistance-v2",
        provider: glm,
        request: assistanceRequest(),
        check: (result, text) => [
          result.diagnostics.assistance?.resolved ? "" : "assistance_context_unresolved",
          result.diagnostics.assistance?.contextVersion === "eoe.assistance-context.v2" ? "" : "wrong_assistance_context_version",
          result.diagnostics.assistance?.providerContentPass && !result.diagnostics.assistance.assistanceContentFallback ? "" : "provider_assistance_not_passed",
          text.includes("For now，先确定本周要读完的一本书。") ? "" : "source_sentence_missing",
          text.includes("for now") ? "" : "phrase_missing",
          text.includes("/fɔːr naʊ/") ? "" : "registry_pronunciation_missing",
          /在这里|语境|意思|表示/u.test(text) ? "" : "contextual_meaning_missing",
          /继续原来的话题/u.test(text) ? "" : "topic_continuation_missing",
        ],
      },
      {
        id: "deepseek-user-phrase-reuse",
        provider: deepSeek,
        request: request("deepseek-user-phrase-reuse", "I think this plan is useful，你怎么看？请给出你的判断和理由。"),
        check: (result) => [
          result.diagnostics.userPhraseReuseOpportunity?.phraseId === "p-i-think" ? "" : "reuse_opportunity_not_detected",
          result.diagnostics.selection.candidates.length > 0 ? "" : "candidate_pool_unexpectedly_empty",
          result.response.noFit && !result.diagnostics.noFitReason ? "no_fit_reason_missing" : "",
        ],
      },
    ];

    if (targetedRetry) {
      writeFileSync(
        join(reportDirectory, "m2.4.2-focused-probe-cycle-1-report.md"),
        readFileSync(reportPath, "utf8"),
        "utf8",
      );
      const affectedIds = new Set([
        "glm-vision-grounded-image",
        "glm-vision-chinese-image",
        "deepseek-user-phrase-reuse",
      ]);
      const affectedRecords: FocusedRecord[] = [];
      for (const spec of cases.filter((item) => affectedIds.has(item.id))) {
        affectedRecords.push(await runCase(spec));
      }
      writeReport(
        affectedRecords,
        join(reportDirectory, "m2.4.2-focused-targeted-affected-report.md"),
        3,
        "M2_4_2_TARGETED_AFFECTED_PASS",
      );
      const affectedFailures = affectedRecords.filter((record) => record.status === "FAIL");
      expect(
        affectedFailures,
        affectedFailures.map((record) => `${record.id}: ${record.failures.join(", ")}`).join("; "),
      ).toHaveLength(0);
    }

    const records: FocusedRecord[] = [];
    for (const spec of cases) records.push(await runCase(spec));
    await liveBudgetGuard?.completeRun();
    writeReport(records);
    const failed = records.filter((record) => record.status === "FAIL");
    expect(failed, failed.map((record) => `${record.id}: ${record.failures.join(", ")}`).join("; ")).toHaveLength(0);
  }, 30 * 60_000);
});
