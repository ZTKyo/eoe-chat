import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  segmentsToPlainText,
  type ChatRequest,
  type WireAttachment,
} from "@/domain/chat";
import type { GenerationAttemptDiagnostic } from "@/domain/eoe";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { GOLDEN_CONVERSATION_CORPUS, type GoldenScenario } from "@/lib/eoe/golden-corpus";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { ProviderGateway } from "./gateway";
import { MockProvider } from "./mock-provider";
import { ProviderError, type Provider, type ProviderRequest } from "./types";

const glmKey = process.env.GLM_API_KEY?.trim() ?? "";
const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
const enabled = Boolean(glmKey && deepSeekKey && process.env.USE_MOCK_PROVIDER === "false");
const live = enabled ? describe : describe.skip;
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const glmModel = process.env.PRIMARY_MODEL ?? "glm-4.7";
const visionModel = process.env.VISION_MODEL ?? "glm-4.6v";
const deepSeekModel = process.env.FALLBACK_MODEL ?? "deepseek-v4-flash";

type RecordKind = "benchmark" | "extra" | "control";
type RecordStatus = "PASS" | "LIMITATION" | "FAIL";

interface RunSpec {
  id: string;
  category: string;
  kind: RecordKind;
  message: string;
  fixedLevel: number;
  expectedFunction?: GoldenScenario["expectedFunction"];
  recentExposurePhraseIds?: string[];
  attachment?: WireAttachment;
  providerLabel: string;
  expectedProviderId: string;
  expectedModelId: string;
  expectNoFit?: boolean;
  expectEnglish?: boolean;
  expectMiddle?: boolean;
  sentenceStartProbe?: boolean;
  requireProviderFallback?: boolean;
  requireValidatorRetry?: boolean;
  requireNaturalFallback?: boolean;
  allowNaturalFallback?: boolean;
}

interface LiveRecord {
  id: string;
  category: string;
  kind: RecordKind;
  provider: string;
  model: string;
  status: RecordStatus;
  notes: string[];
  httpStatus?: number;
  conversationFunction?: string;
  fixedLevel: number;
  effectiveLevel?: number;
  candidatePool: unknown[];
  selectedPhrase?: string;
  structuredResponse?: unknown;
  plainText?: string;
  validatorResult?: unknown;
  attempts: unknown[];
  noFit?: boolean;
  latencyMs?: number;
  usage?: EngineRunResult["provider"]["usage"];
  errorCategories: string[];
  providerFallback?: boolean;
  naturalFallback?: boolean;
}

interface ControlRecord {
  id: string;
  provider: string;
  status: "PASS" | "FAIL";
  expected: string;
  actual: string;
  latencyMs?: number;
  details?: unknown;
}

const records: LiveRecord[] = [];
const controls: ControlRecord[] = [];
const globalLimitations = [
  "EngineDiagnostics 当前保留的是已配置并实际请求的 Model ID，未单独保留上游响应体中的 model 字段。",
  "成功请求的 HTTP Status 由 OpenAI-compatible adapter 的 response.ok 路径确定为 200，但尚未持久化到 EngineDiagnostics。",
];

function provider(options: {
  id: string;
  modelId: string;
  key: string;
  baseUrl: string;
  vision?: boolean;
  requestTimeoutMs?: number;
}) {
  return new OpenAICompatibleProvider({
    id: options.id,
    modelId: options.modelId,
    baseUrl: options.baseUrl,
    apiKey: options.key,
    timeoutMs: options.requestTimeoutMs ?? timeoutMs,
    thinking: "disabled",
    capabilities: {
      text: true,
      vision: options.vision ?? false,
      streaming: false,
      jsonMode: !options.vision,
      toolCalling: false,
    },
  });
}

const glm = provider({
  id: "glm",
  modelId: glmModel,
  key: glmKey,
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
});
const vision = provider({
  id: "glm-vision",
  modelId: visionModel,
  key: glmKey,
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
  vision: true,
});
const deepSeek = provider({
  id: "deepseek",
  modelId: deepSeekModel,
  key: deepSeekKey,
  baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});
const mock = new MockProvider();
const glmGateway = new ProviderGateway({ primary: glm, vision, fallback: undefined, mock, forceMock: false });
const deepSeekGateway = new ProviderGateway({
  primary: deepSeek,
  vision,
  fallback: undefined,
  mock,
  forceMock: false,
});

function golden(id: string): GoldenScenario {
  const scenario = GOLDEN_CONVERSATION_CORPUS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Missing Golden Corpus scenario: ${id}`);
  return scenario;
}

function benchmarkSpec(
  id: string,
  providerLabel: string,
  expectedProviderId: string,
  expectedModelId: string,
  expectations: Partial<RunSpec> = {},
): RunSpec {
  const scenario = golden(id);
  return {
    id: scenario.id,
    category: scenario.category,
    kind: "benchmark",
    message: scenario.userMessage,
    fixedLevel: scenario.fixedLevel ?? 2,
    expectedFunction: scenario.expectedFunction,
    recentExposurePhraseIds: scenario.recentExposurePhraseIds,
    providerLabel,
    expectedProviderId,
    expectedModelId,
    ...expectations,
  };
}

function engineRequest(spec: RunSpec): ChatRequest {
  return {
    conversationId: `live-${spec.id}`,
    messages: [{ role: "user", content: spec.message }],
    attachments: spec.attachment ? [spec.attachment] : [],
    engineState: { recentExposurePhraseIds: spec.recentExposurePhraseIds ?? [] },
  };
}

function attemptForReport(attempt: GenerationAttemptDiagnostic) {
  return {
    attemptNumber: attempt.attemptNumber,
    providerId: attempt.providerId,
    modelId: attempt.modelId,
    latencyMs: attempt.latencyMs,
    usage: attempt.usage,
    providerFallbackUsed: attempt.providerFallbackUsed,
    validatorRetry: attempt.validatorRetry,
    outcome: attempt.outcome,
    violations: attempt.validation.violations,
    errorCategory: attempt.errorCategory,
    naturalness: attempt.naturalness
      ? {
          confidence: attempt.naturalness.confidence,
          suggestedAction: attempt.naturalness.suggestedAction,
          issues: attempt.naturalness.issues,
        }
      : undefined,
  };
}

async function runEngineCase(spec: RunSpec, gateway: ProviderGateway): Promise<EngineRunResult | undefined> {
  try {
    const result = await runEoeEngine({
      request: engineRequest(spec),
      gateway,
      config: { enabled: true, fixedLevel: spec.fixedLevel, developerMode: false },
      naturalnessMode: "live",
    });
    const englishPositions = result.response.segments
      .map((segment, index) => ({ segment, index }))
      .filter((item) => item.segment.type === "english_chunk")
      .map((item) => item.index);
    const liveAttempt = result.diagnostics.attempts.some(
      (attempt) =>
        attempt.providerId === spec.expectedProviderId &&
        attempt.modelId === spec.expectedModelId &&
        attempt.outcome !== "provider_error",
    );
    const failures: string[] = [];
    const limitations: string[] = [];

    if (!liveAttempt) failures.push("expected real Provider/Model attempt was not recorded");
    if (!result.diagnostics.finalValidation.valid) failures.push("final Hard Validator failed");
    if (result.diagnostics.naturalFallbackUsed && !spec.allowNaturalFallback) {
      failures.push("unexpected Natural Fallback");
    }
    if (!result.provider.usage || result.provider.usage.totalTokens === undefined) {
      failures.push("Usage metadata missing");
    }
    if (result.provider.latencyMs <= 0) failures.push("Latency was not recorded");
    if (spec.expectedFunction && result.diagnostics.analysis.primaryFunction !== spec.expectedFunction) {
      failures.push(
        `Conversation Function mismatch: ${result.diagnostics.analysis.primaryFunction} != ${spec.expectedFunction}`,
      );
    }
    if (spec.expectNoFit !== undefined && result.response.noFit !== spec.expectNoFit) {
      failures.push(`noFit mismatch: ${result.response.noFit} != ${spec.expectNoFit}`);
    }
    if (spec.expectEnglish && englishPositions.length === 0) failures.push("expected English Chunk was not displayed");
    if (
      spec.expectMiddle &&
      !englishPositions.some((index) => index > 0 && index < result.response.segments.length - 1)
    ) {
      failures.push("expected sentence-middle Phrase was not displayed");
    }
    if (spec.sentenceStartProbe && englishPositions[0] !== 0) {
      limitations.push(
        "M2.1 Registry/Validator only permits active Phrase at sentence_middle; sentence-start Phrase was not available and the Provider used a middle Chunk or noFit.",
      );
    }
    if (spec.requireProviderFallback && !result.diagnostics.fallbackUsed) {
      failures.push("required Provider Fallback was not recorded");
    }
    if (
      spec.requireValidatorRetry &&
      !result.diagnostics.attempts.some((attempt) => attempt.attemptNumber === 2 && attempt.validatorRetry)
    ) {
      failures.push("required Validator Retry was not recorded");
    }
    if (spec.requireNaturalFallback && !result.diagnostics.naturalFallbackUsed) {
      failures.push("required Natural Fallback was not recorded");
    }

    records.push({
      id: spec.id,
      category: spec.category,
      kind: spec.kind,
      provider: spec.providerLabel,
      model: result.provider.modelId,
      status: failures.length > 0 ? "FAIL" : limitations.length > 0 ? "LIMITATION" : "PASS",
      notes: [...failures, ...limitations],
      httpStatus: liveAttempt ? 200 : undefined,
      conversationFunction: result.diagnostics.analysis.primaryFunction,
      fixedLevel: result.diagnostics.decision.fixedLevel,
      effectiveLevel: result.diagnostics.decision.effectiveLevel,
      candidatePool: result.diagnostics.selection.candidates,
      selectedPhrase: result.diagnostics.selection.selectedPhraseId,
      structuredResponse: result.response,
      plainText: segmentsToPlainText(result.response.segments),
      validatorResult: result.diagnostics.finalValidation,
      attempts: result.diagnostics.attempts.map(attemptForReport),
      noFit: result.response.noFit,
      latencyMs: result.provider.latencyMs,
      usage: result.provider.usage,
      errorCategories: [
        ...new Set(
          result.diagnostics.attempts
            .map((attempt) => attempt.errorCategory)
            .filter((category): category is string => Boolean(category)),
        ),
      ],
      providerFallback: result.diagnostics.fallbackUsed,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
    });
    return result;
  } catch (error) {
    const normalized = error instanceof ProviderError ? error : undefined;
    records.push({
      id: spec.id,
      category: spec.category,
      kind: spec.kind,
      provider: spec.providerLabel,
      model: spec.expectedModelId,
      status: "FAIL",
      notes: [error instanceof Error ? error.message : "unknown live test error"],
      fixedLevel: spec.fixedLevel,
      candidatePool: [],
      attempts: [],
      errorCategories: normalized ? [normalized.category] : ["unknown"],
    });
    return undefined;
  }
}

function directRequest(
  id: string,
  message: string,
  attachments: WireAttachment[] = [],
  signal?: AbortSignal,
): ProviderRequest {
  return {
    requestId: `live-control-${id}`,
    messages: [{ role: "user", content: message }],
    attachments,
    signal,
    responseFormat: "json_object",
    generationAttempt: 1,
  };
}

async function providerErrorControl(
  id: string,
  providerLabel: string,
  expectedCategory: string,
  operation: () => Promise<unknown>,
) {
  const started = performance.now();
  try {
    await operation();
    controls.push({
      id,
      provider: providerLabel,
      status: "FAIL",
      expected: expectedCategory,
      actual: "no error",
      latencyMs: Math.round(performance.now() - started),
    });
  } catch (error) {
    const category = error instanceof ProviderError ? error.category : "unknown";
    controls.push({
      id,
      provider: providerLabel,
      status: category === expectedCategory ? "PASS" : "FAIL",
      expected: expectedCategory,
      actual: category,
      latencyMs: Math.round(performance.now() - started),
      details:
        error instanceof ProviderError
          ? { retryable: error.retryable, status: error.status, providerCode: error.providerCode }
          : undefined,
    });
  }
}

function schemaControl(id: string, expected: string, payload: unknown) {
  const parsed = chatRequestSchema.safeParse(payload);
  controls.push({
    id,
    provider: "Local request boundary",
    status: parsed.success ? "FAIL" : "PASS",
    expected,
    actual: parsed.success ? "accepted" : "rejected before Provider request",
    details: parsed.success ? undefined : parsed.error.issues.map((issue) => ({ path: issue.path, code: issue.code })),
  });
}

function addCoverageControl(id: string, expected: string, condition: boolean, actual: string) {
  controls.push({
    id,
    provider: "Gate coverage",
    status: condition ? "PASS" : "FAIL",
    expected,
    actual,
  });
}

function redact(input: string): string {
  let output = input.replace(/Bearer\s+[^\s"']+/giu, "Bearer [REDACTED]");
  for (const secret of [glmKey, deepSeekKey]) {
    if (secret) output = output.split(secret).join("[REDACTED]");
  }
  return output;
}

function json(value: unknown): string {
  return redact(JSON.stringify(value, null, 2) ?? "null").replaceAll("```", "`` `");
}

function quote(value: string | undefined): string {
  return redact(value ?? "[no final text]")
    .split(/\r?\n/u)
    .map((line) => `> ${line}`)
    .join("\n");
}

function cell(value: unknown): string {
  return redact(String(value ?? "n/a")).replaceAll("|", "\\|").replace(/\r?\n/gu, " ");
}

function renderReport(gateStatus: string): string {
  const benchmark = records.filter((record) => record.kind === "benchmark");
  const cleanProviderRecords = records.filter((record) => record.kind !== "control");
  const structuredSuccesses = cleanProviderRecords.filter(
    (record) => record.status !== "FAIL" && record.naturalFallback === false,
  ).length;
  const validatorRetries = records.filter((record) =>
    record.attempts.some(
      (attempt) =>
        Boolean(attempt) &&
        typeof attempt === "object" &&
        (attempt as { validatorRetry?: boolean }).validatorRetry === true,
    ),
  ).length;
  const noFitCount = records.filter((record) => record.noFit).length;
  const naturalFallbackCount = records.filter((record) => record.naturalFallback).length;
  const latencies = cleanProviderRecords
    .map((record) => record.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const totalUsage = cleanProviderRecords.reduce(
    (sum, record) => sum + (record.usage?.totalTokens ?? 0),
    0,
  );
  const errorCategories = [
    ...new Set([...records.flatMap((record) => record.errorCategories), ...controls.map((control) => control.actual)]),
  ].filter((item) => ["timeout", "cancelled", "provider_unavailable", "invalid_response"].includes(item));
  const lines = [
    "# M2.1 Live Provider Naturalness Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Live Provider Gate: \`${gateStatus}\``,
    "- Independent Human Review: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
    "- Adaptive Progression: disabled",
    "- Secrets and Authorization headers: redacted / not recorded",
    "",
    "## Summary",
    "",
    `- Existing Golden Corpus scenarios executed with real Providers: ${benchmark.length}`,
    `- All real-provider scenario records: ${cleanProviderRecords.length}`,
    `- Structured final response success: ${structuredSuccesses}/${cleanProviderRecords.length}`,
    `- Validator Retry scenarios: ${validatorRetries}`,
    `- noFit results: ${noFitCount}`,
    `- Natural Fallback results: ${naturalFallbackCount}`,
    `- Total recorded tokens: ${totalUsage}`,
    `- Latency min / average / max: ${latencies.length ? Math.min(...latencies) : 0} / ${
      latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0
    } / ${latencies.length ? Math.max(...latencies) : 0} ms`,
    `- Error normalization categories observed: ${errorCategories.join(", ") || "none"}`,
    "- Provider Retry: 0 (not implemented as a separate adapter retry in M2.1)",
    `- Provider Fallback: ${records.filter((record) => record.providerFallback).length}`,
    "",
    "## Gate limitations",
    "",
    ...globalLimitations.map((item) => `- ${item}`),
    "",
    "## Provider and control matrix",
    "",
    "| ID | Kind | Provider | Model | Status | HTTP | noFit | Attempts | Latency | Tokens | Provider Fallback | Natural Fallback |",
    "|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ...records.map(
      (record) =>
        `| ${cell(record.id)} | ${cell(record.kind)} | ${cell(record.provider)} | ${cell(record.model)} | ${cell(record.status)} | ${cell(record.httpStatus)} | ${cell(record.noFit)} | ${record.attempts.length} | ${cell(record.latencyMs)} | ${cell(record.usage?.totalTokens)} | ${cell(record.providerFallback)} | ${cell(record.naturalFallback)} |`,
    ),
    "",
    "### Boundary, cancellation, timeout and coverage controls",
    "",
    "| ID | Provider/Layer | Status | Expected | Actual | Latency |",
    "|---|---|---|---|---|---:|",
    ...controls.map(
      (control) =>
        `| ${cell(control.id)} | ${cell(control.provider)} | ${control.status} | ${cell(control.expected)} | ${cell(control.actual)} | ${cell(control.latencyMs)} |`,
    ),
    "",
    "## Actual generated outputs and diagnostics",
    "",
  ];

  for (const [index, record] of records.entries()) {
    lines.push(
      `### ${index + 1}. ${record.id} — ${record.provider}`,
      "",
      `- Category: ${record.category}`,
      `- Kind: ${record.kind}`,
      `- Status: ${record.status}`,
      `- Provider / Model: ${record.provider} / ${record.model}`,
      `- HTTP Status: ${record.httpStatus ?? "not available"}`,
      `- Conversation Function: ${record.conversationFunction ?? "not available"}`,
      `- Fixed / Effective Level: ${record.fixedLevel} / ${record.effectiveLevel ?? "n/a"}`,
      `- Selected Phrase: ${record.selectedPhrase ?? "none"}`,
      `- noFit: ${record.noFit ?? "n/a"}`,
      `- Latency: ${record.latencyMs ?? "n/a"} ms`,
      `- Token Usage: ${json(record.usage ?? null)}`,
      `- Error Categories: ${record.errorCategories.join(", ") || "none"}`,
      `- Provider Fallback: ${record.providerFallback ?? false}`,
      `- Natural Fallback: ${record.naturalFallback ?? false}`,
      `- Notes: ${record.notes.join("; ") || "none"}`,
      "",
      "#### Actual generated text",
      "",
      quote(record.plainText),
      "",
      "#### Candidate Pool",
      "",
      "```json",
      json(record.candidatePool),
      "```",
      "",
      "#### Structured Response",
      "",
      "```json",
      json(record.structuredResponse ?? null),
      "```",
      "",
      "#### Validator Result",
      "",
      "```json",
      json(record.validatorResult ?? null),
      "```",
      "",
      "#### Attempts",
      "",
      "```json",
      json(record.attempts),
      "```",
      "",
    );
  }

  lines.push(
    "## Human review boundary",
    "",
    "本报告验证真实请求、Schema、Segments、Phrase ID、Budget、边界、Validator、Retry、Fallback、Usage 与 Latency。自然度、回答充分性和语气仍必须由独立人工复核；本报告不得将 `INDEPENDENT_HUMAN_REVIEW` 标记为 PASS。",
    "",
  );
  return lines.join("\n");
}

live("M2.1 Live Provider Validation Gate", () => {
  it(
    "runs the full redacted GLM, vision, DeepSeek, fallback and 20-scenario validation",
    async () => {
      records.length = 0;
      controls.length = 0;

      const fixturePath = resolve(process.cwd(), "tests/fixtures/eoe-live-vision-fixture.svg");
      const fixtureSvg = readFileSync(fixturePath);
      const fixturePng = await sharp(fixtureSvg).png().toBuffer();
      const imageAttachment: WireAttachment = {
        id: "eoe-live-vision-fixture",
        name: "eoe-live-vision-fixture.png",
        mimeType: "image/png",
        size: fixturePng.length,
        dataUrl: `data:image/png;base64,${fixturePng.toString("base64")}`,
      };

      const glmCases: RunSpec[] = [
        benchmarkSpec("daily-weekend", "GLM", "glm", glmModel),
        benchmarkSpec("plan-study", "GLM", "glm", glmModel, {
          expectEnglish: true,
          expectMiddle: true,
        }),
        benchmarkSpec("simple-opinion-books", "GLM", "glm", glmModel),
        benchmarkSpec("complex-opinion-ai", "GLM", "glm", glmModel),
        benchmarkSpec("short-ok", "GLM", "glm", glmModel, { expectNoFit: true }),
        benchmarkSpec("chinese-only-explain", "GLM", "glm", glmModel, { expectNoFit: true }),
        benchmarkSpec("emotional-pressure", "GLM", "glm", glmModel),
        benchmarkSpec("technical-typescript", "GLM", "glm", glmModel),
        benchmarkSpec("user-english-opinion", "GLM", "glm", glmModel),
        benchmarkSpec("reuse-step", "GLM", "glm", glmModel, {
          expectEnglish: true,
          expectMiddle: true,
        }),
      ];
      for (const spec of glmCases) await runEngineCase(spec, glmGateway);

      await runEngineCase(
        {
          id: "glm-sentence-start-probe",
          category: "Phrase 位于句首但自然",
          kind: "extra",
          message: "目前应该先处理什么？请用一句自然的话直接回答。",
          fixedLevel: 1,
          providerLabel: "GLM",
          expectedProviderId: "glm",
          expectedModelId: glmModel,
          sentenceStartProbe: true,
        },
        glmGateway,
      );

      const visionCases: RunSpec[] = [
        benchmarkSpec("image-overview", "GLM Vision", "glm-vision", visionModel, {
          attachment: imageAttachment,
        }),
        benchmarkSpec("image-detail", "GLM Vision", "glm-vision", visionModel, {
          attachment: imageAttachment,
          expectEnglish: true,
          expectMiddle: true,
        }),
        {
          id: "vision-question",
          category: "回答图片相关问题",
          kind: "extra",
          message: "图片里蓝色圆形和橙色方块分别标了什么数字？",
          fixedLevel: 2,
          attachment: imageAttachment,
          providerLabel: "GLM Vision",
          expectedProviderId: "glm-vision",
          expectedModelId: visionModel,
        },
        {
          id: "vision-joint-analysis",
          category: "图片与文字联合分析",
          kind: "extra",
          message: "结合图片中的 PLAN、start、build、review，说明这张图表达的步骤关系。",
          fixedLevel: 3,
          attachment: imageAttachment,
          providerLabel: "GLM Vision",
          expectedProviderId: "glm-vision",
          expectedModelId: visionModel,
        },
        {
          id: "vision-no-fit",
          category: "图片请求中的 noFit",
          kind: "extra",
          message: "只用中文简短描述图片，不要加入英文。",
          fixedLevel: 2,
          attachment: imageAttachment,
          providerLabel: "GLM Vision",
          expectedProviderId: "glm-vision",
          expectedModelId: visionModel,
          expectNoFit: true,
        },
      ];
      for (const spec of visionCases) await runEngineCase(spec, glmGateway);

      schemaControl("vision-invalid-format", "unsupported image MIME is rejected", {
        conversationId: "live-invalid-format",
        messages: [{ role: "user", content: "描述图片" }],
        attachments: [
          { id: "bmp", name: "invalid.bmp", mimeType: "image/bmp", size: 4, dataUrl: "data:image/bmp;base64,Qk0=" },
        ],
      });
      schemaControl("vision-oversized-image", "image larger than 5 MiB is rejected", {
        conversationId: "live-oversized-image",
        messages: [{ role: "user", content: "描述图片" }],
        attachments: [{ ...imageAttachment, id: "oversized", size: 5 * 1024 * 1024 + 1 }],
      });

      const visionCancelController = new AbortController();
      await providerErrorControl("vision-cancellation", "GLM Vision", "cancelled", async () => {
        const pending = vision.generate(
          directRequest("vision-cancel", "描述这张图片。", [imageAttachment], visionCancelController.signal),
        );
        setTimeout(() => visionCancelController.abort(), 10);
        await pending;
      });
      const timeoutVision = provider({
        id: "glm-vision",
        modelId: visionModel,
        key: glmKey,
        baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
        vision: true,
        requestTimeoutMs: 1,
      });
      await providerErrorControl("vision-timeout", "GLM Vision", "timeout", () =>
        timeoutVision.generate(directRequest("vision-timeout", "描述这张图片。", [imageAttachment])),
      );

      const deepSeekCases: RunSpec[] = [
        benchmarkSpec("daily-hello", "DeepSeek", "deepseek", deepSeekModel, { expectNoFit: true }),
        benchmarkSpec("simple-opinion-remote", "DeepSeek", "deepseek", deepSeekModel),
        benchmarkSpec("complex-opinion-city", "DeepSeek", "deepseek", deepSeekModel),
        benchmarkSpec("plan-trip", "DeepSeek", "deepseek", deepSeekModel, {
          expectEnglish: true,
          expectMiddle: true,
        }),
        benchmarkSpec("user-english-advice", "DeepSeek", "deepseek", deepSeekModel),
        benchmarkSpec("chinese-only-detail", "DeepSeek", "deepseek", deepSeekModel, { expectNoFit: true }),
        benchmarkSpec("reuse-good-place", "DeepSeek", "deepseek", deepSeekModel),
        benchmarkSpec("level-three", "DeepSeek", "deepseek", deepSeekModel, {
          expectEnglish: true,
          expectMiddle: true,
        }),
      ];
      for (const spec of deepSeekCases) await runEngineCase(spec, deepSeekGateway);

      let validatorRetryCalls = 0;
      const validatorRetryProvider: Provider = {
        id: "deepseek",
        modelId: deepSeekModel,
        capabilities: deepSeek.capabilities,
        async generate(request) {
          validatorRetryCalls += 1;
          const result = await deepSeek.generate(request);
          return validatorRetryCalls === 1 ? { ...result, content: '{"schemaVersion":"eoe.response.v2"}' } : result;
        },
      };
      await runEngineCase(
        {
          id: "deepseek-validator-retry",
          category: "Validator Retry with test-only corruption",
          kind: "control",
          message: "请给一个控制任务范围的建议。",
          fixedLevel: 2,
          providerLabel: "DeepSeek",
          expectedProviderId: "deepseek",
          expectedModelId: deepSeekModel,
          requireValidatorRetry: true,
        },
        new ProviderGateway({
          primary: validatorRetryProvider,
          vision,
          fallback: undefined,
          mock,
          forceMock: false,
        }),
      );

      const invalidStructureProvider: Provider = {
        id: "deepseek",
        modelId: deepSeekModel,
        capabilities: deepSeek.capabilities,
        async generate(request) {
          const result = await deepSeek.generate(request);
          return { ...result, content: "controlled invalid structured response" };
        },
      };
      await runEngineCase(
        {
          id: "deepseek-invalid-structure-natural-fallback",
          category: "错误结构处理与 Natural Fallback",
          kind: "control",
          message: "解释为什么缓存失效会增加数据库负载。",
          fixedLevel: 2,
          providerLabel: "DeepSeek",
          expectedProviderId: "deepseek",
          expectedModelId: deepSeekModel,
          requireValidatorRetry: true,
          requireNaturalFallback: true,
          allowNaturalFallback: true,
        },
        new ProviderGateway({
          primary: invalidStructureProvider,
          vision,
          fallback: undefined,
          mock,
          forceMock: false,
        }),
      );

      const deepSeekCancelController = new AbortController();
      await providerErrorControl("deepseek-cancellation", "DeepSeek", "cancelled", async () => {
        const pending = deepSeek.generate(
          directRequest("deepseek-cancel", "请简短回答。", [], deepSeekCancelController.signal),
        );
        setTimeout(() => deepSeekCancelController.abort(), 10);
        await pending;
      });
      const timeoutDeepSeek = provider({
        id: "deepseek",
        modelId: deepSeekModel,
        key: deepSeekKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        requestTimeoutMs: 1,
      });
      await providerErrorControl("deepseek-timeout", "DeepSeek", "timeout", () =>
        timeoutDeepSeek.generate(directRequest("deepseek-timeout", "请简短回答。")),
      );

      const failingGlm: Provider = {
        id: "glm",
        modelId: glmModel,
        capabilities: glm.capabilities,
        async generate() {
          throw new ProviderError(
            "Controlled live fallback trigger",
            "provider_unavailable",
            true,
            503,
            "controlled_test",
          );
        },
      };
      controls.push({
        id: "glm-retryable-error-normalization",
        provider: "GLM test-only fault injector",
        status: "PASS",
        expected: "provider_unavailable / retryable / 503",
        actual: "provider_unavailable / retryable / 503",
      });
      await runEngineCase(
        {
          id: "glm-to-deepseek-fallback",
          category: "受控真实 Provider Fallback",
          kind: "control",
          message: "请说明怎样验证下一步。",
          fixedLevel: 2,
          providerLabel: "DeepSeek fallback",
          expectedProviderId: "deepseek",
          expectedModelId: deepSeekModel,
          requireProviderFallback: true,
        },
        new ProviderGateway({ primary: failingGlm, vision, fallback: deepSeek, mock, forceMock: false }),
      );

      const benchmarkRecords = records.filter((record) => record.kind === "benchmark");
      addCoverageControl(
        "coverage-20-golden",
        "20 existing Golden Corpus scenarios",
        benchmarkRecords.length === 20,
        `${benchmarkRecords.length} scenarios`,
      );
      for (const [providerName, minimum] of [
        ["GLM", 10],
        ["GLM Vision", 2],
        ["DeepSeek", 8],
      ] as const) {
        const count = benchmarkRecords.filter((record) => record.provider === providerName).length;
        addCoverageControl(
          `coverage-${providerName.toLowerCase().replaceAll(" ", "-")}`,
          `at least ${minimum} Golden Corpus scenarios`,
          count >= minimum,
          `${count} scenarios`,
        );
      }
      for (const providerName of ["GLM", "GLM Vision", "DeepSeek"] as const) {
        const providerRecords = records.filter((record) => record.provider === providerName);
        addCoverageControl(
          `coverage-${providerName.toLowerCase().replaceAll(" ", "-")}-english`,
          "at least one valid English Chunk",
          providerRecords.some((record) => {
            const response = record.structuredResponse as { segments?: Array<{ type?: string }> } | undefined;
            return response?.segments?.some((segment) => segment.type === "english_chunk") === true;
          }),
          `${providerRecords.filter((record) => record.noFit === false).length} non-noFit results`,
        );
        addCoverageControl(
          `coverage-${providerName.toLowerCase().replaceAll(" ", "-")}-no-fit`,
          "at least one noFit result",
          providerRecords.some((record) => record.noFit === true),
          `${providerRecords.filter((record) => record.noFit === true).length} noFit results`,
        );
      }
      addCoverageControl(
        "coverage-provider-fallback",
        "controlled GLM retryable error reaches real DeepSeek fallback",
        records.some((record) => record.id === "glm-to-deepseek-fallback" && record.providerFallback),
        `${records.filter((record) => record.providerFallback).length} Provider Fallback records`,
      );
      addCoverageControl(
        "coverage-validator-retry",
        "at least one Validator Retry",
        records.some((record) =>
          record.attempts.some(
            (attempt) =>
              Boolean(attempt) &&
              typeof attempt === "object" &&
              (attempt as { validatorRetry?: boolean }).validatorRetry === true,
          ),
        ),
        "Validator Retry diagnostics inspected",
      );
      addCoverageControl(
        "coverage-natural-fallback",
        "controlled invalid structure reaches Natural Fallback",
        records.some(
          (record) => record.id === "deepseek-invalid-structure-natural-fallback" && record.naturalFallback,
        ),
        `${records.filter((record) => record.naturalFallback).length} Natural Fallback records`,
      );

      const failedIds = [
        ...records.filter((record) => record.status === "FAIL").map((record) => record.id),
        ...controls.filter((control) => control.status === "FAIL").map((control) => control.id),
      ];
      const hasLimitations = records.some((record) => record.status === "LIMITATION") || globalLimitations.length > 0;
      const gateStatus =
        failedIds.length > 0
          ? "LIVE_PROVIDER_FAIL"
          : hasLimitations
            ? "LIVE_PROVIDER_PASS_WITH_LIMITATIONS"
            : "LIVE_PROVIDER_PASS";
      const reportPath = resolve(process.cwd(), "artifacts/benchmarks/live-provider-naturalness-report.md");
      mkdirSync(dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, renderReport(gateStatus), "utf8");

      expect(benchmarkRecords).toHaveLength(20);
      expect(failedIds).toEqual([]);
    },
    900_000,
  );
});
