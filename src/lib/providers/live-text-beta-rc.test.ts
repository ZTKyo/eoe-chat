import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  segmentsToPlainText,
  type ChatRequest,
  type MessageSegment,
} from "@/domain/chat";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { findUnsupportedQuantitativeClaims } from "@/lib/eoe/quantitative-claim";
import { reviewResponseDepth } from "@/lib/eoe/response-depth";
import { getPhraseById } from "@/lib/eoe/registry/phrase-registry";
import { reviewTechnicalDistinction } from "@/lib/eoe/technical-segment-classification";
import { reviewExecutionAccounting } from "@/lib/eoe/execution-accounting";
import { ProviderGateway } from "./gateway";
import { LiveBudgetGuard, type LiveBudgetLedger } from "./live-budget-guard";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { Provider, ProviderRequest, ProviderResult } from "./types";

const enabled =
  process.env.EOE_TEXT_BETA_RC_LIVE === "true" &&
  process.env.EOE_EXECUTION_MODE === "live_corpus" &&
  process.env.EOE_ALLOW_LIVE_PROVIDER === "true" &&
  process.env.USE_MOCK_PROVIDER === "false" &&
  process.env.EOE_ENABLE_IMAGE_INPUT === "false" &&
  Boolean(process.env.EOE_LIVE_RUN_ID?.trim()) &&
  Boolean(process.env.EOE_LIVE_LEDGER_PATH?.trim()) &&
  Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim());
const live = enabled ? describe : describe.skip;
const targetedRetry = process.env.EOE_TEXT_BETA_RC_TARGETED_RETRY === "true";
const targetIds = new Set(
  (process.env.EOE_TEXT_BETA_RC_TARGET_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const benchmarkDirectory = join(process.cwd(), "artifacts", "benchmarks");
const resultPath = join(benchmarkDirectory, "text-beta-rc-release-corpus-results.json");
const reportPath = join(benchmarkDirectory, "text-beta-rc-release-corpus-report.md");
const reviewDirectory = join(process.cwd(), "artifacts", "human-review", "text-beta-rc");
const budgetPath = process.env.EOE_LIVE_LEDGER_PATH ??
  join(benchmarkDirectory, "text-beta-rc-live-budget.json");
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

function segments(content: string, phraseId: string): MessageSegment[] {
  const phrase = getPhraseById(phraseId);
  if (!phrase) throw new Error(`Missing Registry Phrase ${phraseId}`);
  const surface = [phrase.canonical, ...phrase.variants].find((value) =>
    content.toLocaleLowerCase().includes(value.toLocaleLowerCase()));
  if (!surface) throw new Error(`Source content does not contain ${phraseId}`);
  const index = content.toLocaleLowerCase().indexOf(surface.toLocaleLowerCase());
  const before = content.slice(0, index);
  const actual = content.slice(index, index + surface.length);
  const after = content.slice(index + surface.length);
  return [
    ...(before ? [{ type: "text" as const, content: before, language: "zh" as const }] : []),
    {
      type: "english_chunk" as const,
      content: actual,
      phraseId,
      isNew: false,
      assistanceAvailable: true,
    },
    ...(after ? [{ type: "text" as const, content: after, language: "zh" as const }] : []),
  ];
}

function single(id: string, content: string): ChatRequest {
  return {
    conversationId: `text-beta-rc-${id}`,
    messages: [{ id: `${id}-u1`, role: "user", content }],
    attachments: [],
    engineState: {
      recentExposurePhraseIds: [],
      developerMode: true,
      benchmarkType: "live_evidence",
    },
  };
}

type CaseCheck = (result: EngineRunResult, text: string) => string[];

interface ReleaseCase {
  id: string;
  title: string;
  provider: Provider;
  request: ChatRequest;
  check: CaseCheck;
}

function baseChecks(...checks: Array<boolean | string>): string[] {
  return checks.flatMap((value) =>
    typeof value === "string" ? value ? [value] : [] : value ? [] : ["required_content_missing"]);
}

const cases: ReleaseCase[] = [
  {
    id: "weekend-relaxation",
    title: "周末放松建议",
    provider: glm,
    request: single("weekend-relaxation", "周末终于有空了，你觉得做点什么比较放松？"),
    check: (_result, text) => baseChecks(/散步|休息|电影|音乐|公园|睡/u.test(text)),
  },
  {
    id: "remote-work-opinion",
    title: "远程办公观点",
    provider: deepSeek,
    request: single("remote-work-opinion", "你觉得远程办公最大的优点是什么？"),
    check: (_result, text) => baseChecks(/优点|通勤|时间|灵活|专注|自主/u.test(text)),
  },
  {
    id: "study-plan",
    title: "学习计划",
    provider: glm,
    request: single("study-plan", "我该怎么安排下周的学习计划？"),
    check: (_result, text) => baseChecks(/周一|周二|周三|每天|下周|复盘|调整/u.test(text)),
  },
  {
    id: "family-budget",
    title: "家庭预算",
    provider: deepSeek,
    request: single("family-budget", "我想先做家庭预算，应该整理哪些数据？"),
    check: (_result, text) => baseChecks(/收入/u.test(text), /支出|负债|储蓄|现金流/u.test(text)),
  },
  {
    id: "typescript-unknown-any",
    title: "TypeScript unknown 与 any",
    provider: glm,
    request: single("typescript-unknown-any", "解释 TypeScript 里 unknown 和 any 的区别"),
    check: (_result, text) => reviewTechnicalDistinction(
      text,
      ["TypeScript", "unknown", "any"],
    ),
  },
  {
    id: "detailed-product-analysis",
    title: "详细产品分析",
    provider: deepSeek,
    request: single(
      "detailed-product-analysis",
      "详细分析一个新产品从用户问题、竞争环境、交付成本到长期维护之间的关系。",
    ),
    check: (result, text) => {
      const profile = result.diagnostics.responseObligations.find(
        (item) => item.responseDepthProfile,
      )?.responseDepthProfile;
      return profile ? reviewResponseDepth(text, profile).warnings : ["response_depth_profile_missing"];
    },
  },
  {
    id: "option-choice",
    title: "方案选择",
    provider: glm,
    request: single("option-choice", "两个方案拿不定主意，我该怎么做选择？"),
    check: (_result, text) => baseChecks(/成本|时间|风险|效果|目标|优先/u.test(text), /权衡|取舍|代价/u.test(text)),
  },
  {
    id: "conditional-tradeoff",
    title: "条件权衡",
    provider: deepSeek,
    request: single("conditional-tradeoff", "一个方案租金更高，但每天能省一小时通勤，我该怎么权衡？"),
    check: (_result, text) => baseChecks(/租金/u.test(text), /通勤|一小时/u.test(text), /时间价值|高价值|预算|权衡|值得|差额/u.test(text)),
  },
  {
    id: "light-daily-plan",
    title: "轻量日常安排",
    provider: glm,
    request: single("light-daily-plan", "我今天只想安排一个轻松又有收获的计划，怎么做？"),
    check: (_result, text) => baseChecks(/今天|上午|下午|先|分钟|小时/u.test(text), /如果|可以换成|调整|累/u.test(text)),
  },
  {
    id: "concrete-example",
    title: "具体例子",
    provider: deepSeek,
    request: single("concrete-example", "能不能给我一个具体例子？"),
    check: (_result, text) => baseChecks(/例如|比如|假设|举个例子|具体来说|for example/iu.test(text)),
  },
  {
    id: "simple-comparison",
    title: "简单比较",
    provider: glm,
    request: single("simple-comparison", "用手机清单和纸质清单记录待办，各有什么优缺点？"),
    check: (_result, text) => baseChecks(/手机/u.test(text), /纸质|纸笔/u.test(text), /优点|缺点|适合|选择/u.test(text)),
  },
  {
    id: "context-ack-good",
    title: "上下文短回应好",
    provider: deepSeek,
    request: {
      ...single("context-ack-good", "好"),
      messages: [
        { id: "context-ack-good-u1", role: "user", content: "我准备先做家庭预算，下一步先整理固定支出。" },
        { id: "context-ack-good-a1", role: "assistant", content: "可以先按月列出房租、保险和订阅。" },
        { id: "context-ack-good-u2", role: "user", content: "好" },
      ],
    },
    check: (result, text) => baseChecks(
      result.diagnostics.contextualAcknowledgement?.active === true,
      !/你好|有什么可以帮|你想讨论什么/u.test(text),
      /预算|支出|房租|保险|订阅|刚才/u.test(text),
    ),
  },
  {
    id: "context-ack-oh",
    title: "上下文短回应哦",
    provider: glm,
    request: {
      ...single("context-ack-oh", "哦"),
      messages: [
        { id: "context-ack-oh-u1", role: "user", content: "我想先比较两个通勤方案的时间和成本。" },
        { id: "context-ack-oh-a1", role: "assistant", content: "可以先记录一周的实际通勤时间和费用。" },
        { id: "context-ack-oh-u2", role: "user", content: "哦" },
      ],
    },
    check: (result, text) => baseChecks(
      result.diagnostics.contextualAcknowledgement?.active === true,
      !/你好|有什么可以帮|你想讨论什么/u.test(text),
      /通勤|时间|成本|费用|刚才/u.test(text),
    ),
  },
  {
    id: "english-difficulty",
    title: "用户表示英语困难",
    provider: deepSeek,
    request: {
      ...single("english-difficulty", "英语有点难"),
      messages: [
        { id: "english-difficulty-u1", role: "user", content: "我想继续完善下周学习计划。" },
        {
          id: "english-difficulty-a1",
          role: "assistant",
          content: "For now，先确定每天能用的时间。",
          segments: segments("For now，先确定每天能用的时间。", "p-for-now"),
        },
        { id: "english-difficulty-u2", role: "user", content: "英语有点难" },
      ],
    },
    check: (result, text) => baseChecks(
      result.diagnostics.temporaryOverlayPreference?.mode === "reduced",
      !result.response.segments.some((segment) => segment.type === "english_chunk"),
      /学习|计划|每天|时间|刚才/u.test(text),
      !/我们要面对现实|你说得对|非常抱歉/u.test(text),
    ),
  },
  {
    id: "quantitative-claim-guard",
    title: "无依据数字防护",
    provider: glm,
    request: single("quantitative-claim-guard", "请分析这个产品的成本主要受哪些因素影响。"),
    check: (result, text) => findUnsupportedQuantitativeClaims({
      responseText: text,
      sourceTexts: result.diagnostics.responseObligations.map((item) => item.description),
    }).map((claim) => `unsupported_quantitative_claim:${claim}`),
  },
  {
    id: "pronunciation-assistance",
    title: "Vocabulary Assistance 发音",
    provider: deepSeek,
    request: {
      ...single("pronunciation-assistance", "怎么读？"),
      messages: [
        { id: "pronunciation-assistance-u1", role: "user", content: "我们先怎么安排家庭预算？" },
        {
          id: "pronunciation-assistance-a1",
          role: "assistant",
          content: "For now，先整理固定支出。",
          segments: segments("For now，先整理固定支出。", "p-for-now"),
        },
        { id: "pronunciation-assistance-u2", role: "user", content: "怎么读？" },
      ],
      engineState: {
        recentExposurePhraseIds: ["p-for-now"],
        developerMode: true,
        benchmarkType: "live_evidence",
        assistanceRequest: {
          trigger: "pronunciation",
          sourceMessageId: "pronunciation-assistance-a1",
          segmentIndex: 0,
          phraseId: "p-for-now",
        },
      },
    },
    check: (result, text) => baseChecks(
      result.diagnostics.assistance?.resolved === true,
      /读作|发音/u.test(text),
      /家庭预算|固定支出/u.test(text),
      !/例句|Let's wait for now/u.test(text),
    ),
  },
  {
    id: "multi-phrase-ambiguity",
    title: "Multi-Phrase Ambiguity",
    provider: glm,
    request: {
      ...single("multi-phrase-ambiguity", "刚才那个是什么意思？"),
      messages: [
        { id: "multi-phrase-ambiguity-u1", role: "user", content: "比较一下方案。" },
        {
          id: "multi-phrase-ambiguity-a1",
          role: "assistant",
          content: "It depends，主要看目标。",
          segments: segments("It depends，主要看目标。", "p-it-depends"),
        },
        {
          id: "multi-phrase-ambiguity-a2",
          role: "assistant",
          content: "For now，先收集真实数据。",
          segments: segments("For now，先收集真实数据。", "p-for-now"),
        },
        { id: "multi-phrase-ambiguity-u2", role: "user", content: "刚才那个是什么意思？" },
      ],
      engineState: {
        recentExposurePhraseIds: ["p-it-depends", "p-for-now"],
        developerMode: true,
        benchmarkType: "live_evidence",
      },
    },
    check: (result, text) => baseChecks(
      result.diagnostics.assistance?.engineOwnedClarification === true,
      result.diagnostics.attempts.length === 0,
      /哪一个|哪句|具体指/u.test(text),
    ),
  },
  {
    id: "user-phrase-reuse",
    title: "User Phrase Reuse",
    provider: deepSeek,
    request: single("user-phrase-reuse", "I think this plan is useful，你怎么看？"),
    check: (result, text) => baseChecks(
      result.diagnostics.userPhraseReuseOpportunity?.phraseId === "p-i-think",
      /计划|方案|有用|可行|执行|风险/u.test(text),
    ),
  },
];

interface ReleaseRecord {
  id: string;
  title: string;
  status: "PASS" | "FAIL";
  severeFailures: string[];
  softWarnings: string[];
  provider: string;
  model: string;
  history: Array<{ role: string; content: string }>;
  finalText: string;
  englishChunks: Array<{ phraseId: string; content: string; position: number }>;
  noFit: boolean;
  noFitReason?: string;
  attempts: number;
  executionSource: EngineRunResult["diagnostics"]["responseExecutionSource"];
  naturalFallback: boolean;
  taskComplete: boolean;
  taskIssues: string[];
  finalValidationCodes: string[];
  allAttemptCodes: string[];
  displayedWithSoftQualityWarning: boolean;
  temporaryOverlayPreference?: EngineRunResult["diagnostics"]["temporaryOverlayPreference"];
  contextualAcknowledgement?: EngineRunResult["diagnostics"]["contextualAcknowledgement"];
  assistance?: EngineRunResult["diagnostics"]["assistance"];
  userPhraseReuse?: EngineRunResult["diagnostics"]["userPhraseReuseOpportunity"];
  latencyMs: number;
  tokens: number;
}

function englishInternalSlot(result: EngineRunResult): boolean {
  return result.response.segments.some((segment, index) => {
    if (segment.type !== "english_chunk" || index === 0) return false;
    const previous = result.response.segments[index - 1];
    return previous?.type !== "text" || !/[。！？.!?]\s*$/u.test(previous.content.trimEnd());
  });
}

async function runCase(spec: ReleaseCase): Promise<ReleaseRecord> {
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
    const finalText = segmentsToPlainText(result.response.segments);
    const finalUnsupportedClaims = findUnsupportedQuantitativeClaims({
      responseText: finalText,
      sourceTexts: spec.request.messages.map((message) => message.content),
    });
    const contextReset = /你好|请问有什么可以帮|你想讨论什么/u.test(finalText) &&
      (spec.id === "context-ack-good" || spec.id === "context-ack-oh");
    const wrongHistoryDenial =
      spec.request.messages.some((message) => message.segments?.some((segment) => segment.type === "english_chunk")) &&
      /没有找到|没找到|未找到|历史.{0,8}没有/u.test(finalText);
    const customFailures = spec.check(result, finalText);
    const executionAccounting = reviewExecutionAccounting({
      source: result.diagnostics.responseExecutionSource,
      attemptCount: result.diagnostics.attempts.length,
      providerRequestCount: result.diagnostics.attempts.length,
    });
    const severeFailures = [
      result.diagnostics.finalValidation.valid ? "" : "final_hard_validation_failed",
      finalText.trim() ? "" : "empty_final_response",
      result.diagnostics.naturalFallbackUsed ? "natural_fallback_used" : "",
      finalUnsupportedClaims.length > 0
        ? `unsupported_quantitative_claim:${finalUnsupportedClaims.join(",")}`
        : "",
      contextReset ? "context_reset" : "",
      wrongHistoryDenial ? "wrong_history_denial" : "",
      englishInternalSlot(result) ? "english_chunk_in_chinese_internal_slot" : "",
      ...executionAccounting.violations,
      ...customFailures,
    ].filter(Boolean);
    const softWarnings = [
      ...new Set([
        ...(result.diagnostics.softQualityReview?.warnings ?? []),
        ...result.diagnostics.finalValidation.violations
          .filter((item) => item.severity === "warning")
          .map((item) => item.code),
        ...(result.diagnostics.assistance?.assistanceContentFallback
          ? ["assistance_content_fallback"]
          : []),
      ]),
    ];
    const allAttemptCodes = [
      ...new Set(result.diagnostics.attempts.flatMap((attempt) =>
        attempt.validation.violations.map((item) => item.code))),
    ];
    await liveBudgetGuard?.annotateScenario({
      scenarioId: spec.id,
      pipelineOutcome: severeFailures.length === 0 ? "pass" : "fail",
      violationCodes: allAttemptCodes,
      fallback: result.diagnostics.fallbackUsed,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
    });
    return {
      id: spec.id,
      title: spec.title,
      status: severeFailures.length === 0 ? "PASS" : "FAIL",
      severeFailures,
      softWarnings,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      finalText,
      englishChunks: result.response.segments.flatMap((segment, position) =>
        segment.type === "english_chunk"
          ? [{ phraseId: segment.phraseId, content: segment.content, position }]
          : []),
      noFit: result.response.noFit,
      noFitReason: result.diagnostics.noFitReason,
      attempts: result.diagnostics.attempts.length,
      executionSource: result.diagnostics.responseExecutionSource,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      taskComplete: result.diagnostics.taskCompleteness.complete,
      taskIssues: result.diagnostics.taskCompleteness.issues,
      finalValidationCodes: result.diagnostics.finalValidation.violations.map((item) => item.code),
      allAttemptCodes,
      displayedWithSoftQualityWarning: result.diagnostics.displayedWithSoftQualityWarning ?? false,
      temporaryOverlayPreference: result.diagnostics.temporaryOverlayPreference,
      contextualAcknowledgement: result.diagnostics.contextualAcknowledgement,
      assistance: result.diagnostics.assistance,
      userPhraseReuse: result.diagnostics.userPhraseReuseOpportunity,
      latencyMs: result.provider.latencyMs,
      tokens: result.provider.usage?.totalTokens ?? 0,
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
    return {
      id: spec.id,
      title: spec.title,
      status: "FAIL",
      severeFailures: [failure],
      softWarnings: [],
      provider: spec.provider.id,
      model: spec.provider.modelId,
      history: spec.request.messages.map(({ role, content }) => ({ role, content })),
      finalText: "",
      englishChunks: [],
      noFit: false,
      attempts: 0,
      executionSource: "provider_generated",
      naturalFallback: false,
      taskComplete: false,
      taskIssues: [],
      finalValidationCodes: [],
      allAttemptCodes: [],
      displayedWithSoftQualityWarning: false,
      latencyMs: 0,
      tokens: 0,
    };
  }
}

type ReleaseStatus =
  | "M2_TEXT_BETA_RC_READY_FOR_INDEPENDENT_HUMAN_REVIEW"
  | "M2_TEXT_BETA_RC_REVIEWABLE_WITH_SOFT_WARNINGS"
  | "M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS";

function releaseStatus(records: ReleaseRecord[], ledger: LiveBudgetLedger): ReleaseStatus {
  const softWarningCount = records.reduce((sum, record) => sum + record.softWarnings.length, 0);
  const imageRequests = ledger.attempts.filter((attempt) => attempt.provider.includes("vision")).length;
  const hardPass =
    records.length === 18 &&
    records.every((record) => record.status === "PASS") &&
    records.every((record) => !record.naturalFallback) &&
    imageRequests === 0;
  if (!hardPass) return "M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS";
  if (softWarningCount === 0) return "M2_TEXT_BETA_RC_READY_FOR_INDEPENDENT_HUMAN_REVIEW";
  return softWarningCount <= 2
    ? "M2_TEXT_BETA_RC_REVIEWABLE_WITH_SOFT_WARNINGS"
    : "M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS";
}

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function recordTable(records: ReleaseRecord[]): string[] {
  return [
    "| # | Case | Status | Provider / Model | Execution source | Actual history | Actual final text | English Chunk | noFit | Attempts | Soft warnings | Failures |",
    "|---:|---|---|---|---|---|---|---|---|---:|---|---|",
    ...records.map((record, index) =>
      `| ${index + 1} | ${record.id} | ${record.status} | ${record.provider} / ${record.model} | ${record.executionSource} | ${cell(JSON.stringify(record.history))} | ${cell(record.finalText)} | ${cell(record.englishChunks.map((item) => `${item.phraseId}:${item.content}`).join(", ") || "none")} | ${record.noFit} (${record.noFitReason ?? "n/a"}) | ${record.attempts} | ${cell(record.softWarnings.join(", ") || "none")} | ${cell(record.severeFailures.join(", ") || "none")} |`),
  ];
}

function writeReport(records: ReleaseRecord[], ledger: LiveBudgetLedger, status: ReleaseStatus): void {
  mkdirSync(benchmarkDirectory, { recursive: true });
  const softWarningCount = records.reduce((sum, record) => sum + record.softWarnings.length, 0);
  const imageRequests = ledger.attempts.filter((attempt) => attempt.provider.includes("vision")).length;
  writeFileSync(reportPath, [
    "# Text Beta RC Release Corpus",
    "",
    `- Run ID: \`${ledger.runId}\``,
    `- Status: \`${status}\``,
    `- Targeted Retry merge: ${targetedRetry}`,
    `- Hard-valid usable results: ${records.filter((record) => record.status === "PASS").length}/18`,
    `- English Chunk cases: ${records.filter((record) => record.englishChunks.length > 0).length}`,
    `- English Chunk count: ${records.reduce((sum, record) => sum + record.englishChunks.length, 0)}`,
    `- noFit: ${records.filter((record) => record.noFit).length}`,
    `- Soft warnings: ${softWarningCount}`,
    `- Natural Fallback: ${records.filter((record) => record.naturalFallback).length}`,
    `- Provider requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    `- Image Provider requests: ${imageRequests}`,
    "- English appearance quota: none",
    "- M3: BLOCKED",
    "- Adaptive Progression: DISABLED",
    "",
    ...recordTable(records),
    "",
  ].join("\n"), "utf8");
  writeFileSync(resultPath, `${JSON.stringify({
    status,
    targetedRetry,
    ledger,
    records,
  }, null, 2)}\n`, "utf8");
}

function markdownList(records: ReleaseRecord[], render: (record: ReleaseRecord) => string): string[] {
  return records.length > 0 ? records.map(render) : ["- none"];
}

function writeReviewPackage(
  records: ReleaseRecord[],
  ledger: LiveBudgetLedger,
  status: Exclude<ReleaseStatus, "M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS">,
): void {
  mkdirSync(reviewDirectory, { recursive: true });
  const write = (name: string, title: string, lines: string[]) => writeFileSync(
    join(reviewDirectory, name),
    [`# ${title}`, "", "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`", "", ...lines, ""].join("\n"),
    "utf8",
  );
  write("REVIEW_INDEX.md", "Text Beta RC Independent Review Index", [
    `Technical release-gate state: \`${status}\`.`,
    "This is a Text-First Fixed-Level Beta. Image input and Adaptive Progression are disabled. English Overlay has no appearance quota. Soft warnings are review evidence, not automatic human failure.",
    "",
    ...[
      "PRODUCT_SCOPE.md",
      "RELEASE_CORPUS_REVIEW.md",
      "ENGLISH_CHUNK_REVIEW.md",
      "NO_FIT_REVIEW.md",
      "CONTEXT_CONTINUITY_REVIEW.md",
      "TECHNICAL_EXPLANATION_REVIEW.md",
      "DETAILED_ANALYSIS_REVIEW.md",
      "QUANTITATIVE_CLAIM_REVIEW.md",
      "VOCABULARY_ASSISTANCE_REVIEW.md",
      "PHRASE_REUSE_REVIEW.md",
      "SOFT_QUALITY_WARNINGS.md",
      "BETA_UI_REVIEW.md",
      "LIVE_BUDGET_AUDIT.md",
      "INDEPENDENT_REVIEW_CHECKLIST.md",
    ].map((name) => `- ${name}`),
  ]);
  write("PRODUCT_SCOPE.md", "Product Scope", [
    "- Ordinary Chinese-first text chat is the product surface.",
    "- English is an optional sentence-boundary Overlay.",
    "- Fixed Level only; no promotion, demotion, Mastery, course, score, or streak.",
    "- Image input is deferred and disabled.",
    "- Final naturalness and release approval belong to the independent reviewer.",
  ]);
  write("RELEASE_CORPUS_REVIEW.md", "Release Corpus Review", recordTable(records));
  write("ENGLISH_CHUNK_REVIEW.md", "English Chunk Review", markdownList(
    records.filter((record) => record.englishChunks.length > 0),
    (record) => `- **${record.id}** — ${record.englishChunks.map((item) => `\`${item.content}\` (${item.phraseId})`).join(", ")} — full reply: ${record.finalText}`,
  ));
  write("NO_FIT_REVIEW.md", "noFit Review", markdownList(
    records.filter((record) => record.noFit),
    (record) => `- **${record.id}** — reason \`${record.noFitReason ?? "unknown"}\` — ${record.finalText}`,
  ));
  write("CONTEXT_CONTINUITY_REVIEW.md", "Context Continuity Review", recordTable(
    records.filter((record) => ["context-ack-good", "context-ack-oh", "english-difficulty", "multi-phrase-ambiguity"].includes(record.id)),
  ));
  write("TECHNICAL_EXPLANATION_REVIEW.md", "Technical Explanation Review", recordTable(
    records.filter((record) => record.id === "typescript-unknown-any"),
  ));
  write("DETAILED_ANALYSIS_REVIEW.md", "Detailed Analysis Review", recordTable(
    records.filter((record) => record.id === "detailed-product-analysis"),
  ));
  write("QUANTITATIVE_CLAIM_REVIEW.md", "Quantitative Claim Review", recordTable(
    records.filter((record) => record.id === "quantitative-claim-guard"),
  ));
  write("VOCABULARY_ASSISTANCE_REVIEW.md", "Vocabulary Assistance Review", recordTable(
    records.filter((record) => record.id === "pronunciation-assistance"),
  ));
  write("PHRASE_REUSE_REVIEW.md", "Phrase Reuse Review", recordTable(
    records.filter((record) => record.id === "user-phrase-reuse"),
  ));
  write("SOFT_QUALITY_WARNINGS.md", "Soft Quality Warnings", markdownList(
    records.filter((record) => record.softWarnings.length > 0),
    (record) => `- **${record.id}** — ${record.softWarnings.join(", ")} — displayed=${record.displayedWithSoftQualityWarning}`,
  ));
  write("BETA_UI_REVIEW.md", "Beta UI Review", [
    "- Review the ordinary chat landing surface, subtle English Chunk style, in-chat Assistance, hidden image entry, and hidden Developer Panel.",
    "- Desktop evidence: `screenshots/text-beta-rc-desktop.png`",
    "- 390×844 evidence: `screenshots/text-beta-rc-mobile-390x844.png`",
    "- Do not mark visual PASS until both embedded screenshots are present and inspected.",
  ]);
  write("LIVE_BUDGET_AUDIT.md", "Live Budget Audit", [
    `- Run ID: \`${ledger.runId}\``,
    `- Requests: ${ledger.requestCount}/${ledger.requestBudget}`,
    `- Tokens: ${ledger.tokenCount}/${ledger.tokenBudget}`,
    `- Provider runtime: ${ledger.providerRuntimeMs}/${ledger.runtimeBudgetMs} ms`,
    `- Pending attempts: ${ledger.attempts.filter((attempt) => attempt.outcome === "pending").length}`,
    `- Image Provider attempts: ${ledger.attempts.filter((attempt) => attempt.provider.includes("vision")).length}`,
  ]);
  write("INDEPENDENT_REVIEW_CHECKLIST.md", "Independent Review Checklist", [
    "Do not preselect PASS.",
    "",
    "- [ ] Every response completes the real user task.",
    "- [ ] English Chunks read naturally at sentence boundaries.",
    "- [ ] noFit responses remain complete ordinary answers.",
    "- [ ] `好` and `哦` preserve context.",
    "- [ ] English difficulty reduces Overlay and continues the topic.",
    "- [ ] TypeScript explanation is substantive and correct.",
    "- [ ] Detailed analysis explains relationships and trade-offs.",
    "- [ ] No unsupported exact number is presented as fact.",
    "- [ ] Pronunciation Assistance is brief and topic-specific.",
    "- [ ] Desktop and mobile screenshots are acceptable.",
    "",
    "Final independent verdict:",
    "",
    "- [ ] PASS",
    "- [ ] FAIL",
  ]);
}

live("Text Beta RC 18-scenario real Provider Release Corpus", () => {
  it("runs the fixed representative corpus within one guarded budget", async () => {
    expect(cases).toHaveLength(18);
    const selectedCases = targetedRetry
      ? cases.filter((item) => targetIds.has(item.id))
      : cases;
    if (targetedRetry) {
      expect(targetIds.size).toBeGreaterThan(0);
      expect(selectedCases.map((item) => item.id).sort()).toEqual([...targetIds].sort());
    }
    const currentRecords: ReleaseRecord[] = [];
    for (const spec of selectedCases) currentRecords.push(await runCase(spec));
    await liveBudgetGuard?.completeRun();
    const ledger = JSON.parse(readFileSync(budgetPath, "utf8")) as LiveBudgetLedger;
    const previousRecords = targetedRetry
      ? (JSON.parse(readFileSync(resultPath, "utf8")) as { records: ReleaseRecord[] }).records
      : [];
    const replacements = new Map(currentRecords.map((record) => [record.id, record]));
    const records = targetedRetry
      ? cases.map((spec) =>
          replacements.get(spec.id) ??
          previousRecords.find((record) => record.id === spec.id) ??
          (() => { throw new Error(`Missing previous record ${spec.id}`); })())
      : currentRecords;
    const status = releaseStatus(records, ledger);
    writeReport(records, ledger, status);
    if (status !== "M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS") {
      writeReviewPackage(records, ledger, status);
    }
    const failureSummary = records
      .filter((record) => record.status === "FAIL")
      .map((record) => `${record.id}=${record.severeFailures.join(",")}`)
      .join("; ");
    expect(
      status === "M2_TEXT_BETA_RC_READY_FOR_INDEPENDENT_HUMAN_REVIEW" ||
      status === "M2_TEXT_BETA_RC_REVIEWABLE_WITH_SOFT_WARNINGS",
      failureSummary || `release status=${status}`,
    ).toBe(true);
  }, 45 * 60_000);
});
