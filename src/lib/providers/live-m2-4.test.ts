import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { segmentsToPlainText, type ChatRequest, type MessageSegment, type WireAttachment } from "@/domain/chat";
import type { Provider } from "@/lib/providers/types";
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
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { ProviderError, type ProviderRequest, type ProviderResult } from "./types";

const enabled = process.env.EOE_M2_4_LIVE === "true" &&
  Boolean(process.env.GLM_API_KEY?.trim() && process.env.DEEPSEEK_API_KEY?.trim()) &&
  process.env.USE_MOCK_PROVIDER === "false";
const live = enabled ? describe : describe.skip;
const timeoutMs = Number(process.env.PROVIDER_TIMEOUT_MS ?? 60_000);
const repairCycle = Number(process.env.EOE_M2_4_REPAIR_CYCLE ?? "1");

const limits = { requests: 80, tokens: 100_000, providerRuntimeMs: 90 * 60_000 };
type BudgetLedger = {
  schemaVersion: "m2.4-live-budget.v1";
  runId: string;
  limits: typeof limits;
  totals: { requests: number; tokens: number; providerRuntimeMs: number };
  events: Array<{
    repairCycle: number;
    caseId: string;
    providerId: string;
    modelId: string;
    attemptNumber: number;
    latencyMs: number;
    tokens: number;
    outcome: "success" | "error";
  }>;
};

const reportDirectory = join(process.cwd(), "artifacts", "benchmarks");
const budgetPath = join(reportDirectory, "m2.4-live-budget.json");
const freshRunId = `m2-4-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
const freshLedger: BudgetLedger = {
  schemaVersion: "m2.4-live-budget.v1" as const,
  runId: freshRunId,
  limits,
  totals: { requests: 0, tokens: 0, providerRuntimeMs: 0 },
  events: [],
};
const ledger: BudgetLedger = repairCycle === 2 && existsSync(budgetPath)
  ? JSON.parse(readFileSync(budgetPath, "utf8")) as BudgetLedger
  : freshLedger;
const runId = ledger.runId;

const reviewDirectory = join(process.cwd(), "artifacts", "human-review", "m2.4");
let activeCaseId = "unassigned";
let budgetStop: string | undefined;

function saveLedger(): void {
  mkdirSync(reportDirectory, { recursive: true });
  writeFileSync(budgetPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

function assertBudget(): void {
  const reasons = [
    ledger.totals.requests >= limits.requests ? `requests=${ledger.totals.requests}/${limits.requests}` : undefined,
    ledger.totals.tokens >= limits.tokens ? `tokens=${ledger.totals.tokens}/${limits.tokens}` : undefined,
    ledger.totals.providerRuntimeMs >= limits.providerRuntimeMs
      ? `runtime=${ledger.totals.providerRuntimeMs}/${limits.providerRuntimeMs}`
      : undefined,
  ].filter(Boolean);
  if (reasons.length > 0) {
    budgetStop = reasons.join("; ");
    throw new ProviderError(`M2.4 live budget exhausted: ${budgetStop}`, "invalid_request", false, 400);
  }
}

class BudgetedProvider implements Provider {
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
    ledger.totals.requests += 1;
    const started = performance.now();
    try {
      const result = await this.delegate.generate(request);
      const latencyMs = Math.round(performance.now() - started);
      const tokens = result.usage?.totalTokens ?? 0;
      ledger.totals.tokens += tokens;
      ledger.totals.providerRuntimeMs += latencyMs;
      ledger.events.push({
        repairCycle,
        caseId: activeCaseId,
        providerId: this.id,
        modelId: this.modelId,
        attemptNumber: request.generationAttempt ?? 1,
        latencyMs,
        tokens,
        outcome: "success",
      });
      saveLedger();
      return result;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      ledger.totals.providerRuntimeMs += latencyMs;
      ledger.events.push({
        repairCycle,
        caseId: activeCaseId,
        providerId: this.id,
        modelId: this.modelId,
        attemptNumber: request.generationAttempt ?? 1,
        latencyMs,
        tokens: 0,
        outcome: "error",
      });
      saveLedger();
      throw error;
    }
  }
}

function provider(options: { id: string; modelId: string; apiKey: string; baseUrl: string; vision?: boolean }): Provider {
  return new BudgetedProvider(new OpenAICompatibleProvider({
    id: options.id,
    modelId: options.modelId,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
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

type Group = "probe" | "core" | "opportunity" | "multi_turn" | "image_fixture";
type Expected = "english_chunk" | "no_fit" | "valid";

interface LiveCase {
  id: string;
  group: Group;
  provider: Provider;
  request: ChatRequest;
  fixedLevel: number;
  expected: Expected;
  imageFixture?: string;
  checks?: (result: EngineRunResult) => string[];
}

interface LiveRecord {
  id: string;
  group: Group;
  provider: string;
  model: string;
  status: "PASS" | "FAIL";
  failures: string[];
  userMessage: string;
  finalText: string;
  function: string;
  selectedPhrase?: string;
  candidatePhrases: string[];
  englishChunks: string[];
  noFit: boolean;
  noFitReason?: string;
  noFitSource?: string;
  taskComplete: boolean;
  missingObligations: string[];
  realizedPosition?: string;
  attempts: number;
  naturalFallback: boolean;
  latencyMs: number;
  tokens: number;
  imageFixture?: string;
  assistance?: EngineRunResult["diagnostics"]["assistance"];
}

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

function plainRequest(id: string, message: string, attachment?: WireAttachment): ChatRequest {
  return {
    conversationId: `m2-4-${id}`,
    messages: [{ id: `${id}-u1`, role: "user", content: message }],
    attachments: attachment ? [attachment] : [],
    engineState: { recentExposurePhraseIds: [], developerMode: true, benchmarkType: "live_evidence" },
  };
}

function assistantSegments(content: string, phraseId?: string): MessageSegment[] | undefined {
  if (!phraseId) return undefined;
  const phrase = getPhraseById(phraseId);
  if (!phrase) return undefined;
  const surfaces = [phrase.canonical, ...phrase.variants];
  const surface = surfaces.find((item) => content.toLocaleLowerCase().includes(item.toLocaleLowerCase()));
  if (!surface) return undefined;
  const index = content.toLocaleLowerCase().indexOf(surface.toLocaleLowerCase());
  const before = content.slice(0, index);
  const actual = content.slice(index, index + surface.length);
  const after = content.slice(index + surface.length);
  return [
    ...(before ? [{ type: "text" as const, content: before, language: /[\u3400-\u9fff]/u.test(before) ? "zh" as const : "other" as const }] : []),
    { type: "english_chunk" as const, content: actual, phraseId, isNew: false, assistanceAvailable: true },
    ...(after ? [{ type: "text" as const, content: after, language: /[\u3400-\u9fff]/u.test(after) ? "zh" as const : "other" as const }] : []),
  ];
}

function multiTurnRequest(scenario: M24MultiTurnScenario): ChatRequest {
  const messages: ChatRequest["messages"] = scenario.turns.map((turn, index) => ({
    id: `${scenario.id}-${index + 1}`,
    role: turn.role,
    content: turn.content,
    segments: turn.role === "assistant" ? assistantSegments(turn.content, turn.phraseId) : undefined,
  }));
  let assistanceRequest: NonNullable<NonNullable<ChatRequest["engineState"]>["assistanceRequest"]> | undefined;
  if (["meaning", "pronunciation", "click"].includes(scenario.id)) {
    const sourceIndex = [...scenario.turns].map((turn, index) => ({ turn, index })).reverse().find((item) => item.turn.phraseId)?.index;
    const source = sourceIndex === undefined ? undefined : scenario.turns[sourceIndex];
    if (sourceIndex !== undefined && source?.phraseId) {
      assistanceRequest = {
        trigger: scenario.id === "pronunciation" ? "pronunciation" : scenario.id === "click" ? "click" : "meaning",
        sourceMessageId: `${scenario.id}-${sourceIndex + 1}`,
        phraseId: source.phraseId,
        segmentIndex: assistantSegments(source.content, source.phraseId)?.findIndex((segment) => segment.type === "english_chunk"),
      };
    }
  }
  if (scenario.id === "click") {
    messages.push({ id: `${scenario.id}-click`, role: "user", content: "请简短解释刚才的英文短语，然后继续原来的话题。" });
  }
  return {
    conversationId: `m2-4-multi-${scenario.id}`,
    messages,
    attachments: [],
    engineState: { recentExposurePhraseIds: [], developerMode: true, benchmarkType: "live_evidence", assistanceRequest },
  };
}

async function runCase(spec: LiveCase): Promise<LiveRecord> {
  activeCaseId = spec.id;
  const gateway = new ProviderGateway({ primary: spec.provider, vision: spec.provider, mock, forceMock: false });
  try {
    const result = await runEoeEngine({
      request: spec.request,
      gateway,
      config: { enabled: true, fixedLevel: spec.fixedLevel, developerMode: true },
      naturalnessMode: "live",
    });
    const text = segmentsToPlainText(result.response.segments);
    const chunks = result.response.segments.filter((segment) => segment.type === "english_chunk");
    const failures = [
      result.diagnostics.finalValidation.valid ? undefined : "final Validator failed",
      result.diagnostics.taskCompleteness.complete ? undefined : `task incomplete: ${result.diagnostics.taskCompleteness.issues.join(", ")}`,
      result.diagnostics.naturalFallbackUsed ? "Natural Fallback used" : undefined,
      result.diagnostics.attempts.length < 1 || result.diagnostics.attempts.length > 2 ? "attempt count outside 1..2" : undefined,
      result.provider.modelId !== spec.provider.modelId ? `model mismatch: ${result.provider.modelId}` : undefined,
      spec.expected === "english_chunk" && chunks.length === 0 ? "expected English Chunk" : undefined,
      spec.expected === "no_fit" && !result.response.noFit ? "expected noFit" : undefined,
      result.response.noFit && !result.diagnostics.noFitReason ? "noFit reason missing" : undefined,
      ...((spec.checks?.(result) ?? []).map((item) => item || undefined)),
    ].filter((item): item is string => Boolean(item));
    return {
      id: spec.id,
      group: spec.group,
      provider: result.provider.providerId,
      model: result.provider.modelId,
      status: failures.length === 0 ? "PASS" : "FAIL",
      failures,
      userMessage: [...spec.request.messages].reverse().find((message) => message.role === "user")?.content ?? "click",
      finalText: text,
      function: result.diagnostics.analysis.primaryFunction,
      selectedPhrase: result.diagnostics.selection.selectedPhraseId,
      candidatePhrases: result.diagnostics.selection.candidates.map((item) => item.phraseId),
      englishChunks: chunks.map((segment) => segment.content),
      noFit: result.response.noFit,
      noFitReason: result.diagnostics.noFitReason,
      noFitSource: result.diagnostics.noFitDecisionSource,
      taskComplete: result.diagnostics.taskCompleteness.complete,
      missingObligations: result.diagnostics.taskCompleteness.missingObligationIds,
      realizedPosition: result.diagnostics.realizedPhrasePosition,
      attempts: result.diagnostics.attempts.length,
      naturalFallback: result.diagnostics.naturalFallbackUsed,
      latencyMs: result.provider.latencyMs,
      tokens: result.provider.usage?.totalTokens ?? 0,
      imageFixture: spec.imageFixture,
      assistance: result.diagnostics.assistance,
    };
  } catch (error) {
    return {
      id: spec.id,
      group: spec.group,
      provider: spec.provider.id,
      model: spec.provider.modelId,
      status: "FAIL",
      failures: [error instanceof Error ? error.message : "unknown live error"],
      userMessage: [...spec.request.messages].reverse().find((message) => message.role === "user")?.content ?? "click",
      finalText: "",
      function: "not_reached",
      candidatePhrases: [],
      englishChunks: [],
      noFit: false,
      taskComplete: false,
      missingObligations: [],
      attempts: 0,
      naturalFallback: false,
      latencyMs: 0,
      tokens: 0,
      imageFixture: spec.imageFixture,
    };
  }
}

function cell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/gu, "<br>");
}

function table(records: LiveRecord[]): string[] {
  return [
    "| Case | Provider / Model | Final Text | Phrase / Position | noFit / Source / Reason | Task | Attempts | Fallback | Tokens |",
    "|---|---|---|---|---|---|---:|---|---:|",
    ...records.map((record) => `| ${record.id} | ${record.provider} / ${record.model} | ${cell(record.finalText)} | ${record.selectedPhrase ?? "none"} / ${record.realizedPosition ?? "none"} | ${record.noFit} / ${record.noFitSource ?? "none"} / ${record.noFitReason ?? "none"} | ${record.taskComplete ? "complete" : cell(record.missingObligations.join(", "))} | ${record.attempts} | ${record.naturalFallback} | ${record.tokens} |`),
  ];
}

function writeReport(status: string, records: LiveRecord[]): void {
  mkdirSync(reportDirectory, { recursive: true });
  const noFitDistribution = records.reduce<Record<string, number>>((result, record) => {
    if (record.noFitReason) result[record.noFitReason] = (result[record.noFitReason] ?? 0) + 1;
    return result;
  }, {});
  const report = [
    "# M2.4 Live Provider Validation",
    "",
    `- Run ID: \`${runId}\``,
    `- Repair cycle: ${repairCycle}/2`,
    `- Status: \`${status}\``,
    `- Cases: ${records.filter((item) => item.status === "PASS").length}/${records.length}`,
    `- Requests: ${ledger.totals.requests}/${limits.requests}`,
    `- Tokens: ${ledger.totals.tokens}/${limits.tokens}`,
    `- Provider runtime: ${ledger.totals.providerRuntimeMs}/${limits.providerRuntimeMs} ms`,
    `- English Chunk cases: ${records.filter((item) => item.englishChunks.length > 0).length}`,
    `- noFit cases: ${records.filter((item) => item.noFit).length}`,
    `- noFitReason distribution: ${JSON.stringify(noFitDistribution)}`,
    `- Natural Fallback: ${records.filter((item) => item.naturalFallback).length}`,
    `- Budget stop: ${budgetStop ?? "no"}`,
    "- Independent Human Review: PENDING",
    "- M3: blocked; Adaptive Progression: disabled",
    "- Secrets, Authorization headers, full Directives, and image bytes are not recorded.",
    "",
    ...table(records),
    "",
    "## Failures",
    "",
    ...records.filter((item) => item.status === "FAIL").map((item) => `- ${item.id}: ${item.failures.join("; ")}`),
    ...(records.every((item) => item.status === "PASS") ? ["- none"] : []),
    "",
  ].join("\n");
  writeFileSync(join(reportDirectory, "m2.4-live-report.md"), report, "utf8");
  writeFileSync(join(reportDirectory, `m2.4-live-cycle-${repairCycle}.md`), report, "utf8");
}

function writeReviewPackage(records: LiveRecord[]): void {
  mkdirSync(reviewDirectory, { recursive: true });
  const byGroup = (group: Group) => records.filter((item) => item.group === group);
  const write = (name: string, title: string, body: string[]) => writeFileSync(
    join(reviewDirectory, name),
    [`# ${title}`, "", "Status: `PENDING_INDEPENDENT_HUMAN_REVIEW`", "", ...body, ""].join("\n"),
    "utf8",
  );
  write("CORE_CORPUS_REVIEW.md", "Core Corpus Review", table(byGroup("core")));
  write("NATURAL_OVERLAY_REVIEW.md", "Natural Overlay Opportunity Review", table(byGroup("opportunity")));
  write("MULTI_TURN_REVIEW.md", "Multi-Turn Review", table(byGroup("multi_turn")));
  write("TASK_COMPLETENESS_REVIEW.md", "Task Completeness Review", [
    "| Case | Complete | Missing Obligations | Failures |",
    "|---|---|---|---|",
    ...records.map((item) => `| ${item.id} | ${item.taskComplete} | ${cell(item.missingObligations.join(", ") || "none")} | ${cell(item.failures.join("; ") || "none")} |`),
  ]);
  const phraseRecords = records.filter((item) => item.englishChunks.length > 0);
  write("PHRASE_USAGE_REVIEW.md", "Phrase Usage Review", [
    "| Case | Phrase | Surface | Position | Final Text |",
    "|---|---|---|---|---|",
    ...phraseRecords.map((item) => `| ${item.id} | ${item.selectedPhrase} | ${cell(item.englishChunks.join(", "))} | ${item.realizedPosition} | ${cell(item.finalText)} |`),
  ]);
  write("NO_FIT_REVIEW.md", "noFit Review", [
    "| Case | Source | Reason | Candidate Pool | Complete Final Text |",
    "|---|---|---|---|---|",
    ...records.filter((item) => item.noFit).map((item) => `| ${item.id} | ${item.noFitSource} | ${item.noFitReason} | ${cell(item.candidatePhrases.join(", ") || "none")} | ${cell(item.finalText)} |`),
  ]);
  write("IMAGE_ANALYSIS_REVIEW.md", "Image Analysis Review", table(records.filter((item) => item.imageFixture)));
  write("VOCABULARY_ASSISTANCE_REVIEW.md", "Vocabulary Assistance Review", table(byGroup("multi_turn").filter((item) => item.assistance)));
  write("INDEPENDENT_REVIEW_CHECKLIST.md", "Independent Review Checklist", [
    "Do not pre-fill PASS. Read every actual final text first.",
    "",
    "- [ ] Core20 has zero major task-completeness failures.",
    "- [ ] At least 80% of displayed English Chunks are independently judged natural.",
    "- [ ] No Phrase replaces the core answer.",
    "- [ ] No label-like Overlay or repeated translation appears.",
    "- [ ] noFit is appropriately conservative without avoiding obvious opportunities.",
    "- [ ] Vocabulary Assistance uses real context and resumes the topic.",
    "- [ ] Image answers cite visible evidence and separate inference/uncertainty.",
    "- [ ] Overall result: ____________________",
  ]);
  write("REVIEW_INDEX.md", "M2.4 Independent Human Review", [
    "Technical package only. Codex has not declared naturalness PASS.",
    "",
    "1. [Core Corpus](./CORE_CORPUS_REVIEW.md)",
    "2. [Natural Overlay Opportunities](./NATURAL_OVERLAY_REVIEW.md)",
    "3. [Multi-Turn](./MULTI_TURN_REVIEW.md)",
    "4. [Task Completeness](./TASK_COMPLETENESS_REVIEW.md)",
    "5. [Phrase Usage](./PHRASE_USAGE_REVIEW.md)",
    "6. [noFit](./NO_FIT_REVIEW.md)",
    "7. [Image Analysis](./IMAGE_ANALYSIS_REVIEW.md)",
    "8. [Vocabulary Assistance](./VOCABULARY_ASSISTANCE_REVIEW.md)",
    "9. [Independent Checklist](./INDEPENDENT_REVIEW_CHECKLIST.md)",
  ]);
}

live("M2.4 bounded Live Provider gate", () => {
  it("runs Probe, Core20, Opportunity12, Multi-Turn8, and all four vision fixtures", async () => {
    expect([1, 2], "repair cycle must remain bounded").toContain(repairCycle);
    expect(
      existsSync(budgetPath),
      repairCycle === 1 ? "M2.4 budget ledger must be fresh" : "repair cycle 2 must reuse cycle 1 ledger",
    ).toBe(repairCycle === 2);
    const fixtures = {
      geometry: await renderFixture("m2.4-geometry.svg"),
      ui: await renderFixture("m2.4-ui-text.svg"),
      multi: await renderFixture("m2.4-multi-object.svg"),
      uncertain: await renderFixture("m2.4-uncertain.svg"),
    };
    const records: LiveRecord[] = [];
    const run = async (cases: LiveCase[]) => {
      for (const spec of cases) {
        records.push(await runCase(spec));
        if (budgetStop) break;
      }
    };

    const probeCases: LiveCase[] = [
      { id: "probe-glm-english", group: "probe", provider: glm, request: plainRequest("probe-glm-english", "你觉得每天散步二十分钟值得坚持吗？"), fixedLevel: 2, expected: "english_chunk" },
      { id: "probe-glm-no-fit", group: "probe", provider: glm, request: plainRequest("probe-glm-no-fit", "请只用中文说明今天的下一步。"), fixedLevel: 2, expected: "no_fit" },
      { id: "probe-vision-english", group: "probe", provider: vision, request: plainRequest("probe-vision-english", "请分析图中可见内容，并区分观察和推测。", fixtures.geometry), fixedLevel: 2, expected: "english_chunk", imageFixture: "m2.4-geometry.svg" },
      { id: "probe-vision-no-fit", group: "probe", provider: vision, request: plainRequest("probe-vision-no-fit", "请只用中文分析界面里的文字和按钮，并说明不确定之处。", fixtures.ui), fixedLevel: 2, expected: "no_fit", imageFixture: "m2.4-ui-text.svg" },
      { id: "probe-deepseek-plan", group: "probe", provider: deepSeek, request: plainRequest("probe-deepseek-plan", "帮我制定一个下周学习计划，要有时间、任务、优先级和复盘。"), fixedLevel: 2, expected: "english_chunk" },
      { id: "probe-deepseek-comparison-no-fit", group: "probe", provider: deepSeek, request: plainRequest("probe-deepseek-comparison-no-fit", "请只用中文给出两个方案的完整比较方法，包括记录、权衡、试验和下一步。"), fixedLevel: 2, expected: "no_fit" },
      { id: "probe-multi-clarification", group: "probe", provider: glm, request: multiTurnRequest(M24_MULTI_TURN_CORPUS[0]!), fixedLevel: 2, expected: "english_chunk", checks: (result) => result.diagnostics.assistance?.resolved ? [] : ["assistance context not resolved"] },
      { id: "probe-user-reuse", group: "probe", provider: deepSeek, request: plainRequest("probe-user-reuse", "I think this plan is useful，你怎么看？"), fixedLevel: 2, expected: "english_chunk", checks: (result) => result.diagnostics.userEnglishReuseOpportunity ? [] : ["user English reuse opportunity not recorded"] },
    ];
    await run(probeCases);
    const probesPass = records.length === 8 && records.every((item) => item.status === "PASS");
    if (!probesPass) {
      writeReport("M2_4_STOPPED_WITH_BLOCKERS", records);
      expect(probesPass, `M2.4 Probe failed: ${records.filter((item) => item.status === "FAIL").map((item) => `${item.id}=${item.failures.join(",")}`).join("; ")}`).toBe(true);
      return;
    }

    const coreCases: LiveCase[] = M24_CORE_CORPUS_IDS.map((id, index) => {
      const scenario = GOLDEN_CONVERSATION_CORPUS.find((item) => item.id === id)!;
      const selectedProvider = scenario.hasImage ? vision : index % 2 === 0 ? glm : deepSeek;
      let request = plainRequest(`core-${id}`, scenario.userMessage, scenario.hasImage ? fixtures.uncertain : undefined);
      if (id === "ask-phrase-clarify") request = multiTurnRequest({
        id: "core-ask-phrase-clarify",
        purpose: "history-grounded clarification",
        turns: [
          { role: "user", content: "这个方案先怎么处理？" },
          { role: "assistant", content: "For now，先保留可逆方案。", phraseId: "p-for-now" },
          { role: "user", content: scenario.userMessage },
        ],
      });
      return {
        id: `core-${id}`,
        group: "core" as const,
        provider: selectedProvider,
        request,
        fixedLevel: scenario.fixedLevel ?? 2,
        expected: "valid" as const,
        imageFixture: scenario.hasImage ? "m2.4-uncertain.svg" : undefined,
      };
    });
    await run(coreCases);
    if (records.some((item) => item.status === "FAIL") || budgetStop) {
      writeReport("M2_4_STOPPED_WITH_BLOCKERS", records);
      expect(false, "Core20 technical gate failed").toBe(true);
      return;
    }

    await run([{
      id: "image-fixture-multi-object",
      group: "image_fixture",
      provider: vision,
      request: plainRequest("image-fixture-multi-object", "请说明图中有哪些物体、它们的位置，以及哪些信息不能确定。", fixtures.multi),
      fixedLevel: 2,
      expected: "valid",
      imageFixture: "m2.4-multi-object.svg",
    }]);

    await run(NATURAL_OVERLAY_OPPORTUNITY_CORPUS.map((scenario) => ({
      id: `opportunity-${scenario.id}`,
      group: "opportunity" as const,
      provider: scenario.provider === "glm" ? glm : deepSeek,
      request: plainRequest(`opportunity-${scenario.id}`, scenario.userMessage),
      fixedLevel: scenario.fixedLevel,
      expected: "valid" as const,
    })));

    await run(M24_MULTI_TURN_CORPUS.map((scenario, index) => ({
      id: `multi-${scenario.id}`,
      group: "multi_turn" as const,
      provider: index % 2 === 0 ? glm : deepSeek,
      request: multiTurnRequest(scenario),
      fixedLevel: 2,
      expected: "valid" as const,
      checks: (result: EngineRunResult) => [
        scenario.id === "difficulty" && result.diagnostics.decision.effectiveLevel >= result.diagnostics.decision.fixedLevel
          ? "difficulty did not lower Effective Level"
          : "",
        scenario.id === "chinese-scope" && result.diagnostics.noFitDecisionSource !== "explicit_chinese_no_fit"
          ? "Chinese-only scope not respected"
          : "",
        scenario.id === "resume-english" && !result.diagnostics.userEnglishReuseOpportunity
          ? "user English did not resume Overlay evaluation"
          : "",
        ["meaning", "pronunciation", "click"].includes(scenario.id) && !result.diagnostics.assistance?.resolved
          ? "Vocabulary Assistance source unresolved"
          : "",
        scenario.id === "ambiguity" && (result.diagnostics.assistance?.resolved || !segmentsToPlainText(result.response.segments).match(/哪一个|哪句|具体指/u))
          ? "multiple-Phrase ambiguity was not clarified"
          : "",
      ].filter(Boolean),
    })));

    const expectedTotal = 8 + 20 + 1 + 12 + 8;
    const technicalPass = records.length === expectedTotal && records.every((item) => item.status === "PASS") && !budgetStop;
    const status = technicalPass ? "M2_4_READY_FOR_INDEPENDENT_HUMAN_REVIEW" : "M2_4_STOPPED_WITH_BLOCKERS";
    writeReport(status, records);
    if (technicalPass) writeReviewPackage(records);
    expect(technicalPass, `M2.4 Live gate failed: ${records.filter((item) => item.status === "FAIL").map((item) => `${item.id}=${item.failures.join(",")}`).join("; ")}`).toBe(true);
  }, 90 * 60_000);
});
