import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { segmentsToPlainText, type ChatRequest, type WireAttachment } from "@/domain/chat";
import type { GenerationAttemptDiagnostic } from "@/domain/eoe";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { GOLDEN_CONVERSATION_CORPUS } from "@/lib/eoe/golden-corpus";
import { parseProviderEnvelope } from "@/lib/eoe/provider-envelope/parser";
import { PROVIDER_GENERATION_ENVELOPE_JSON_SCHEMA } from "@/lib/eoe/provider-envelope/schema";
import { ProviderGateway } from "./gateway";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResult } from "./types";

const glmKey = process.env.GLM_API_KEY?.trim() ?? "";
const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
const enabled = Boolean(glmKey && deepSeekKey && process.env.USE_MOCK_PROVIDER === "false");
const live = enabled ? describe : describe.skip;
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const glmModel = process.env.PRIMARY_MODEL ?? "glm-4.7";
const visionModel = process.env.VISION_MODEL ?? "glm-4.6v";
const deepSeekModel = process.env.FALLBACK_MODEL ?? "deepseek-v4-flash";

type CaseKind = "probe" | "corpus" | "control";
type ProviderLabel = "GLM" | "GLM Vision" | "DeepSeek" | "DeepSeek fallback";

interface CaseSpec {
  id: string;
  kind: CaseKind;
  provider: ProviderLabel;
  message: string;
  fixedLevel: number;
  attachment?: WireAttachment;
  expectNoFit?: boolean;
  expectEnglish?: boolean;
}

interface RawCapture {
  caseId: string;
  providerId: string;
  modelId: string;
  attempt: number;
  rawStructure: unknown;
  envelopeParse: "passed" | "failed";
  parserCodes: string[];
}

interface CaseRecord {
  id: string;
  kind: CaseKind;
  provider: ProviderLabel;
  model: string;
  status: "PASS" | "FAIL";
  failures: string[];
  noFit?: boolean;
  analysisFunction?: string;
  englishChunkCount?: number;
  structuredSuccess: boolean;
  plainText?: string;
  attempts: GenerationAttemptDiagnostic[];
  latencyMs?: number;
  usage?: EngineRunResult["provider"]["usage"];
  providerFallback: boolean;
  naturalFallback: boolean;
  captures: RawCapture[];
}

interface ControlRecord {
  id: string;
  status: "PASS" | "FAIL";
  expected: string;
  actual: string;
}

const captures: RawCapture[] = [];
let activeCaseId = "unassigned";

function createProvider(options: {
  id: string;
  modelId: string;
  key: string;
  baseUrl: string;
  vision?: boolean;
  requestTimeoutMs?: number;
}): OpenAICompatibleProvider {
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
      jsonSchema: false,
      toolCalling: false,
    },
  });
}

function summarizeRaw(content: string): unknown {
  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch {
    return { rootType: "non_json", length: content.length };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { rootType: Array.isArray(raw) ? "array" : typeof raw };
  }
  const record = raw as Record<string, unknown>;
  const summary: Record<string, unknown> = {
    rootType: "object",
    keys: Object.keys(record).sort(),
  };
  for (const key of Object.keys(record).sort()) {
    const value = record[key];
    if (key === "beforeText" || key === "afterText") {
      summary[key] = { type: typeof value, length: typeof value === "string" ? value.length : undefined };
    } else if (key === "englishChunk" && value && typeof value === "object" && !Array.isArray(value)) {
      const chunk = value as Record<string, unknown>;
      summary[key] = {
        keys: Object.keys(chunk).sort(),
        phraseId: typeof chunk.phraseId === "string" ? chunk.phraseId : typeof chunk.phraseId,
        content: { type: typeof chunk.content, length: typeof chunk.content === "string" ? chunk.content.length : undefined },
      };
    } else if (key === "englishChunk" && value === null) {
      summary[key] = null;
    } else if (["schemaVersion", "conversationFunction", "noFit", "intentPreserved", "naturalnessConfidence"].includes(key)) {
      summary[key] = value;
    } else {
      summary[key] = { type: Array.isArray(value) ? "array" : typeof value };
    }
  }
  return summary;
}

class CapturingProvider implements Provider {
  readonly id: string;
  readonly modelId: string;
  readonly capabilities: Provider["capabilities"];

  constructor(private readonly delegate: Provider) {
    this.id = delegate.id;
    this.modelId = delegate.modelId;
    this.capabilities = delegate.capabilities;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const result = await this.delegate.generate(request);
    const parsed = parseProviderEnvelope(result.content, {
      selectedPhraseId: request.eoeContext?.selectedPhraseId,
      selectedPhrase: request.eoeContext?.selectedPhrase,
      selectedPhraseVariants: request.eoeContext?.selectedPhraseVariants,
    });
    captures.push({
      caseId: activeCaseId,
      providerId: result.providerId,
      modelId: result.modelId,
      attempt: request.generationAttempt ?? 1,
      rawStructure: summarizeRaw(result.content),
      envelopeParse: parsed.success ? "passed" : "failed",
      parserCodes: parsed.success ? [] : parsed.diagnostics.map((item) => item.code),
    });
    return result;
  }
}

function request(spec: CaseSpec): ChatRequest {
  return {
    conversationId: `m2-2-live-${spec.id}`,
    messages: [{ role: "user", content: spec.message }],
    attachments: spec.attachment ? [spec.attachment] : [],
    engineState: { recentExposurePhraseIds: [] },
  };
}

async function runCase(spec: CaseSpec, gateway: ProviderGateway): Promise<CaseRecord> {
  activeCaseId = spec.id;
  const captureStart = captures.length;
  try {
    const result = await runEoeEngine({
      request: request(spec),
      gateway,
      config: { enabled: true, fixedLevel: spec.fixedLevel, developerMode: true },
      naturalnessMode: "live",
    });
    const englishChunkCount = result.response.segments.filter((segment) => segment.type === "english_chunk").length;
    const finalAttempt = result.diagnostics.attempts.at(-1);
    const structuredSuccess = Boolean(
      !result.diagnostics.naturalFallbackUsed &&
        result.response.generationAttemptId &&
        finalAttempt?.outcome === "valid" &&
        finalAttempt.pipeline?.envelopeParse === "passed" &&
        finalAttempt.pipeline.envelopeSemantics === "passed" &&
        finalAttempt.pipeline.mapper === "passed" &&
        finalAttempt.pipeline.domainSchema === "passed" &&
        finalAttempt.pipeline.domainValidator === "passed",
    );
    const failures: string[] = [];
    if (!structuredSuccess) failures.push("final structured response did not pass the complete pipeline");
    if (result.diagnostics.attempts.length > 2) failures.push("more than two generation attempts");
    if (!result.provider.usage?.totalTokens) failures.push("Usage missing");
    if (result.provider.latencyMs <= 0) failures.push("Latency missing");
    if (spec.expectNoFit !== undefined && result.response.noFit !== spec.expectNoFit) {
      failures.push(`noFit=${result.response.noFit}, expected ${spec.expectNoFit}`);
    }
    if (spec.expectEnglish && englishChunkCount !== 1) failures.push(`English Chunk count=${englishChunkCount}, expected 1`);
    return {
      id: spec.id,
      kind: spec.kind,
      provider: spec.provider,
      model: result.provider.modelId,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      noFit: result.response.noFit,
      analysisFunction: result.diagnostics.analysis.primaryFunction,
      englishChunkCount,
      structuredSuccess,
      plainText: segmentsToPlainText(result.response.segments),
      attempts: result.diagnostics.attempts,
      latencyMs: result.provider.latencyMs,
      usage: result.provider.usage,
      providerFallback: result.diagnostics.fallbackUsed,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      captures: captures.slice(captureStart),
    };
  } catch (error) {
    return {
      id: spec.id,
      kind: spec.kind,
      provider: spec.provider,
      model: "unavailable",
      status: "FAIL",
      failures: [error instanceof Error ? error.message : "unknown live error"],
      structuredSuccess: false,
      attempts: [],
      providerFallback: false,
      naturalFallback: false,
      captures: captures.slice(captureStart),
    };
  }
}

function finalPipeline(record: CaseRecord): GenerationAttemptDiagnostic["pipeline"] {
  return record.attempts.at(-1)?.pipeline;
}

function rate(numerator: number, denominator: number): string {
  return denominator === 0 ? "n/a" : `${numerator}/${denominator} (${((numerator / denominator) * 100).toFixed(1)}%)`;
}

function renderReport(status: string, records: CaseRecord[], controls: ControlRecord[]): string {
  const probes = records.filter((record) => record.kind === "probe");
  const corpus = records.filter((record) => record.kind === "corpus");
  const probeFirstParse = probes.filter((record) => record.attempts[0]?.pipeline?.envelopeParse === "passed").length;
  const probeFinalParse = probes.filter((record) => finalPipeline(record)?.envelopeParse === "passed").length;
  const probeMapper = probes.filter((record) => finalPipeline(record)?.mapper === "passed").length;
  const probeDomainSchema = probes.filter((record) => finalPipeline(record)?.domainSchema === "passed").length;
  const probeDomainValidator = probes.filter((record) => finalPipeline(record)?.domainValidator === "passed").length;
  const probeStructured = probes.filter((record) => record.structuredSuccess).length;
  const probeRawAttempts = probes.flatMap((record) => record.captures);
  const firstParse = corpus.filter((record) => record.attempts[0]?.pipeline?.envelopeParse === "passed").length;
  const finalParse = corpus.filter((record) => finalPipeline(record)?.envelopeParse === "passed").length;
  const mapper = corpus.filter((record) => finalPipeline(record)?.mapper === "passed").length;
  const domainSchema = corpus.filter((record) => finalPipeline(record)?.domainSchema === "passed").length;
  const domainValidator = corpus.filter((record) => finalPipeline(record)?.domainValidator === "passed").length;
  const structured = corpus.filter((record) => record.structuredSuccess).length;
  const retries = corpus.filter((record) => record.attempts.length === 2).length;
  const providerFallbacks = records.filter((record) => record.providerFallback).length;
  const naturalFallbacks = corpus.filter((record) => record.naturalFallback).length;
  const noFits = corpus.filter((record) => record.noFit).length;
  const chunks = corpus.reduce((sum, record) => sum + (record.englishChunkCount ?? 0), 0);
  const latencies = corpus.map((record) => record.latencyMs).filter((value): value is number => value !== undefined);
  const totalTokens = corpus.reduce((sum, record) => sum + (record.usage?.totalTokens ?? 0), 0);
  const averageLatency = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : undefined;
  const lines = [
    "# M2.2 Live Provider Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Gate Status: \`${status}\``,
    "- Independent Human Review: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
    "- M3: not started",
    "- Adaptive Progression: disabled",
    "- Secrets, Authorization headers, full System Prompt, and private user content: not recorded",
    "",
    "## Six-probe gate",
    "",
    "| ID | Provider / Model | Status | noFit | Chunks | Attempts | Envelope final | Mapper | Domain Schema | Domain Validator | Latency | Tokens |",
    "|---|---|---|---:|---:|---:|---|---|---|---|---:|---:|",
    ...probes.map((record) => {
      const pipeline = finalPipeline(record);
      return `| ${record.id} | ${record.provider} / ${record.model} | ${record.status} | ${record.noFit ?? "n/a"} | ${record.englishChunkCount ?? "n/a"} | ${record.attempts.length} | ${pipeline?.envelopeParse ?? "n/a"} | ${pipeline?.mapper ?? "n/a"} | ${pipeline?.domainSchema ?? "n/a"} | ${pipeline?.domainValidator ?? "n/a"} | ${record.latencyMs ?? "n/a"} | ${record.usage?.totalTokens ?? "n/a"} |`;
    }),
    "",
    `- Probe pass rate: ${rate(probes.filter((record) => record.status === "PASS").length, probes.length)}`,
    `- Probe raw Envelope parse: ${rate(probeRawAttempts.filter((capture) => capture.envelopeParse === "passed").length, probeRawAttempts.length)}`,
    `- Probe first-attempt Envelope parse: ${rate(probeFirstParse, probes.length)}`,
    `- Probe final Envelope parse: ${rate(probeFinalParse, probes.length)}`,
    `- Probe final Mapper success: ${rate(probeMapper, probes.length)}`,
    `- Probe final Domain Schema success: ${rate(probeDomainSchema, probes.length)}`,
    `- Probe final Domain Validator success: ${rate(probeDomainValidator, probes.length)}`,
    `- Probe Final Structured Response success: ${rate(probeStructured, probes.length)}`,
    `- Probe Natural Fallback count: ${probes.filter((record) => record.naturalFallback).length}`,
    `- Full Corpus executed: ${corpus.length > 0 ? "yes" : "no"}`,
    "",
    "## Full Corpus metrics",
    "",
    `- Provider Envelope First-attempt Parse Rate: ${rate(firstParse, corpus.length)}`,
    `- Provider Envelope Final Parse Rate: ${rate(finalParse, corpus.length)}`,
    `- Mapper Success Rate: ${rate(mapper, corpus.length)}`,
    `- Domain Schema Success Rate: ${rate(domainSchema, corpus.length)}`,
    `- Domain Validator Success Rate: ${rate(domainValidator, corpus.length)}`,
    `- Final Structured Response Success Rate: ${rate(structured, corpus.length)}`,
    `- Validator Retry Count: ${retries}`,
    `- Provider Fallback Count: ${providerFallbacks}`,
    `- Natural Fallback Count: ${naturalFallbacks}`,
    `- noFit Count: ${noFits}`,
    `- English Chunk Count: ${chunks}`,
    `- Average Latency: ${averageLatency ?? "n/a"} ms`,
    `- Token Usage: ${totalTokens}`,
    "",
    "Natural Fallback is excluded from Final Structured Response Success.",
    "",
    "## Corpus matrix",
    "",
    "| ID | Provider / Model | Status | Structured | noFit | Chunks | Attempts | Latency | Tokens | Provider Fallback | Natural Fallback |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...corpus.map(
      (record) =>
        `| ${record.id} | ${record.provider} / ${record.model} | ${record.status} | ${record.structuredSuccess} | ${record.noFit ?? "n/a"} | ${record.englishChunkCount ?? "n/a"} | ${record.attempts.length} | ${record.latencyMs ?? "n/a"} | ${record.usage?.totalTokens ?? "n/a"} | ${record.providerFallback} | ${record.naturalFallback} |`,
    ),
    "",
    "## Controls",
    "",
    "| ID | Status | Expected | Actual |",
    "|---|---|---|---|",
    ...controls.map((control) => `| ${control.id} | ${control.status} | ${control.expected} | ${control.actual} |`),
    "",
    "## Redacted raw structure and pipeline diagnostics",
    "",
  ];

  for (const record of records) {
    lines.push(
      `### ${record.id}`,
      "",
      `- Provider / Model: ${record.provider} / ${record.model}`,
      `- Status: ${record.status}`,
      `- Failures: ${record.failures.join("; ") || "none"}`,
      `- Engine Conversation Function: ${record.analysisFunction ?? "unavailable"}`,
      `- Plain Text (synthetic benchmark only): ${JSON.stringify(record.plainText ?? "")}`,
      "- Captured Envelope structures:",
      "",
      "```json",
      JSON.stringify(record.captures, null, 2),
      "```",
      "",
      "- Attempt diagnostics:",
      "",
      "```json",
      JSON.stringify(
        record.attempts.map((attempt) => ({
          attemptNumber: attempt.attemptNumber,
          providerId: attempt.providerId,
          modelId: attempt.modelId,
          outcome: attempt.outcome,
          pipelineStage: attempt.pipelineStage,
          pipeline: attempt.pipeline,
          pipelineCodes: attempt.pipelineDiagnostics?.map((item) => item.code) ?? [],
          validatorCodes: attempt.validation.violations.map((item) => item.code),
          latencyMs: attempt.latencyMs,
          usage: attempt.usage,
          providerFallbackUsed: attempt.providerFallbackUsed,
        })),
        null,
        2,
      ),
      "```",
      "",
    );
  }
  return lines.join("\n");
}

function writeReport(status: string, records: CaseRecord[], controls: ControlRecord[]): void {
  const path = resolve(process.cwd(), "artifacts/benchmarks/m2.2-live-provider-report.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderReport(status, records, controls), "utf8");
}

function golden(id: string): { message: string; fixedLevel: number } {
  const scenario = GOLDEN_CONVERSATION_CORPUS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Missing Golden Corpus scenario ${id}`);
  return { message: scenario.userMessage, fixedLevel: scenario.fixedLevel ?? 2 };
}

function directRequest(id: string, message: string, attachments: WireAttachment[] = [], signal?: AbortSignal): ProviderRequest {
  return {
    requestId: `m2-2-control-${id}`,
    messages: [
      { role: "system", content: "Return exactly one eoe.provider-envelope.v1 JSON Object." },
      { role: "user", content: message },
    ],
    attachments,
    signal,
    responseFormat: "json_schema",
    responseJsonSchema: {
      name: "eoe_provider_generation_envelope_v1",
      schema: PROVIDER_GENERATION_ENVELOPE_JSON_SCHEMA,
      strict: true,
    },
  };
}

async function normalizedErrorControl(
  id: string,
  expected: string,
  action: () => Promise<unknown>,
): Promise<ControlRecord> {
  try {
    await action();
    return { id, status: "FAIL", expected, actual: "no error" };
  } catch (error) {
    const actual = error instanceof ProviderError ? `${error.category}/${error.retryable}` : "unrecognized error";
    return { id, status: actual.startsWith(expected) ? "PASS" : "FAIL", expected, actual };
  }
}

live("M2.2 Live Provider Envelope Gate", () => {
  it(
    "runs six probes before conditionally running the 20-case corpus",
    async () => {
      const records: CaseRecord[] = [];
      const controls: ControlRecord[] = [];
      const fixturePath = resolve(process.cwd(), "tests/fixtures/eoe-live-vision-fixture.svg");
      const png = await sharp(Buffer.from(readFileSync(fixturePath, "utf8"))).png().toBuffer();
      const image: WireAttachment = {
        id: "m2-2-live-image",
        name: "eoe-live-vision-fixture.png",
        mimeType: "image/png",
        size: png.length,
        dataUrl: `data:image/png;base64,${png.toString("base64")}`,
      };

      const rawGlm = createProvider({
        id: "glm",
        modelId: glmModel,
        key: glmKey,
        baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
      });
      const rawVision = createProvider({
        id: "glm-vision",
        modelId: visionModel,
        key: glmKey,
        baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
        vision: true,
      });
      const rawDeepSeek = createProvider({
        id: "deepseek",
        modelId: deepSeekModel,
        key: deepSeekKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      });
      const glm = new CapturingProvider(rawGlm);
      const vision = new CapturingProvider(rawVision);
      const deepSeek = new CapturingProvider(rawDeepSeek);
      const mock = new MockProvider();
      const glmGateway = new ProviderGateway({ primary: glm, vision, mock, forceMock: false });
      const deepSeekGateway = new ProviderGateway({ primary: deepSeek, vision, mock, forceMock: false });

      const probes: Array<[CaseSpec, ProviderGateway]> = [
        [
          { id: "probe-glm-no-fit", kind: "probe", provider: "GLM", message: "好", fixedLevel: 2, expectNoFit: true },
          glmGateway,
        ],
        [
          { id: "probe-glm-english", kind: "probe", provider: "GLM", message: "我该怎么安排下一步计划？", fixedLevel: 2, expectNoFit: false, expectEnglish: true },
          glmGateway,
        ],
        [
          { id: "probe-vision-no-fit", kind: "probe", provider: "GLM Vision", message: "只用中文简短描述图片。", fixedLevel: 2, attachment: image, expectNoFit: true },
          glmGateway,
        ],
        [
          { id: "probe-vision-english", kind: "probe", provider: "GLM Vision", message: "分析图片，并给出下一步建议。", fixedLevel: 2, attachment: image, expectNoFit: false, expectEnglish: true },
          glmGateway,
        ],
        [
          { id: "probe-deepseek-no-fit", kind: "probe", provider: "DeepSeek", message: "只用中文", fixedLevel: 2, expectNoFit: true },
          deepSeekGateway,
        ],
        [
          { id: "probe-deepseek-english", kind: "probe", provider: "DeepSeek", message: "怎样做一个低风险的执行计划？", fixedLevel: 2, expectNoFit: false, expectEnglish: true },
          deepSeekGateway,
        ],
      ];
      for (const [spec, gateway] of probes) records.push(await runCase(spec, gateway));

      const failedProbes = records.filter((record) => record.kind === "probe" && record.status === "FAIL");
      if (failedProbes.length > 0) {
        writeReport("LIVE_PROBE_FAIL", records, controls);
        expect(failedProbes.map((record) => record.id)).toEqual([]);
      }

      const corpusAssignments: Array<[string, ProviderLabel, ProviderGateway, WireAttachment?]> = [
        ["daily-weekend", "GLM", glmGateway],
        ["plan-study", "GLM", glmGateway],
        ["simple-opinion-books", "GLM", glmGateway],
        ["complex-opinion-ai", "GLM", glmGateway],
        ["short-ok", "GLM", glmGateway],
        ["chinese-only-explain", "GLM", glmGateway],
        ["emotional-pressure", "GLM", glmGateway],
        ["technical-typescript", "GLM", glmGateway],
        ["user-english-opinion", "GLM", glmGateway],
        ["reuse-step", "GLM", glmGateway],
        ["image-overview", "GLM Vision", glmGateway, image],
        ["image-detail", "GLM Vision", glmGateway, image],
        ["daily-hello", "DeepSeek", deepSeekGateway],
        ["simple-opinion-remote", "DeepSeek", deepSeekGateway],
        ["complex-opinion-city", "DeepSeek", deepSeekGateway],
        ["plan-trip", "DeepSeek", deepSeekGateway],
        ["user-english-advice", "DeepSeek", deepSeekGateway],
        ["chinese-only-detail", "DeepSeek", deepSeekGateway],
        ["reuse-good-place", "DeepSeek", deepSeekGateway],
        ["level-three", "DeepSeek", deepSeekGateway],
      ];
      for (const [id, provider, gateway, attachment] of corpusAssignments) {
        const scenario = golden(id);
        records.push(
          await runCase(
            { id, kind: "corpus", provider, message: scenario.message, fixedLevel: scenario.fixedLevel, attachment },
            gateway,
          ),
        );
      }

      const failingGlm: Provider = {
        id: "glm",
        modelId: glmModel,
        capabilities: glm.capabilities,
        async generate() {
          throw new ProviderError("controlled fallback trigger", "provider_unavailable", true, 503, "controlled");
        },
      };
      const fallbackRecord = await runCase(
        {
          id: "control-glm-to-deepseek-fallback",
          kind: "control",
          provider: "DeepSeek fallback",
          message: "请说明怎样验证下一步。",
          fixedLevel: 2,
        },
        new ProviderGateway({ primary: failingGlm, vision, fallback: deepSeek, mock, forceMock: false }),
      );
      records.push(fallbackRecord);
      controls.push({
        id: "glm-to-deepseek-fallback",
        status: fallbackRecord.status === "PASS" && fallbackRecord.providerFallback ? "PASS" : "FAIL",
        expected: "real DeepSeek fallback with valid Domain response",
        actual: `structured=${fallbackRecord.structuredSuccess}, fallback=${fallbackRecord.providerFallback}`,
      });

      const visionCancel = new AbortController();
      controls.push(
        await normalizedErrorControl("vision-cancel", "cancelled/false", async () => {
          const pending = rawVision.generate(directRequest("vision-cancel", "描述图片。", [image], visionCancel.signal));
          setTimeout(() => visionCancel.abort(), 10);
          await pending;
        }),
      );
      const timeoutVision = createProvider({
        id: "glm-vision",
        modelId: visionModel,
        key: glmKey,
        baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
        vision: true,
        requestTimeoutMs: 1,
      });
      controls.push(
        await normalizedErrorControl("vision-timeout", "timeout/true", () =>
          timeoutVision.generate(directRequest("vision-timeout", "描述图片。", [image])),
        ),
      );
      const deepSeekCancel = new AbortController();
      controls.push(
        await normalizedErrorControl("deepseek-cancel", "cancelled/false", async () => {
          const pending = rawDeepSeek.generate(directRequest("deepseek-cancel", "简短回答。", [], deepSeekCancel.signal));
          setTimeout(() => deepSeekCancel.abort(), 10);
          await pending;
        }),
      );
      const timeoutDeepSeek = createProvider({
        id: "deepseek",
        modelId: deepSeekModel,
        key: deepSeekKey,
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        requestTimeoutMs: 1,
      });
      controls.push(
        await normalizedErrorControl("deepseek-timeout", "timeout/true", () =>
          timeoutDeepSeek.generate(directRequest("deepseek-timeout", "简短回答。")),
        ),
      );

      const corpus = records.filter((record) => record.kind === "corpus");
      const structuredCount = corpus.filter((record) => record.structuredSuccess).length;
      const mapperCount = corpus.filter((record) => finalPipeline(record)?.mapper === "passed").length;
      const domainSchemaCount = corpus.filter((record) => finalPipeline(record)?.domainSchema === "passed").length;
      const providerRates = (["GLM", "GLM Vision", "DeepSeek"] as const).map((provider) => {
        const providerRecords = corpus.filter((record) => record.provider === provider);
        return {
          provider,
          passed: providerRecords.filter((record) => record.structuredSuccess).length,
          total: providerRecords.length,
        };
      });
      const gateFailures: string[] = [];
      if (corpus.length !== 20) gateFailures.push(`corpus count ${corpus.length}`);
      if (mapperCount !== 20) gateFailures.push(`mapper ${mapperCount}/20`);
      if (domainSchemaCount !== 20) gateFailures.push(`domain schema ${domainSchemaCount}/20`);
      if (structuredCount / 20 < 0.95) gateFailures.push(`structured ${structuredCount}/20`);
      for (const providerRate of providerRates) {
        if (providerRate.passed / providerRate.total < 0.9) {
          gateFailures.push(`${providerRate.provider} ${providerRate.passed}/${providerRate.total}`);
        }
      }
      if (controls.some((control) => control.status === "FAIL")) gateFailures.push("control failure");
      if (records.some((record) => !record.usage?.totalTokens && record.kind !== "control")) gateFailures.push("Usage missing");
      if (records.some((record) => (record.latencyMs ?? 0) <= 0 && record.kind !== "control")) gateFailures.push("Latency missing");

      const status = gateFailures.length === 0 ? "M2_2_PASS_WITH_HUMAN_REVIEW_PENDING" : "M2_2_FAIL";
      writeReport(status, records, controls);
      expect(gateFailures).toEqual([]);
    },
    900_000,
  );
});
