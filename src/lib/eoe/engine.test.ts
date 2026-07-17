import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import type { MockScenario } from "@/domain/eoe";
import { MockProvider } from "@/lib/providers/mock-provider";
import { ProviderGateway } from "@/lib/providers/gateway";
import { ProviderError, type Provider } from "@/lib/providers/types";
import { EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION } from "./constants";
import { runEoeEngine } from "./engine";
import { createPersistenceRecords } from "./persistence-events";

function gateway(): ProviderGateway {
  const mock = new MockProvider();
  return new ProviderGateway({ primary: mock, vision: mock, fallback: undefined, mock, forceMock: true });
}

function request(mockScenario: MockScenario): ChatRequest {
  return {
    conversationId: "conversation-1",
    messages: [{ role: "user", content: "我该怎么计划下一步？" }],
    attachments: [],
    engineState: { recentExposurePhraseIds: [], mockScenario },
  };
}

function imageRequest(content = "请分析这张图片中的形状和文字。"): ChatRequest {
  return {
    conversationId: "conversation-image",
    messages: [{ role: "user", content }],
    attachments: [{
      id: "image-1",
      name: "geometry-fixture.png",
      mimeType: "image/png",
      size: 12,
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    }],
    engineState: { recentExposurePhraseIds: [] },
  };
}

describe("EOE Engine retry and fallback", () => {
  function ambiguityRequest(): ChatRequest {
    return {
      conversationId: "c-ambiguity",
      messages: [
        { id: "u1", role: "user", content: "比较一下。" },
        {
          id: "a1",
          role: "assistant",
          content: "It depends，要看目标。",
          segments: [
            { type: "english_chunk", content: "It depends", phraseId: "p-it-depends", isNew: false, assistanceAvailable: true },
            { type: "text", content: "，要看目标。", language: "zh" },
          ],
        },
        {
          id: "a2",
          role: "assistant",
          content: "For now，先收集数据。",
          segments: [
            { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: false, assistanceAvailable: true },
            { type: "text", content: "，先收集数据。", language: "zh" },
          ],
        },
        { id: "u2", role: "user", content: "刚才那个什么意思？" },
      ],
      attachments: [],
      engineState: { recentExposurePhraseIds: ["p-it-depends", "p-for-now"] },
    };
  }

  it("owns multi-Phrase disambiguation without a Provider call or Exposure", async () => {
    const mock = new MockProvider();
    let providerCalls = 0;
    const counting: Provider = {
      id: "counting",
      modelId: "counting-v1",
      capabilities: mock.capabilities,
      async generate(input) {
        providerCalls += 1;
        return mock.generate(input);
      },
    };
    const providerGateway = new ProviderGateway({
      primary: counting,
      vision: mock,
      mock,
      forceMock: false,
    });
    const result = await runEoeEngine({
      request: ambiguityRequest(),
      gateway: providerGateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const text = result.response.segments.map((segment) => segment.content).join("");
    expect(providerCalls).toBe(0);
    expect(result.provider).toMatchObject({
      providerId: "engine-context",
      modelId: "phrase-reference-resolution-v1",
    });
    expect(result.diagnostics.attempts).toEqual([]);
    expect(result.diagnostics.assistance).toMatchObject({
      resolved: false,
      referenceStatus: "ambiguous",
      ambiguousCandidatePhraseIds: ["p-it-depends", "p-for-now"],
      engineOwnedClarification: true,
    });
    expect(text).toContain("it depends");
    expect(text).toContain("for now");
    expect(text).toContain("哪一个");
    expect(result.diagnostics.taskCompleteness.complete).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.response.usedPhraseIds).toEqual([]);
    const persisted = createPersistenceRecords({
      conversationId: "c-ambiguity",
      messageId: "m-clarification",
      response: { response: result.response, provider: result.provider, engine: result.diagnostics },
    });
    expect(persisted.exposures).toEqual([]);
    expect(persisted.attempts).toEqual([]);
  });

  it("enters Vocabulary Assistance only after the user selects an ambiguous Phrase", async () => {
    const first = await runEoeEngine({
      request: ambiguityRequest(),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const followUp: ChatRequest = {
      ...ambiguityRequest(),
      messages: [
        ...ambiguityRequest().messages,
        {
          id: "a3",
          role: "assistant",
          content: first.response.segments.map((segment) => segment.content).join(""),
          segments: first.response.segments,
        },
        { id: "u3", role: "user", content: "我指 For now，请解释它。" },
      ],
    };
    const result = await runEoeEngine({
      request: followUp,
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.assistance).toMatchObject({
      resolved: true,
      phraseId: "p-for-now",
      sourceMessageId: "a2",
      referenceStatus: "resolved",
    });
    expect(result.diagnostics.attempts.length).toBeGreaterThan(0);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("returns a valid English chunk traceable to selection", async () => {
    const result = await runEoeEngine({ request: request("valid_english_chunk"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: true } });
    expect(result.response.noFit).toBe(false);
    expect(result.response.usedPhraseIds).toEqual([result.diagnostics.selection.selectedPhraseId]);
    expect(result.diagnostics.attempts).toHaveLength(1);
    expect(result.diagnostics.finalValidation.valid).toBe(true);
  });

  it("accepts valid noFit as success", async () => {
    const result = await runEoeEngine({ request: request("valid_no_fit"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: false } });
    expect(result.response.noFit).toBe(true);
    expect(result.response.usedPhraseIds).toEqual([]);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it.each([
    ["invalid_phrase_id", "provider_template_parse_failed"],
    ["automatic_gloss", "template_translation_duplication"],
    ["teacher_mode", "template_teacher_mode"],
    ["overlay_budget_exceeded", "duplicate_placeholder"],
    ["broken_json", "provider_template_parse_failed"],
    ["missing_envelope_field", "missing_placeholder"],
    ["unexpected_segments_array", "provider_template_parse_failed"],
    ["no_fit_chunk_conflict", "use_phrase_conflict"],
    ["phrase_id_mismatch", "provider_template_parse_failed"],
    ["markdown_wrapped_json", "markdown_wrapped_template"],
    ["unexpected_extra_field", "provider_template_parse_failed"],
    ["invalid_confidence", "provider_template_parse_failed"],
  ] as const)("blocks %s before display", async (scenario, violation) => {
    const result = await runEoeEngine({ request: request(scenario), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: false } });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.attempts.flatMap((attempt) => attempt.validation.violations.map((item) => item.code))).toContain(violation);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
    expect(result.response.noFit).toBe(true);
  });

  it("records stage-specific Template diagnostics", async () => {
    const result = await runEoeEngine({
      request: request("unexpected_segments_array"),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts[0]?.pipeline).toMatchObject({
      templateParse: "failed",
      templateSemantics: "not_reached",
      templateValidator: "not_reached",
      mapper: "not_reached",
      domainSchema: "not_reached",
      domainValidator: "not_reached",
    });
    expect(result.diagnostics.attempts[0]?.pipelineStage).toBe("provider_template_parse");
  });

  it("regenerates after the first validation failure and succeeds on attempt two", async () => {
    const result = await runEoeEngine({ request: request("retry_then_success"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: false } });
    expect(result.diagnostics.attempts.map((attempt) => attempt.outcome)).toEqual(["invalid", "valid"]);
    expect(result.diagnostics.attempts[1]?.validatorRetry).toBe(true);
    expect(result.diagnostics.attempts[0]?.validation.violations.map((item) => item.code)).toContain(
      "missing_placeholder",
    );
    expect(result.diagnostics.attempts[1]?.pipeline).toMatchObject({
      templateParse: "passed",
      templateSemantics: "passed",
      templateValidator: "passed",
      mapper: "passed",
      domainSchema: "passed",
      domainValidator: "passed",
    });
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("uses natural fallback after two invalid attempts", async () => {
    const result = await runEoeEngine({ request: request("double_failure"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: false } });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
    expect(result.diagnostics.finalValidation.valid).toBe(false);
    expect(result.response.intentPreserved).toBe(false);
    expect(result.response.segments.map((segment) => segment.content).join("")).toContain("没有通过质量检查");
  });

  it("keeps a safe substantive Provider answer when completeness remains disputed", async () => {
    const mock = new MockProvider();
    const selectedPhrases: Array<string | undefined> = [];
    const substantiveButIncomplete: Provider = {
      id: "safe-incomplete",
      modelId: "safe-incomplete-v1",
      capabilities: mock.capabilities,
      async generate(input) {
        selectedPhrases.push(input.eoeContext?.selectedPhrase);
        return {
          content: JSON.stringify({
            schemaVersion: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
            usePhrase: false,
            responseTemplate:
              "TypeScript 中，unknown 更安全，使用前必须先做类型收窄或类型守卫；any 更宽松，但这会降低类型安全性。",
            noFitReason: input.eoeContext?.allowedNoFitReasons?.[0] ?? "phrase_not_natural",
          }),
          providerId: this.id,
          modelId: this.modelId,
          requestId: input.requestId,
          latencyMs: 1,
        };
      },
    };
    const providerGateway = new ProviderGateway({
      primary: substantiveButIncomplete,
      vision: mock,
      mock,
      forceMock: false,
    });
    const result = await runEoeEngine({
      request: {
        conversationId: "technical-safe-incomplete",
        messages: [{ role: "user", content: "解释 TypeScript 里 unknown 和 any 的区别" }],
        attachments: [],
        engineState: { recentExposurePhraseIds: [] },
      },
      gateway: providerGateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const text = result.response.segments.map((segment) => segment.content).join("");
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(selectedPhrases[0]).toBeDefined();
    expect(selectedPhrases[1]).toBeUndefined();
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.diagnostics.displayedWithSoftQualityWarning).toBe(true);
    expect(result.diagnostics.finalValidation.valid).toBe(false);
    expect(text).toContain("unknown 更安全");
    expect(text).not.toContain("没有通过质量检查");
  });

  it("retries an incomplete plan independently of noFit and accepts the complete second answer", async () => {
    const result = await runEoeEngine({
      request: request("task_incomplete_then_success"),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.attempts[0]?.validation.violations.map((item) => item.code)).toContain("missing_task_assignment");
    expect(result.diagnostics.taskCompleteness.complete).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("preserves the better Hard-Valid answer after two soft-incomplete answers", async () => {
    const result = await runEoeEngine({
      request: request("task_incomplete_double_failure"),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.diagnostics.taskCompleteness.complete).toBe(false);
    expect(result.diagnostics.displayedWithSoftQualityWarning).toBe(true);
  });

  it("provides contextual Vocabulary Assistance from real multi-turn segments", async () => {
    const assisted: ChatRequest = {
      conversationId: "c-assist",
      messages: [
        { id: "u1", role: "user", content: "我们先怎么安排？" },
        {
          id: "a1",
          role: "assistant",
          content: "For now，先确定今天的目标。",
          segments: [
            { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: true, assistanceAvailable: true },
            { type: "text", content: "，先确定今天的目标。", language: "zh" },
          ],
        },
        { id: "u2", role: "user", content: "什么意思？" },
      ],
      attachments: [],
      engineState: { recentExposurePhraseIds: [], assistanceRequest: { trigger: "meaning", sourceMessageId: "a1", segmentIndex: 0, phraseId: "p-for-now" } },
    };
    const result = await runEoeEngine({ request: assisted, gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: true } });
    const text = result.response.segments.map((segment) => segment.content).join("");
    expect(result.diagnostics.assistance).toMatchObject({ resolved: true, sourceMessageId: "a1", phraseId: "p-for-now" });
    expect(
      result.diagnostics.taskCompleteness.complete,
      JSON.stringify({
        text,
        issues: result.diagnostics.taskCompleteness.issues,
        attempts: result.diagnostics.attempts.map((attempt) => attempt.validation.violations),
      }),
    ).toBe(true);
    expect(text).toContain("For now");
    expect(text).toMatch(/继续|回到/u);
    expect(result.response.segments.find((segment) => segment.type === "assistance_phrase")).toMatchObject({
      phraseId: "p-for-now",
      content: "for now",
      pronunciation: "/fɔːr naʊ/",
    });
    expect(result.diagnostics.assistance).toMatchObject({
      contextVersion: "eoe.assistance-context.v2",
      providerContentPass: true,
      assistanceContentFallback: false,
    });
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("uses the Engine-owned Assistance fallback after two invalid Provider contents", async () => {
    const mock = new MockProvider();
    const invalidAssistance: Provider = {
      id: "invalid-assistance",
      modelId: "invalid-assistance-v1",
      capabilities: mock.capabilities,
      async generate(input) {
        if (input.responseJsonSchema?.name === "eoe_assistance_content_v2") {
          return { content: "{broken", providerId: this.id, modelId: this.modelId, requestId: input.requestId, latencyMs: 1 };
        }
        return mock.generate(input);
      },
    };
    const providerGateway = new ProviderGateway({ primary: invalidAssistance, vision: mock, mock, forceMock: false });
    const assisted: ChatRequest = {
      conversationId: "c-assist-fallback",
      messages: [
        { id: "u1", role: "user", content: "我们先怎么安排？" },
        {
          id: "a1",
          role: "assistant",
          content: "For now，先确定今天的目标。",
          segments: [
            { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: true, assistanceAvailable: true },
            { type: "text", content: "，先确定今天的目标。", language: "zh" },
          ],
        },
        { id: "u2", role: "user", content: "什么意思，怎么读？" },
      ],
      attachments: [],
      engineState: { recentExposurePhraseIds: [], assistanceRequest: { trigger: "pronunciation", sourceMessageId: "a1", segmentIndex: 0, phraseId: "p-for-now" } },
    };
    const result = await runEoeEngine({ request: assisted, gateway: providerGateway, config: { enabled: true, fixedLevel: 2, developerMode: true } });
    const text = result.response.segments.map((segment) => segment.content).join("");
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.attempts.every((attempt) => attempt.validation.violations.some((item) => item.code === "assistance_content_parse_failed"))).toBe(true);
    expect(result.diagnostics.assistance).toMatchObject({ assistanceContentFallback: true, providerContentPass: false });
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(text).toContain("For now");
    expect(text).toContain("/fɔːr naʊ/");
    expect(text).not.toContain("例句");
  });

  it("grounds an image response in a persisted Vision Observation with Overlay disabled", async () => {
    const result = await runEoeEngine({ request: imageRequest(), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: true } });
    expect(result.diagnostics.visionObservation).toMatchObject({ valid: true, providerId: "mock" });
    expect(result.diagnostics.visionObservation?.envelope?.observations.length).toBeGreaterThan(0);
    expect(result.diagnostics.decision.mode).toBe("disabled_for_image");
    expect(result.diagnostics.selection).toMatchObject({ candidates: [], noFit: true });
    expect(result.response.segments.some((segment) => segment.type === "english_chunk")).toBe(false);
    expect(result.response.noFit).toBe(true);
    expect(result.diagnostics.noFitDecisionSource).toBe("image_overlay_deferred");
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.diagnostics.taskCompleteness.complete).toBe(true);
  });

  it("keeps a Chinese-only image answer fully Chinese without entering Natural Fallback", async () => {
    const result = await runEoeEngine({ request: imageRequest("请只用中文分析这张图片。"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: true } });
    const rendered = result.response.segments.map((segment) => segment.content).join("");
    expect(result.response.segments.every((segment) => segment.type === "text" && segment.language === "zh")).toBe(true);
    expect(rendered).not.toMatch(/[A-Za-z]{2,}/u);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.diagnostics.noFitReason).toMatch(/^(image_overlay_deferred|explicit_chinese_request)$/u);
  });

  it("does not invent image grounding when the Observation contract is empty", async () => {
    const mock = new MockProvider();
    let calls = 0;
    const missingObservation: Provider = {
      id: "missing-observation",
      modelId: "missing-observation-v1",
      capabilities: mock.capabilities,
      async generate(input) {
        calls += 1;
        return {
          content: JSON.stringify({ schemaVersion: "eoe.vision-observation.v1", observations: [], visibleText: [], uncertainties: [] }),
          providerId: this.id,
          modelId: this.modelId,
          requestId: input.requestId,
          latencyMs: 1,
        };
      },
    };
    const providerGateway = new ProviderGateway({ primary: missingObservation, vision: missingObservation, mock, forceMock: false });
    const result = await runEoeEngine({ request: imageRequest(), gateway: providerGateway, config: { enabled: true, fixedLevel: 2, developerMode: true } });
    expect(calls).toBe(1);
    expect(result.diagnostics.visionObservation).toMatchObject({ valid: false });
    expect(result.diagnostics.visionObservation?.violationCodes).toContain("vision_observation_missing");
    expect(result.diagnostics.attempts).toHaveLength(0);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
    expect(result.diagnostics.taskCompleteness.complete).toBe(false);
  });

  it("distinguishes retryable and non-retryable Provider errors", async () => {
    const retryable = await runEoeEngine({ request: request("provider_retryable_error"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: false } });
    expect(retryable.diagnostics.attempts).toHaveLength(2);
    expect(retryable.diagnostics.attempts.every((attempt) => attempt.outcome === "provider_error")).toBe(true);
    const nonRetryable = await runEoeEngine({ request: request("provider_non_retryable_error"), gateway: gateway(), config: { enabled: true, fixedLevel: 2, developerMode: false } });
    expect(nonRetryable.diagnostics.attempts).toHaveLength(1);
    expect(nonRetryable.diagnostics.attempts[0]?.errorCategory).toBe("invalid_request");
  });

  it("keeps the Template contract across Provider fallback", async () => {
    const mock = new MockProvider();
    const primary: Provider = {
      id: "glm",
      modelId: "glm-4.7",
      capabilities: mock.capabilities,
      async generate() {
        throw new ProviderError("controlled unavailable", "provider_unavailable", true, 503);
      },
    };
    const fallback: Provider = {
      id: "deepseek",
      modelId: "deepseek-v4-flash",
      capabilities: mock.capabilities,
      async generate(input) {
        const result = await mock.generate(input);
        return { ...result, providerId: "deepseek", modelId: "deepseek-v4-flash" };
      },
    };
    const providerGateway = new ProviderGateway({
      primary,
      vision: mock,
      fallback,
      mock,
      forceMock: false,
    });
    const result = await runEoeEngine({
      request: request("valid_english_chunk"),
      gateway: providerGateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.fallbackUsed).toBe(true);
    expect(result.provider.providerId).toBe("deepseek");
    expect(result.diagnostics.attempts[0]?.providerFallbackUsed).toBe(true);
    expect(result.diagnostics.attempts[0]?.pipeline).toMatchObject({
      templateParse: "passed",
      templateValidator: "passed",
      mapper: "passed",
      domainSchema: "passed",
      domainValidator: "passed",
    });
  });
});
