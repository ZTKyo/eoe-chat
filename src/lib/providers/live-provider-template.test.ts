import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { segmentsToPlainText, type ChatRequest, type WireAttachment } from "@/domain/chat";
import type { ConversationFunction, GenerationAttemptDiagnostic, PhrasePosition } from "@/domain/eoe";
import { runEoeEngine, type EngineRunResult } from "@/lib/eoe/engine";
import { GOLDEN_CONVERSATION_CORPUS, type GoldenScenario } from "@/lib/eoe/golden-corpus";
import { PHRASE_REGISTRY } from "@/lib/eoe/registry/phrase-registry";
import { LIVE_SAFE_PHRASES } from "@/lib/eoe/registry/phrase-realization";
import {
  LIVE_CAPTURE_FIXTURE_VERSION,
  assertSafeSyntheticCapture,
  liveAttemptCaptureSchema,
  sha256Text,
  type LiveAttemptCapture,
} from "@/lib/eoe/provider-template/live-capture";
import { parseProviderResponseTemplate } from "@/lib/eoe/provider-template/parser";
import { EOE_PHRASE_PLACEHOLDER } from "@/lib/eoe/provider-template/schema";
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
const m232 = process.env.EOE_M2_3_2_LIVE === "true";
const finalVerification = process.env.EOE_M2_FINAL_LIVE === "true";
const runId = `${finalVerification ? "m2-final" : m232 ? "m2-3-2" : "m2-3-1"}-${new Date().toISOString().replace(/[:.]/gu, "-")}`;

const REQUEST_LIMIT = finalVerification ? 40 : m232 ? 20 : 60;
const TOKEN_LIMIT = finalVerification ? 50_000 : m232 ? 30_000 : 150_000;
const PROVIDER_RUNTIME_LIMIT_MS = (finalVerification || m232 ? 30 : 90) * 60_000;

type CaseKind = "capability_probe" | "fallback_probe" | "corpus";
type ExpectedResult = "no_fit" | "english_chunk" | "valid";
type FinalCaseOutcome =
  | "valid_provider_structured_response"
  | "natural_fallback_failure"
  | "provider_error_failure"
  | "budget_or_security_blocked"
  | "not_executed";

interface CaseSpec {
  id: string;
  kind: CaseKind;
  providerLabel: string;
  provider: Provider;
  message: string;
  fixedLevel: number;
  expectedResult: ExpectedResult;
  expectedFunction?: ConversationFunction;
  recentExposurePhraseIds?: string[];
  attachment?: WireAttachment;
}

interface RawCapture {
  caseId: string;
  caseKind: CaseKind;
  providerId: string;
  modelId: string;
  attemptNumber: 1 | 2;
  rawProviderText: string;
  rawSha256: string;
  parse: "passed" | "failed";
  keys: string[];
  responseTemplateLength?: number;
  placeholderCount?: number;
  parserCodes: string[];
}

interface CaseRecord {
  id: string;
  kind: CaseKind;
  userMessage?: string;
  routedProvider?: string;
  routedModel?: string;
  provider: string;
  model: string;
  status: "PASS" | "FAIL";
  failures: string[];
  expectedResult: ExpectedResult;
  actualResult?: ExpectedResult;
  phrasePosition?: PhrasePosition;
  selectedPhraseId?: string;
  candidatePhraseIds?: string[];
  noFit?: boolean;
  noFitReason?: string;
  conversationFunction?: string;
  sensitivity?: string;
  attempts: GenerationAttemptDiagnostic[];
  latencyMs?: number;
  usage?: EngineRunResult["provider"]["usage"];
  providerFallback: boolean;
  naturalFallback: boolean;
  plainTextLength?: number;
  plainText?: string;
  englishChunks?: string[];
  finalOutcome?: FinalCaseOutcome;
  rawCaptures: Array<Omit<RawCapture, "rawProviderText"> & { fixtureFile?: string }>;
}

interface BudgetEvent {
  providerId: string;
  modelId: string;
  caseId: string;
  attemptNumber: number;
  startedAt: string;
  latencyMs?: number;
  tokens?: number;
  outcome: "started" | "success" | "error";
}

interface BudgetLedger {
  schemaVersion: "m2.autonomous-live-budget.v1" | "m2.3.2-live-budget.v1" | "m2.final-live-budget.v1";
  limits: { requests: number; tokens: number; providerRuntimeMs: number };
  totals: { requests: number; tokens: number; providerRuntimeMs: number };
  events: BudgetEvent[];
}

const captureDirectory = finalVerification
  ? join(process.cwd(), "artifacts", "regressions", "m2-final-live-captures")
  : m232
    ? join(process.cwd(), "artifacts", "regressions", "m2.3.2-deepseek-boundary", "live-captures")
    : join(process.cwd(), "artifacts", "regressions", "m2.3-live-captures");
const reportDirectory = join(process.cwd(), "artifacts", "benchmarks");
const budgetPath = join(
  reportDirectory,
  finalVerification ? "m2-final-live-budget.json" : m232 ? "m2.3.2-live-budget.json" : "autonomous-m2-live-budget.json",
);
const captures: RawCapture[] = [];
let activeCaseId = "unassigned";
let activeCaseKind: CaseKind = "capability_probe";
let budgetStopReason: string | undefined;
let securityStopReason: string | undefined;

function loadLedger(): BudgetLedger {
  if (existsSync(budgetPath)) {
    return JSON.parse(readFileSync(budgetPath, "utf8")) as BudgetLedger;
  }
  return {
    schemaVersion: finalVerification
      ? "m2.final-live-budget.v1"
      : m232
        ? "m2.3.2-live-budget.v1"
        : "m2.autonomous-live-budget.v1",
    limits: { requests: REQUEST_LIMIT, tokens: TOKEN_LIMIT, providerRuntimeMs: PROVIDER_RUNTIME_LIMIT_MS },
    totals: { requests: 0, tokens: 0, providerRuntimeMs: 0 },
    events: [],
  };
}

const ledger = loadLedger();

function saveLedger(): void {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(budgetPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function assertBudget(): void {
  const reasons = [
    ledger.totals.requests >= REQUEST_LIMIT ? `request budget ${ledger.totals.requests}/${REQUEST_LIMIT}` : undefined,
    ledger.totals.tokens >= TOKEN_LIMIT ? `token budget ${ledger.totals.tokens}/${TOKEN_LIMIT}` : undefined,
    ledger.totals.providerRuntimeMs >= PROVIDER_RUNTIME_LIMIT_MS
      ? `runtime budget ${ledger.totals.providerRuntimeMs}/${PROVIDER_RUNTIME_LIMIT_MS}ms`
      : undefined,
  ].filter(Boolean);
  if (reasons.length > 0) {
    budgetStopReason = reasons.join("; ");
    throw new ProviderError(`autonomous live budget exhausted: ${budgetStopReason}`, "invalid_request", false, 400);
  }
}

function createProvider(options: { id: string; modelId: string; key: string; baseUrl: string; vision?: boolean }): Provider {
  return new OpenAICompatibleProvider({
    id: options.id,
    modelId: options.modelId,
    baseUrl: options.baseUrl,
    apiKey: options.key,
    timeoutMs,
    thinking: "disabled",
    capabilities: {
      text: true,
      vision: options.vision ?? false,
      streaming: false,
      jsonMode: !(options.vision ?? false),
      jsonSchema: false,
      toolCalling: false,
    },
  });
}

class BudgetedCapturingProvider implements Provider {
  readonly id: string;
  readonly modelId: string;
  readonly capabilities: Provider["capabilities"];

  constructor(private readonly delegate: Provider) {
    this.id = delegate.id;
    this.modelId = delegate.modelId;
    this.capabilities = delegate.capabilities;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    assertBudget();
    const event: BudgetEvent = {
      providerId: this.id,
      modelId: this.modelId,
      caseId: activeCaseId,
      attemptNumber: request.generationAttempt ?? 1,
      startedAt: new Date().toISOString(),
      outcome: "started",
    };
    ledger.totals.requests += 1;
    ledger.events.push(event);
    saveLedger();
    const started = performance.now();
    try {
      const result = await this.delegate.generate(request);
      const elapsed = Math.round(performance.now() - started);
      const tokens = result.usage?.totalTokens ?? 0;
      event.latencyMs = elapsed;
      event.tokens = tokens;
      event.outcome = "success";
      ledger.totals.providerRuntimeMs += elapsed;
      ledger.totals.tokens += tokens;
      saveLedger();

      const parsed = parseProviderResponseTemplate(result.content);
      let keys: string[] = [];
      let responseTemplateLength: number | undefined;
      let placeholderCount: number | undefined;
      try {
        const raw = JSON.parse(result.content) as unknown;
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          const record = raw as Record<string, unknown>;
          keys = Object.keys(record).sort();
          if (typeof record.responseTemplate === "string") {
            responseTemplateLength = record.responseTemplate.length;
            placeholderCount = record.responseTemplate.split(EOE_PHRASE_PLACEHOLDER).length - 1;
          }
        }
      } catch {
        // The strict parser diagnostics remain authoritative.
      }
      captures.push({
        caseId: activeCaseId,
        caseKind: activeCaseKind,
        providerId: result.providerId,
        modelId: result.modelId,
        attemptNumber: request.generationAttempt ?? 1,
        rawProviderText: result.content,
        rawSha256: sha256Text(result.content),
        parse: parsed.success ? "passed" : "failed",
        keys,
        responseTemplateLength,
        placeholderCount,
        parserCodes: parsed.success ? [] : parsed.diagnostics.map((item) => item.code),
      });
      return result;
    } catch (error) {
      const elapsed = Math.round(performance.now() - started);
      event.latencyMs = elapsed;
      event.outcome = "error";
      ledger.totals.providerRuntimeMs += elapsed;
      saveLedger();
      throw error;
    }
  }
}

const glm = new BudgetedCapturingProvider(createProvider({
  id: "glm", modelId: glmModel, key: glmKey,
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
}));
const vision = new BudgetedCapturingProvider(createProvider({
  id: "glm-vision", modelId: visionModel, key: glmKey,
  baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4", vision: true,
}));
const deepSeek = new BudgetedCapturingProvider(createProvider({
  id: "deepseek", modelId: deepSeekModel, key: deepSeekKey,
  baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
}));
const mock = new MockProvider();

const image: WireAttachment = {
  id: "m2-3-1-live-image",
  name: "m2-3-1-probe.png",
  mimeType: "image/png",
  size: 68,
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
};

function request(spec: CaseSpec): ChatRequest {
  return {
    conversationId: `m2-3-1-live-${spec.id}`,
    messages: [{ role: "user", content: spec.message }],
    attachments: spec.attachment ? [spec.attachment] : [],
    engineState: {
      recentExposurePhraseIds: spec.recentExposurePhraseIds ?? [],
      developerMode: true,
    },
  };
}

function actualResult(result: EngineRunResult): ExpectedResult {
  if (result.response.noFit) return "no_fit";
  return result.response.segments.some((segment) => segment.type === "english_chunk") ? "english_chunk" : "valid";
}

function phrasePosition(result: EngineRunResult): PhrasePosition | undefined {
  const index = result.response.segments.findIndex((segment) => segment.type === "english_chunk");
  if (index < 0) return undefined;
  if (result.response.segments.length === 1) return "standalone";
  if (index === 0) return "sentence_start";
  if (index === result.response.segments.length - 1) return "sentence_end";
  return "sentence_middle";
}

function completePipeline(attempt?: GenerationAttemptDiagnostic): boolean {
  return Boolean(
    attempt?.outcome === "valid" &&
    attempt.pipeline?.templateParse === "passed" &&
    attempt.pipeline.templateValidator === "passed" &&
    attempt.pipeline.mapper === "passed" &&
    attempt.pipeline.domainSchema === "passed" &&
    attempt.pipeline.domainValidator === "passed",
  );
}

function summarizeRawCapture(capture: RawCapture): Omit<RawCapture, "rawProviderText"> {
  return {
    caseId: capture.caseId,
    caseKind: capture.caseKind,
    providerId: capture.providerId,
    modelId: capture.modelId,
    attemptNumber: capture.attemptNumber,
    rawSha256: capture.rawSha256,
    parse: capture.parse,
    keys: capture.keys,
    responseTemplateLength: capture.responseTemplateLength,
    placeholderCount: capture.placeholderCount,
    parserCodes: capture.parserCodes,
  };
}

function persistFixtures(rawCaptures: RawCapture[], result: EngineRunResult): CaseRecord["rawCaptures"] {
  mkdirSync(captureDirectory, { recursive: true });
  return rawCaptures.map((capture) => {
    const summary = summarizeRawCapture(capture);
    const attempt = result.diagnostics.attempts.find((item) => item.attemptNumber === capture.attemptNumber);
    if (!attempt?.pipeline) return summary;
    const selected = result.diagnostics.selection.candidates.find(
      (item) => item.phraseId === result.diagnostics.selection.selectedPhraseId,
    );
    const fixture: LiveAttemptCapture = {
      fixtureVersion: LIVE_CAPTURE_FIXTURE_VERSION,
      runId,
      caseId: capture.caseId,
      caseKind: capture.caseKind,
      providerId: capture.providerId,
      modelId: capture.modelId,
      attemptNumber: capture.attemptNumber,
      rawProviderText: capture.rawProviderText,
      rawSha256: capture.rawSha256,
      engineContext: {
        analysis: result.diagnostics.analysis,
        decision: result.diagnostics.decision,
        selection: result.diagnostics.selection,
        selectedPhraseId: result.diagnostics.selection.selectedPhraseId,
        selectedPhraseIsNew: selected ? !selected.isReuse : false,
      },
      observed: {
        outcome: attempt.outcome,
        pipelineStage: attempt.pipelineStage,
        pipeline: attempt.pipeline,
        violationCodes: attempt.validation.violations.map((item) => item.code),
        pipelineCodes: attempt.pipelineDiagnostics?.map((item) => item.code) ?? [],
        latencyMs: attempt.latencyMs,
        usage: attempt.usage,
        providerFallbackUsed: attempt.providerFallbackUsed,
        naturalFallbackUsed: result.diagnostics.naturalFallbackUsed,
      },
    };
    try {
      assertSafeSyntheticCapture(fixture);
      const parsed = liveAttemptCaptureSchema.parse(fixture);
      const fileName = `${runId}--${capture.caseId}--attempt-${capture.attemptNumber}.json`;
      writeFileSync(join(captureDirectory, fileName), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      return { ...summary, fixtureFile: fileName };
    } catch (error) {
      securityStopReason = error instanceof Error ? error.message : "unsafe capture rejected";
      return summary;
    }
  });
}

async function runCase(spec: CaseSpec, gateway?: ProviderGateway): Promise<CaseRecord> {
  activeCaseId = spec.id;
  activeCaseKind = spec.kind;
  const captureStart = captures.length;
  try {
    const selectedGateway = gateway ?? new ProviderGateway({
      primary: spec.provider,
      vision: spec.provider,
      fallback: undefined,
      mock,
      forceMock: false,
    });
    const result = await runEoeEngine({
      request: request(spec),
      gateway: selectedGateway,
      config: { enabled: true, fixedLevel: spec.fixedLevel, developerMode: true },
      naturalnessMode: "live",
    });
    const finalAttempt = result.diagnostics.attempts.at(-1);
    const actual = actualResult(result);
    const failures: string[] = [];
    if (!completePipeline(finalAttempt)) failures.push("complete M2.3 structured pipeline did not pass");
    if (result.diagnostics.naturalFallbackUsed) failures.push("Natural Fallback used");
    if (result.diagnostics.attempts.length > 2) failures.push("more than two generation attempts");
    if (spec.expectedResult !== "valid" && actual !== spec.expectedResult) {
      failures.push(`result=${actual}, expected=${spec.expectedResult}`);
    }
    if (spec.expectedFunction && result.diagnostics.analysis.primaryFunction !== spec.expectedFunction) {
      failures.push(`function=${result.diagnostics.analysis.primaryFunction}, expected=${spec.expectedFunction}`);
    }
    if (result.provider.modelId !== spec.provider.modelId && spec.kind !== "fallback_probe") {
      failures.push(`model=${result.provider.modelId}, expected=${spec.provider.modelId}`);
    }
    if (!result.provider.usage?.totalTokens) failures.push("Usage missing");
    if (result.provider.latencyMs <= 0) failures.push("Latency missing");
    const rawCaseCaptures = captures.slice(captureStart);
    const finalRaw = rawCaseCaptures.at(-1);
    const finalTemplate = finalRaw ? parseProviderResponseTemplate(finalRaw.rawProviderText) : undefined;
    const noFitReason = finalTemplate?.success && !finalTemplate.template.usePhrase
      ? finalTemplate.template.noFitReason
      : undefined;
    const caseCaptures = persistFixtures(rawCaseCaptures, result);
    if (securityStopReason) failures.push(`security stop: ${securityStopReason}`);
    const finalOutcome: FinalCaseOutcome = budgetStopReason || securityStopReason
      ? "budget_or_security_blocked"
      : completePipeline(finalAttempt) && !result.diagnostics.naturalFallbackUsed
        ? "valid_provider_structured_response"
        : result.diagnostics.attempts.some((attempt) => attempt.outcome === "provider_error")
          ? "provider_error_failure"
          : "natural_fallback_failure";
    return {
      id: spec.id,
      kind: spec.kind,
      userMessage: spec.message,
      routedProvider: spec.provider.id,
      routedModel: spec.provider.modelId,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      expectedResult: spec.expectedResult,
      actualResult: actual,
      phrasePosition: phrasePosition(result),
      selectedPhraseId: result.diagnostics.selection.selectedPhraseId,
      candidatePhraseIds: result.diagnostics.selection.candidates.map((candidate) => candidate.phraseId),
      noFit: result.response.noFit,
      noFitReason,
      conversationFunction: result.diagnostics.analysis.primaryFunction,
      sensitivity: result.diagnostics.analysis.sensitivity,
      attempts: result.diagnostics.attempts,
      latencyMs: result.provider.latencyMs,
      usage: result.provider.usage,
      providerFallback: result.diagnostics.fallbackUsed,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      plainTextLength: segmentsToPlainText(result.response.segments).length,
      plainText: segmentsToPlainText(result.response.segments),
      englishChunks: result.response.segments
        .filter((segment) => segment.type === "english_chunk")
        .map((segment) => segment.content),
      finalOutcome,
      rawCaptures: caseCaptures,
    };
  } catch (error) {
    return {
      id: spec.id,
      kind: spec.kind,
      userMessage: spec.message,
      routedProvider: spec.provider.id,
      routedModel: spec.provider.modelId,
      provider: spec.providerLabel,
      model: spec.provider.modelId,
      status: "FAIL",
      failures: [error instanceof Error ? error.message : "unknown live error"],
      expectedResult: spec.expectedResult,
      attempts: [],
      providerFallback: false,
      naturalFallback: false,
      finalOutcome: budgetStopReason || securityStopReason
        ? "budget_or_security_blocked"
        : "provider_error_failure",
      rawCaptures: captures.slice(captureStart).map(summarizeRawCapture),
    };
  }
}

function markdownCell(value: string | undefined): string {
  return (value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function priorGateEvidence(): { capability: boolean; fallback: boolean } {
  const path = join(reportDirectory, "m2.3-live-provider-report.md");
  const report = existsSync(path) ? readFileSync(path, "utf8") : "";
  return {
    capability: report.includes("- Capability Probes: 6/6"),
    fallback: /glm-to-deepseek-provider-fallback[^\n]*\| PASS \|/u.test(report),
  };
}

function renderReport(status: string, records: CaseRecord[], fallbackExecuted: boolean, corpusExecuted: boolean): string {
  const probes = records.filter((record) => record.kind === "capability_probe");
  const corpus = records.filter((record) => record.kind === "corpus");
  const providerRates = [...new Set(corpus.map((item) => item.provider))].map((provider) => {
    const items = corpus.filter((item) => item.provider === provider);
    return `${provider}=${items.filter((item) => item.status === "PASS").length}/${items.length}`;
  });
  const positions = records.reduce<Record<string, number>>((accumulator, record) => {
    if (record.phrasePosition) accumulator[record.phrasePosition] = (accumulator[record.phrasePosition] ?? 0) + 1;
    return accumulator;
  }, {});
  const prior = priorGateEvidence();
  const deepSeekStage = corpus.slice(0, 9);
  return [
    m232 ? "# M2.3.2 Live Provider Boundary Closure Report" : "# M2.3.1 Live Provider Capability Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Run ID: \`${runId}\``,
    `- Final Status: \`${status}\``,
    `- Capability Probes: ${probes.filter((item) => item.status === "PASS").length}/6`,
    `- Separate Provider Fallback Probe Executed: ${fallbackExecuted ? "yes" : "no"}`,
    `- 20-case Live Corpus Executed: ${corpusExecuted ? "yes" : "no"}`,
    `- Live Corpus Pass: ${corpus.filter((item) => item.status === "PASS").length}/${corpus.length}`,
    `- Corpus Provider Rates: ${providerRates.join(", ") || "not executed"}`,
    ...(m232 ? [
      `- Progressive Stage 1 (long-analysis): ${corpus.length >= 1 && corpus[0]?.status === "PASS" ? "1/1 PASS" : "not passed"}`,
      `- Progressive Stage 2 (long-analysis + known English + known noFit): ${corpus.length >= 3 && corpus.slice(0, 3).every((item) => item.status === "PASS") ? "3/3 PASS" : "not passed"}`,
      `- Progressive Stage 3 (original DeepSeek Corpus): ${deepSeekStage.filter((item) => item.status === "PASS").length}/${deepSeekStage.length}`,
      `- Prior unchanged Capability Probe evidence: ${prior.capability ? "6/6 PASS" : "not proven"} (not re-executed under the 20-request cap)`,
      `- Prior unchanged Fallback Probe evidence: ${prior.fallback ? "PASS" : "not proven"} (not re-executed under the 20-request cap)`,
      `- Provider noFit count: ${corpus.filter((item) => item.status === "PASS" && item.noFit).length}`,
      `- English Chunk count: ${corpus.filter((item) => item.status === "PASS" && (item.englishChunks?.length ?? 0) > 0).length}`,
      `- Natural Fallback count: ${corpus.filter((item) => item.naturalFallback).length}`,
      "- Stage execution model: cumulative progressive prefixes; each original Corpus case is called once so the full gate can fit the hard 20-request ceiling.",
    ] : []),
    `- Phrase Position Distribution: ${JSON.stringify(positions)}`,
    `- Autonomous Budget: requests=${ledger.totals.requests}/${REQUEST_LIMIT}, tokens=${ledger.totals.tokens}/${TOKEN_LIMIT}, providerRuntimeMs=${ledger.totals.providerRuntimeMs}/${PROVIDER_RUNTIME_LIMIT_MS}`,
    `- Budget Stop: ${budgetStopReason ?? "no"}`,
    `- Security Stop: ${securityStopReason ?? "no"}`,
    "- M3: not started",
    "- Adaptive Progression: disabled",
    "- Independent Human Review: pending",
    "- Secrets, Authorization headers, full directives, image bytes, and private user content: not recorded",
    "",
    "| ID | Kind | Provider / Model | Status | Expected | Actual | Phrase / Position | Attempts | Latency | Tokens | Fallback |",
    "|---|---|---|---|---|---|---|---:|---:|---:|---|",
    ...records.map((record) => `| ${record.id} | ${record.kind} | ${record.provider} / ${record.model} | ${record.status} | ${record.expectedResult} | ${record.actualResult ?? "n/a"} | ${record.selectedPhraseId ?? "none"} / ${record.phrasePosition ?? "none"} | ${record.attempts.length} | ${record.latencyMs ?? "n/a"} | ${record.usage?.totalTokens ?? "n/a"} | provider=${record.providerFallback}, natural=${record.naturalFallback} |`),
    "",
    "## Per-attempt diagnostics",
    "",
    "| Case | Attempt | Provider / Model | Outcome | Final Stage | Violation Codes | Pipeline Codes | Latency | Tokens | Natural Fallback |",
    "|---|---:|---|---|---|---|---|---:|---:|---|",
    ...records.flatMap((record) => record.attempts.map((attempt) => `| ${record.id} | ${attempt.attemptNumber} | ${attempt.providerId} / ${attempt.modelId} | ${attempt.outcome} | ${attempt.pipelineStage ?? "n/a"} | ${attempt.validation.violations.map((item) => item.code).join(", ") || "none"} | ${attempt.pipelineDiagnostics?.map((item) => item.code).join(", ") || "none"} | ${attempt.latencyMs} | ${attempt.usage?.totalTokens ?? "n/a"} | ${record.naturalFallback} |`)),
    "",
    "## Failures",
    "",
    ...records.filter((record) => record.failures.length > 0).map((record) => `- ${record.id}: ${record.failures.join("; ")}`),
    ...(records.every((record) => record.failures.length === 0) ? ["- none"] : []),
    "",
    "## Redacted raw Template evidence",
    "",
    "Raw Template text is stored only in the synthetic replay fixtures. This report exposes hashes and structure only.",
    "",
    "```json",
    JSON.stringify(records.flatMap((record) => record.rawCaptures), null, 2),
    "```",
    "",
    ...(m232 ? [
      "## Actual final text from the synthetic Golden Corpus",
      "",
      "| Case | Provider | Function | Phrase | noFit | English Chunk | Position | Attempts | Validator | Natural Fallback | Latency | Tokens | Plain Text Projection |",
      "|---|---|---|---|---|---|---|---:|---|---|---:|---:|---|",
      ...corpus.map((record) => `| ${record.id} | ${record.provider} / ${record.model} | ${record.conversationFunction ?? "n/a"} | ${record.selectedPhraseId ?? "none"} | ${record.noFit ?? "n/a"} | ${markdownCell(record.englishChunks?.join(", ") || "none")} | ${record.phrasePosition ?? "none"} | ${record.attempts.length} | ${record.status} | ${record.naturalFallback} | ${record.latencyMs ?? "n/a"} | ${record.usage?.totalTokens ?? "n/a"} | ${markdownCell(record.plainText)} |`),
      "",
    ] : []),
  ].join("\n");
}

function writeReport(status: string, records: CaseRecord[], fallbackExecuted: boolean, corpusExecuted: boolean): void {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(
    join(reportDirectory, m232 ? "m2.3.2-live-report.md" : "m2.3-live-provider-report.md"),
    renderReport(status, records, fallbackExecuted, corpusExecuted),
    "utf8",
  );
}

function writeHumanReviewPackage(records: CaseRecord[]): void {
  const directory = join(process.cwd(), "artifacts", "human-review", "m2-final");
  mkdirSync(directory, { recursive: true });
  const corpus = records.filter((record) => record.kind === "corpus");
  const corpusRows = corpus.map((record) =>
    `| ${record.id} | ${record.provider} / ${record.model} | ${record.conversationFunction ?? "n/a"} | ${record.selectedPhraseId ?? "none"} | ${record.noFit ?? "n/a"} | ${markdownCell(record.englishChunks?.join(", ") || "none")} | ${record.phrasePosition ?? "none"} | ${record.attempts.length} | ${record.status} | ${record.naturalFallback} | ${record.latencyMs ?? "n/a"} | ${record.usage?.totalTokens ?? "n/a"} | ${markdownCell(record.plainText)} |`,
  );
  writeFileSync(join(directory, "LIVE_CORPUS_20.md"), [
    "# Final Live Corpus — Independent Review Copy",
    "",
    "All inputs are the repository's synthetic Golden Corpus. Independent Human Review remains pending.",
    "",
    "| Case | Provider | Function | Selected Phrase | noFit | English Chunk | Position | Attempts | Validator | Natural Fallback | Latency | Tokens | Plain Text Projection |",
    "|---|---|---|---|---|---|---|---:|---|---|---:|---:|---|",
    ...corpusRows,
    "",
  ].join("\n"), "utf8");

  const naturalnessPath = join(reportDirectory, "m2.3-naturalness-report.md");
  if (existsSync(naturalnessPath)) {
    writeFileSync(
      join(directory, "NATURALNESS_BENCHMARK_45.md"),
      readFileSync(naturalnessPath, "utf8"),
      "utf8",
    );
  }
  const checklistPath = join(process.cwd(), "docs", "m2.1", "HUMAN_REVIEW_CHECKLIST.md");
  if (existsSync(checklistPath)) {
    writeFileSync(join(directory, "HUMAN_REVIEW_CHECKLIST.md"), readFileSync(checklistPath, "utf8"), "utf8");
  }

  const liveSafeIds = new Set(LIVE_SAFE_PHRASES.map((item) => item.id));
  writeFileSync(join(directory, "PHRASE_REGISTRY_REVIEW.md"), [
    "# Phrase Registry Review List",
    "",
    "| Phrase ID | Canonical | Level | Active | liveSafe | Bilingual Frames |",
    "|---|---|---:|---|---|---:|",
    ...PHRASE_REGISTRY.map((item) =>
      `| ${item.id} | ${item.canonical} | ${item.level} | ${item.status === "active"} | ${liveSafeIds.has(item.id)} | ${item.bilingualPatterns.length} |`,
    ),
    "",
  ].join("\n"), "utf8");

  const englishRecords = corpus.filter((record) => (record.englishChunks?.length ?? 0) > 0);
  writeFileSync(join(directory, "ENGLISH_CHUNKS.md"), [
    "# Displayed English Chunks",
    "",
    ...englishRecords.flatMap((record) =>
      record.englishChunks?.map((chunk) => `- ${record.id}: ${chunk} (${record.selectedPhraseId ?? "unknown"})`) ?? [],
    ),
    "",
  ].join("\n"), "utf8");

  const noFitRecords = corpus.filter((record) => record.noFit);
  writeFileSync(join(directory, "NO_FIT_CASES.md"), [
    "# Provider noFit Cases",
    "",
    ...noFitRecords.map((record) => `- ${record.id}: ${markdownCell(record.plainText)}`),
    "",
  ].join("\n"), "utf8");

  writeFileSync(join(directory, "REVIEW_INDEX.md"), [
    "# M2 Final Independent Human Review Index",
    "",
    "- Technical status: `M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING`",
    "- Independent Human Review: `PENDING`",
    "- M3: not started",
    "- Adaptive Progression: disabled",
    "",
    "Review in this order:",
    "",
    "1. [20-case Live Corpus](./LIVE_CORPUS_20.md)",
    "2. [45-case Naturalness Benchmark](./NATURALNESS_BENCHMARK_45.md)",
    "3. [Human Review Checklist](./HUMAN_REVIEW_CHECKLIST.md)",
    "4. [Phrase Registry active/liveSafe list](./PHRASE_REGISTRY_REVIEW.md)",
    "5. [Displayed English Chunks](./ENGLISH_CHUNKS.md)",
    "6. [Provider noFit Cases](./NO_FIT_CASES.md)",
    "",
    "Do not mark this review PASS without an independent human reading the actual outputs.",
    "",
  ].join("\n"), "utf8");
}

function ratio(passed: number, total: number): number {
  return total > 0 ? passed / total : 0;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function finalPipelineRates(records: CaseRecord[]) {
  const finalAttempts = records.map((record) => record.attempts.at(-1)).filter((attempt) => attempt !== undefined);
  const reachedRate = (key: "mapper" | "domainSchema" | "domainValidator") => {
    const reached = finalAttempts.filter((attempt) => attempt.pipeline?.[key] !== "not_reached");
    return {
      passed: reached.filter((attempt) => attempt.pipeline?.[key] === "passed").length,
      total: reached.length,
      rate: ratio(reached.filter((attempt) => attempt.pipeline?.[key] === "passed").length, reached.length),
    };
  };
  return {
    templateParse: {
      passed: finalAttempts.filter((attempt) => attempt.pipeline?.templateParse === "passed").length,
      total: finalAttempts.length,
      rate: ratio(finalAttempts.filter((attempt) => attempt.pipeline?.templateParse === "passed").length, finalAttempts.length),
    },
    placeholderContract: {
      passed: finalAttempts.filter((attempt) => attempt.pipeline?.templateSemantics === "passed").length,
      total: finalAttempts.length,
      rate: ratio(finalAttempts.filter((attempt) => attempt.pipeline?.templateSemantics === "passed").length, finalAttempts.length),
    },
    mapper: reachedRate("mapper"),
    domainSchema: reachedRate("domainSchema"),
    domainValidator: reachedRate("domainValidator"),
  };
}

function renderFinalVerificationReport(status: string, records: CaseRecord[]): string {
  const successful = records.filter((record) => record.status === "PASS");
  const retries = records.reduce((sum, record) => sum + Math.max(0, record.attempts.length - 1), 0);
  const rates = finalPipelineRates(records);
  const prior = priorGateEvidence();
  const providerGroups = [...new Set(records.map((record) => record.routedProvider).filter(Boolean))].map((provider) => {
    const group = records.filter((record) => record.routedProvider === provider);
    return {
      provider: provider!,
      model: group[0]?.routedModel ?? "unknown",
      passed: group.filter((record) => record.status === "PASS").length,
      total: group.length,
      rate: ratio(group.filter((record) => record.status === "PASS").length, group.length),
    };
  });
  const violationCodes = [...new Set(records.flatMap((record) =>
    record.attempts.flatMap((attempt) => attempt.validation.violations.map((violation) => violation.code)),
  ))].sort();
  const positions = records.reduce<Record<string, number>>((accumulator, record) => {
    if (record.phrasePosition) accumulator[record.phrasePosition] = (accumulator[record.phrasePosition] ?? 0) + 1;
    return accumulator;
  }, {});
  return [
    "# M2 Final Live Corpus Verification Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Run ID: \`${runId}\``,
    `- Starting HEAD: \`2a5abd90b08a12b87ad2e954ebc7a13ba7d666c1\``,
    `- Final Status: \`${status}\``,
    "- Scope: original 20-case Live Corpus only, original order and Provider routing",
    "- Budget correction: 20 Corpus scenarios are distinct from Provider HTTP requests; two attempts per scenario permit at most 40 requests.",
    `- Corpus Executed: ${records.length}/20`,
    `- Final Structured Response Success: ${successful.length}/${records.length} (${percent(ratio(successful.length, records.length))})`,
    `- Provider HTTP Requests: ${ledger.totals.requests}/${REQUEST_LIMIT}`,
    `- Validator Retries: ${retries}`,
    `- Provider Tokens: ${ledger.totals.tokens}/${TOKEN_LIMIT}`,
    `- Provider Runtime: ${ledger.totals.providerRuntimeMs}/${PROVIDER_RUNTIME_LIMIT_MS} ms`,
    `- Provider Rates: ${providerGroups.map((group) => `${group.provider}/${group.model}=${group.passed}/${group.total} (${percent(group.rate)})`).join(", ")}`,
    `- Provider noFit Count: ${successful.filter((record) => record.noFit).length}`,
    `- English Chunk Count: ${successful.filter((record) => (record.englishChunks?.length ?? 0) > 0).length}`,
    `- Natural Fallback Count: ${records.filter((record) => record.naturalFallback).length}`,
    `- Template Final Parse Rate: ${rates.templateParse.passed}/${rates.templateParse.total} (${percent(rates.templateParse.rate)})`,
    `- Placeholder Contract Final Rate: ${rates.placeholderContract.passed}/${rates.placeholderContract.total} (${percent(rates.placeholderContract.rate)})`,
    `- Mapper Reached Success Rate: ${rates.mapper.passed}/${rates.mapper.total} (${percent(rates.mapper.rate)})`,
    `- Domain Schema Reached Success Rate: ${rates.domainSchema.passed}/${rates.domainSchema.total} (${percent(rates.domainSchema.rate)})`,
    `- Domain Validator Reached Success Rate: ${rates.domainValidator.passed}/${rates.domainValidator.total} (${percent(rates.domainValidator.rate)})`,
    `- Violation Codes Observed: ${violationCodes.join(", ") || "none"}`,
    `- Final Outcomes: ${JSON.stringify(records.reduce<Record<string, number>>((counts, record) => { const key = record.finalOutcome ?? "not_executed"; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {}))}`,
    `- Phrase Position Distribution: ${JSON.stringify(positions)}`,
    `- Budget Stop: ${budgetStopReason ?? "no"}`,
    `- Security Stop: ${securityStopReason ?? "no"}`,
    `- Capability Probe: PRIOR_UNCHANGED_EVIDENCE — ${prior.capability ? "6/6 PASS" : "not proven"}`,
    `- Fallback Probe: PRIOR_UNCHANGED_EVIDENCE — ${prior.fallback ? "PASS" : "not proven"}`,
    "- No-quota Gate: PRIOR_UNCHANGED_EVIDENCE for the earlier result; re-executed in this task before Live.",
    "- M3: not started",
    "- Adaptive Progression: not started",
    "- Independent Human Review: PENDING",
    "- Secrets, full Directives, private paths, private image bytes, and private user content: not recorded",
    "",
    "## Per-case final results",
    "",
    "| Case | User Input | Routed Provider / Model | Function | Selected / Candidates | noFit / Reason | English Chunk / Position | Attempts | Final Outcome | Natural Fallback | Latency | Tokens | Final Text |",
    "|---|---|---|---|---|---|---|---:|---|---|---:|---:|---|",
    ...records.map((record) => `| ${record.id} | ${markdownCell(record.userMessage)} | ${record.routedProvider} / ${record.routedModel} | ${record.conversationFunction ?? "n/a"} | ${record.selectedPhraseId ?? "none"} / ${record.candidatePhraseIds?.join(", ") || "none"} | ${record.noFit ?? "n/a"} / ${record.noFitReason ?? "none"} | ${markdownCell(record.englishChunks?.join(", ") || "none")} / ${record.phrasePosition ?? "none"} | ${record.attempts.length} | ${record.finalOutcome ?? "not_executed"} | ${record.naturalFallback} | ${record.latencyMs ?? "n/a"} | ${record.usage?.totalTokens ?? "n/a"} | ${markdownCell(record.plainText)} |`),
    "",
    "## Per-attempt pipeline",
    "",
    "| Case | Attempt | Provider / Model | Outcome | Violations | Template Parse | Placeholder Contract | Template Validator | Mapper | Domain Schema | Domain Validator | Naturalness Gate | Latency | Tokens |",
    "|---|---:|---|---|---|---|---|---|---|---|---|---|---:|---:|",
    ...records.flatMap((record) => record.attempts.map((attempt) => `| ${record.id} | ${attempt.attemptNumber} | ${attempt.providerId} / ${attempt.modelId} | ${attempt.outcome} | ${attempt.validation.violations.map((violation) => violation.code).join(", ") || "none"} | ${attempt.pipeline?.templateParse ?? "not_reached"} | ${attempt.pipeline?.templateSemantics ?? "not_reached"} | ${attempt.pipeline?.templateValidator ?? "not_reached"} | ${attempt.pipeline?.mapper ?? "not_reached"} | ${attempt.pipeline?.domainSchema ?? "not_reached"} | ${attempt.pipeline?.domainValidator ?? "not_reached"} | ${attempt.naturalness ? `${attempt.naturalness.suggestedAction}/${attempt.naturalness.confidence}` : "not_reached"} | ${attempt.latencyMs} | ${attempt.usage?.totalTokens ?? "n/a"} |`)),
    "",
    "## Failures",
    "",
    ...records.filter((record) => record.status === "FAIL").map((record) => `- ${record.id}: ${record.failures.join("; ")}`),
    ...(records.every((record) => record.status === "PASS") ? ["- none"] : []),
    "",
    "## Redacted capture index",
    "",
    "```json",
    JSON.stringify(records.flatMap((record) => record.rawCaptures), null, 2),
    "```",
    "",
  ].join("\n");
}

function writeFinalVerificationReport(status: string, records: CaseRecord[]): void {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(
    join(reportDirectory, "m2-final-live-corpus-report.md"),
    renderFinalVerificationReport(status, records),
    "utf8",
  );
}

function noFitContext(record: CaseRecord): string {
  if (/只用中文|不要英文/u.test(record.userMessage ?? "")) return "explicit_chinese_request";
  if (record.sensitivity === "high_stakes") return "high_stakes";
  if (record.sensitivity === "emotional") return "emotional";
  if (record.sensitivity === "technical") return "technical_complexity";
  return "naturalness_or_context_fit";
}

function writeFinalHumanReviewPackage(records: CaseRecord[]): void {
  const directory = join(process.cwd(), "artifacts", "human-review", "m2-final");
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "LIVE_CORPUS_REVIEW.md"), [
    "# Live Corpus Review",
    "",
    "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
    "",
    "| Case | User Input | Provider / Model | Function | Selected Phrase | Final Text | noFit / Reason | English Chunk | Position | Attempts | Validator | Natural Fallback | Latency | Tokens |",
    "|---|---|---|---|---|---|---|---|---|---:|---|---|---:|---:|",
    ...records.map((record) => `| ${record.id} | ${markdownCell(record.userMessage)} | ${record.routedProvider} / ${record.routedModel} | ${record.conversationFunction} | ${record.selectedPhraseId ?? "none"} | ${markdownCell(record.plainText)} | ${record.noFit} / ${record.noFitReason ?? "none"} | ${markdownCell(record.englishChunks?.join(", ") || "none")} | ${record.phrasePosition ?? "none"} | ${record.attempts.length} | ${record.status} | ${record.naturalFallback} | ${record.latencyMs} | ${record.usage?.totalTokens} |`),
    "",
  ].join("\n"), "utf8");

  const naturalnessPath = join(reportDirectory, "m2.3-naturalness-report.md");
  writeFileSync(
    join(directory, "NATURALNESS_BENCHMARK_REVIEW.md"),
    existsSync(naturalnessPath)
      ? readFileSync(naturalnessPath, "utf8")
      : "# Naturalness Benchmark Review\n\nExpected 45-case report was not found.\n",
    "utf8",
  );

  const phraseRecords = records.filter((record) => (record.englishChunks?.length ?? 0) > 0);
  const phraseIds = [...new Set(phraseRecords.map((record) => record.selectedPhraseId).filter(Boolean))];
  const liveSafeIds = new Set(LIVE_SAFE_PHRASES.map((phrase) => phrase.id));
  writeFileSync(join(directory, "PHRASE_USAGE_SUMMARY.md"), [
    "# Phrase Usage Summary",
    "",
    `- Active Phrase count: ${PHRASE_REGISTRY.filter((phrase) => phrase.status === "active").length}`,
    `- Live-Safe Phrase count: ${LIVE_SAFE_PHRASES.length}`,
    "",
    "| Phrase ID | Canonical | Count | Positions | Providers | Cases | Plain Text Projections |",
    "|---|---|---:|---|---|---|---|",
    ...phraseIds.map((phraseId) => {
      const uses = phraseRecords.filter((record) => record.selectedPhraseId === phraseId);
      const phrase = PHRASE_REGISTRY.find((item) => item.id === phraseId);
      return `| ${phraseId} | ${phrase?.canonical ?? "unknown"} | ${uses.length} | ${[...new Set(uses.map((record) => record.phrasePosition))].join(", ")} | ${[...new Set(uses.map((record) => record.routedProvider))].join(", ")} | ${uses.map((record) => record.id).join(", ")} | ${markdownCell(uses.map((record) => record.plainText).join(" / "))} |`;
    }),
    "",
    "## Active / Live-Safe registry reference",
    "",
    "| Phrase ID | Canonical | Active | Live-Safe |",
    "|---|---|---|---|",
    ...PHRASE_REGISTRY.map((phrase) => `| ${phrase.id} | ${phrase.canonical} | ${phrase.status === "active"} | ${liveSafeIds.has(phrase.id)} |`),
    "",
  ].join("\n"), "utf8");

  const noFitRecords = records.filter((record) => record.noFit && record.status === "PASS");
  writeFileSync(join(directory, "NO_FIT_SUMMARY.md"), [
    "# noFit Summary",
    "",
    "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
    "",
    "| Case | User Input | Candidate Phrases | noFitReason | Final Answer | Complete Answer? | Context |",
    "|---|---|---|---|---|---|---|",
    ...noFitRecords.map((record) => `| ${record.id} | ${markdownCell(record.userMessage)} | ${record.candidatePhraseIds?.join(", ") || "none"} | ${record.noFitReason ?? "none"} | ${markdownCell(record.plainText)} | PENDING_HUMAN_REVIEW | ${noFitContext(record)} |`),
    "",
  ].join("\n"), "utf8");

  writeFileSync(join(directory, "REVIEW_CHECKLIST.md"), [
    "# Independent Human Review Checklist",
    "",
    "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
    "",
    "Do not mark a row PASS without reading its actual input and final output in `LIVE_CORPUS_REVIEW.md`.",
    "",
    "| Case | Complete answer | Natural English | Not label-like | No repeated translation | Natural boundary | Phrase fits context | Should noFit | noFit too conservative | Not Teacher Mode | Overall acceptable | Notes |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...records.map((record) => `| ${record.id} | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |`),
    "",
  ].join("\n"), "utf8");

  writeFileSync(join(directory, "REVIEW_INDEX.md"), [
    "# M2 Final Independent Human Review",
    "",
    "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`",
    "",
    "## Product goal",
    "",
    "EOE Chat should remain an ordinary Chinese-first assistant while offering only natural, traceable English Overlay opportunities.",
    "",
    "## Review scope and technical gate",
    "",
    "Review the original 20-case Live Corpus, the 45-case Naturalness Benchmark, displayed Phrase use, and Provider noFit decisions. Technical gate status: `M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING`.",
    "",
    "## Files",
    "",
    "1. [Live Corpus](./LIVE_CORPUS_REVIEW.md)",
    "2. [Naturalness Benchmark](./NATURALNESS_BENCHMARK_REVIEW.md)",
    "3. [Phrase Usage Summary](./PHRASE_USAGE_SUMMARY.md)",
    "4. [noFit Summary](./NO_FIT_SUMMARY.md)",
    "5. [Review Checklist](./REVIEW_CHECKLIST.md)",
    "",
    "## Known limitations",
    "",
    "- Technical validity does not establish conversational naturalness; independent reading is still required.",
    "- M2 uses fixed Progression Level and does not implement Adaptive Progression or Mastery.",
    "- noFit completeness and conservatism require human judgment.",
    "",
  ].join("\n"), "utf8");
}

function corpusSpecs(): CaseSpec[] {
  const ids = [
    "daily-weekend", "simple-opinion-remote", "complex-opinion-ai", "plan-study", "advice-choice",
    "emotional-pressure", "serious-medical", "serious-legal", "technical-api", "technical-cache",
    "technical-typescript", "technical-deploy", "finance-budget", "image-overview", "short-ok",
    "long-analysis", "user-english-opinion", "chinese-only-explain", "ask-phrase-clarify", "no-fit-minimal",
  ];
  const scenarios = ids.map((id) => GOLDEN_CONVERSATION_CORPUS.find((item) => item.id === id)!);
  expect(scenarios.every(Boolean)).toBe(true);
  return scenarios.map((scenario: GoldenScenario, index) => {
    const target = scenario.hasImage ? vision : index % 2 === 0 ? glm : deepSeek;
    const noFitExpected = ["chinese-only-explain", "no-fit-minimal", "short-ok"].includes(scenario.id);
    return {
      id: `corpus-${scenario.id}`,
      kind: "corpus",
      providerLabel: target.id,
      provider: target,
      message: scenario.userMessage,
      fixedLevel: scenario.fixedLevel ?? 2,
      expectedResult: noFitExpected ? "no_fit" : "valid",
      expectedFunction: scenario.expectedFunction,
      recentExposurePhraseIds: scenario.recentExposurePhraseIds,
      attachment: scenario.hasImage ? image : undefined,
    };
  });
}

function m232ProgressiveCorpusSpecs(): CaseSpec[] {
  const specs = corpusSpecs();
  const byScenarioId = new Map(specs.map((spec) => [spec.id.replace(/^corpus-/u, ""), spec]));
  const deepSeekIds = [
    "long-analysis",
    "plan-study",
    "no-fit-minimal",
    "simple-opinion-remote",
    "emotional-pressure",
    "serious-legal",
    "technical-cache",
    "technical-deploy",
    "chinese-only-explain",
  ];
  const progressive = deepSeekIds.map((id) => byScenarioId.get(id)!);
  const remaining = specs.filter((spec) => !deepSeekIds.includes(spec.id.replace(/^corpus-/u, "")));
  expect(progressive.every((spec) => spec?.provider.id === "deepseek")).toBe(true);
  expect(new Set([...progressive, ...remaining].map((spec) => spec.id)).size).toBe(20);
  return [...progressive, ...remaining];
}

live(
  finalVerification
    ? "M2 Final Verification Live Corpus gate"
    : m232
      ? "M2.3.2 progressive boundary closure gate"
      : "M2.3.1 Live capability gate",
  () => {
  it(
    finalVerification
      ? "runs the original 20-case Corpus in original order and routing"
      : m232
        ? "runs the cumulative 1/3/9/20 Corpus gate"
        : "runs 6 capability probes, then conditionally fallback and 20-case Corpus",
    async () => {
    if (finalVerification) {
      const records: CaseRecord[] = [];
      for (const spec of corpusSpecs()) {
        records.push(await runCase(spec));
        if (budgetStopReason || securityStopReason) break;
      }
      const rates = finalPipelineRates(records);
      const prior = priorGateEvidence();
      const providerGroups = [...new Set(records.map((record) => record.routedProvider).filter(Boolean))].map((provider) => {
        const group = records.filter((record) => record.routedProvider === provider);
        return { provider, rate: ratio(group.filter((record) => record.status === "PASS").length, group.length) };
      });
      const successRate = ratio(records.filter((record) => record.status === "PASS").length, records.length);
      const technicalPass =
        records.length === 20 &&
        successRate >= 0.95 &&
        providerGroups.length === 3 &&
        providerGroups.every((group) => group.rate >= 0.9) &&
        records.every((record) => record.finalOutcome !== "budget_or_security_blocked") &&
        records.every((record) => record.attempts.length >= 1 && record.attempts.length <= 2) &&
        rates.templateParse.rate === 1 &&
        rates.placeholderContract.rate === 1 &&
        rates.mapper.rate === 1 &&
        rates.domainSchema.rate === 1 &&
        rates.domainValidator.rate === 1 &&
        prior.capability &&
        prior.fallback &&
        !budgetStopReason &&
        !securityStopReason;
      const status = technicalPass
        ? "M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING"
        : "M2_FINAL_VERIFICATION_FAIL";
      writeFinalVerificationReport(status, records);
      if (technicalPass) writeFinalHumanReviewPackage(records);
      expect(technicalPass, "M2 final 20-case Live Corpus gate failed").toBe(true);
      return;
    }

    if (m232) {
      const records: CaseRecord[] = [];
      const specs = m232ProgressiveCorpusSpecs();
      const stageEnds = new Set([1, 3, 9, 20]);
      for (const spec of specs) {
        const record = await runCase(spec);
        records.push(record);
        const atStageEnd = stageEnds.has(records.length);
        const stageFailed = record.status === "FAIL" || Boolean(budgetStopReason) || Boolean(securityStopReason);
        if (atStageEnd) {
          const interimStatus = stageFailed
            ? "M2_3_2_STOPPED_WITH_BLOCKER"
            : records.length === 20
              ? "M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING"
              : `M2_3_2_STAGE_${records.length === 1 ? 1 : records.length === 3 ? 2 : 3}_PASS`;
          writeReport(interimStatus, records, false, records.length === 20);
        }
        if (stageFailed) {
          writeReport("M2_3_2_STOPPED_WITH_BLOCKER", records, false, false);
          expect(record.status, `M2.3.2 stopped at ${record.id}: ${record.failures.join("; ")}`).toBe("PASS");
          return;
        }
      }

      const corpus = records.filter((record) => record.kind === "corpus");
      const deepSeekCorpus = corpus.slice(0, 9);
      const providerGroups = [...new Set(corpus.map((record) => record.provider))].map((provider) => {
        const group = corpus.filter((record) => record.provider === provider);
        return { provider, count: group.length, rate: group.filter((record) => record.status === "PASS").length / group.length };
      });
      const prior = priorGateEvidence();
      const technicalPass =
        corpus.length === 20 &&
        corpus.filter((record) => record.status === "PASS").length / corpus.length >= 0.95 &&
        deepSeekCorpus.length === 9 &&
        deepSeekCorpus.every((record) => record.provider === "deepseek" && record.status === "PASS") &&
        providerGroups.every((group) => group.rate >= 0.9) &&
        corpus.every((record) => !record.naturalFallback) &&
        prior.capability &&
        prior.fallback &&
        !budgetStopReason &&
        !securityStopReason;
      const status = technicalPass
        ? "M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING"
        : "M2_3_2_STOPPED_WITH_BLOCKER";
      writeReport(status, records, false, true);
      if (technicalPass) writeHumanReviewPackage(records);
      expect(technicalPass, "M2.3.2 progressive 1/3/9/20 gate failed").toBe(true);
      return;
    }

    const noFitMessage = "只用中文，简短回复：收到。";
    const textEnglishMessage = "我正在安排下一步计划，请给我三个简洁、可执行的步骤。";
    const visionEnglishMessage = "请仔细分析图片中的主要内容，并说明为了确认细节下一步应该怎么看。";
    const probes: CaseSpec[] = [
      { id: "glm-text-no-fit", kind: "capability_probe", providerLabel: "GLM", provider: glm, message: noFitMessage, fixedLevel: 2, expectedResult: "no_fit" },
      { id: "glm-text-english", kind: "capability_probe", providerLabel: "GLM", provider: glm, message: textEnglishMessage, fixedLevel: 2, expectedResult: "english_chunk" },
      { id: "glm-vision-no-fit", kind: "capability_probe", providerLabel: "GLM Vision", provider: vision, message: noFitMessage, fixedLevel: 2, expectedResult: "no_fit", attachment: image },
      { id: "glm-vision-english", kind: "capability_probe", providerLabel: "GLM Vision", provider: vision, message: visionEnglishMessage, fixedLevel: 2, expectedResult: "english_chunk", attachment: image },
      { id: "deepseek-text-no-fit", kind: "capability_probe", providerLabel: "DeepSeek", provider: deepSeek, message: noFitMessage, fixedLevel: 2, expectedResult: "no_fit" },
      { id: "deepseek-text-english", kind: "capability_probe", providerLabel: "DeepSeek", provider: deepSeek, message: textEnglishMessage, fixedLevel: 2, expectedResult: "english_chunk" },
    ];
    const records: CaseRecord[] = [];
    for (const probe of probes) {
      records.push(await runCase(probe));
      if (budgetStopReason || securityStopReason) break;
    }
    if (securityStopReason) {
      writeReport("M2_AUTONOMOUS_STOPPED_FOR_SECURITY", records, false, false);
      expect(securityStopReason, "security stop").toBeUndefined();
      return;
    }
    if (budgetStopReason || records.length !== 6 || records.some((record) => record.status === "FAIL")) {
      writeReport(budgetStopReason ? "M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS" : "LIVE_CAPABILITY_PROBE_FAIL", records, false, false);
      expect(records.filter((record) => record.status === "PASS").length, "6/6 capability gate failed").toBe(6);
      return;
    }

    const unavailablePrimary: Provider = {
      id: "controlled-glm",
      modelId: "controlled-glm-retryable-error",
      capabilities: deepSeek.capabilities,
      async generate() {
        throw new ProviderError("controlled retryable GLM failure", "provider_unavailable", true, 503);
      },
    };
    const fallbackSpec: CaseSpec = {
      id: "glm-to-deepseek-provider-fallback",
      kind: "fallback_probe",
      providerLabel: "DeepSeek fallback",
      provider: deepSeek,
      message: textEnglishMessage,
      fixedLevel: 2,
      expectedResult: "valid",
    };
    const fallbackGateway = new ProviderGateway({ primary: unavailablePrimary, vision, fallback: deepSeek, mock, forceMock: false });
    const fallbackRecord = await runCase(fallbackSpec, fallbackGateway);
    if (!fallbackRecord.providerFallback || fallbackRecord.provider !== "deepseek") {
      fallbackRecord.status = "FAIL";
      fallbackRecord.failures.push("GLM retryable -> DeepSeek Provider fallback path was not proven");
    }
    records.push(fallbackRecord);
    if (fallbackRecord.status === "FAIL" || budgetStopReason || securityStopReason) {
      writeReport(securityStopReason ? "M2_AUTONOMOUS_STOPPED_FOR_SECURITY" : budgetStopReason ? "M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS" : "LIVE_FALLBACK_PROBE_FAIL", records, true, false);
      expect(fallbackRecord.status, "separate Provider fallback probe failed").toBe("PASS");
      return;
    }

    for (const spec of corpusSpecs()) {
      records.push(await runCase(spec));
      if (budgetStopReason || securityStopReason) break;
    }
    const corpus = records.filter((record) => record.kind === "corpus");
    const providerGroups = [...new Set(corpus.map((record) => record.provider))].map((provider) => {
      const group = corpus.filter((record) => record.provider === provider);
      return { provider, rate: group.filter((record) => record.status === "PASS").length / group.length };
    });
    const corpusRate = corpus.length === 20
      ? corpus.filter((record) => record.status === "PASS").length / corpus.length
      : 0;
    const technicalPass =
      !budgetStopReason &&
      !securityStopReason &&
      corpusRate >= 0.95 &&
      providerGroups.every((group) => group.rate >= 0.9);
    const status = securityStopReason
      ? "M2_AUTONOMOUS_STOPPED_FOR_SECURITY"
      : budgetStopReason
        ? "M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS"
        : technicalPass
          ? "M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING"
          : "LIVE_CORPUS_FAIL";
    writeReport(status, records, true, true);
    expect(technicalPass, "20-case corpus or per-Provider threshold failed").toBe(true);
  }, 90 * 60_000);
});
