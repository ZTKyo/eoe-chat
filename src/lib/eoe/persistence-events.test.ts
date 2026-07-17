import { describe, expect, it } from "vitest";
import type { ChatResponse } from "@/domain/chat";
import { createPersistenceRecords } from "./persistence-events";

const base: ChatResponse = {
  response: {
    schemaVersion: "eoe.response.v2",
    policyVersion: "eoe.scheduler.v1",
    conversationFunction: "answer",
    segments: [{ type: "text", content: "我觉得先确认目标，是 ", language: "zh" }, { type: "english_chunk", content: "a good place to start", phraseId: "p-good-place-to-start", isNew: true, assistanceAvailable: true }, { type: "text", content: "；之后再决定下一步。", language: "zh" }],
    usedPhraseIds: ["p-good-place-to-start"],
    noFit: false,
    naturalnessConfidence: 0.9,
    intentPreserved: true,
    generationAttemptId: "attempt-1",
  },
  provider: { providerId: "mock", modelId: "mock-local-v2", fallbackUsed: false, requestId: "req-1", latencyMs: 2 },
  engine: {
    analysis: { primaryFunction: "answer", sensitivity: "normal", responseLength: "medium", overlaySuitability: "high", confidence: 0.9 },
    responseObligations: [{ id: "obligation-answer_question", kind: "answer_question", description: "Answer", required: true }],
    taskCompleteness: { complete: true, confidence: 0.92, fulfilledObligationIds: ["obligation-answer_question"], missingObligationIds: [], issues: [], suggestedAction: "accept", reviewVersion: "eoe.task-completeness.v1" },
    decision: { mode: "preferred", fixedLevel: 2, effectiveLevel: 2, maxNewFocus: 1, maxEnglishSegments: 1, reusePreferred: true, candidateCount: 1, reasonCodes: [], policyVersion: "eoe.scheduler.v1" },
    selection: { candidates: [{ phraseId: "p-good-place-to-start", score: 90, reasons: [], isReuse: false, grammaticalFit: "high", insertionPosition: "sentence_middle", allowedPositions: ["sentence_middle"], bilingualCompatibility: 0.9, punctuationRisk: 0.15, translationRisk: 0.2, labelLikeRisk: 0.2, responseLengthFit: "high" }], selectedPhraseId: "p-good-place-to-start", noFit: false, selectorVersion: "eoe.selector.v1.1" },
    attempts: [{ id: "attempt-1", attemptNumber: 1, providerId: "mock", modelId: "mock-local-v2", requestId: "req-1", latencyMs: 2, providerFallbackUsed: false, validatorRetry: false, outcome: "valid", validation: { valid: true, violations: [], retryable: false } }],
    finalValidation: { valid: true, violations: [], retryable: false },
    responseExecutionSource: "provider_generated",
    noFit: false,
    userEnglishReuseOpportunity: false,
    benchmarkType: "production",
    naturalnessEvidence: "none",
    providerId: "mock",
    modelId: "mock-local-v2",
    totalLatencyMs: 2,
    fallbackUsed: false,
    naturalFallbackUsed: false,
    policyVersion: "eoe.scheduler.v1",
    registryVersion: "eoe.phrases.v1.1",
    selectorVersion: "eoe.selector.v1.1",
    directiveVersion: "eoe.directive.v1.1",
    validatorVersion: "eoe.validator.v1.1",
    providerTemplateSchemaVersion: "eoe.provider-template.v1",
    realizationPolicyVersion: "eoe.realization.v1",
    templateValidatorVersion: "eoe.template-validator.v1",
    developerMode: false,
  },
};

describe("Exposure and diagnostic records", () => {
  it("creates exposure only for the final displayed English chunk", () => {
    const records = createPersistenceRecords({ conversationId: "c1", messageId: "m1", response: base, timestamp: 100 });
    expect(records.exposures).toHaveLength(1);
    expect(records.exposures[0]).toMatchObject({ phraseId: "p-good-place-to-start", messageId: "m1", generationAttemptId: "attempt-1" });
    expect(records.attempts).toHaveLength(1);
  });

  it("creates no exposure for a displayed noFit fallback", () => {
    const noFit: ChatResponse = { ...base, response: { ...base.response, segments: [{ type: "text", content: "直接回答。", language: "zh" }], usedPhraseIds: [], noFit: true } };
    expect(createPersistenceRecords({ conversationId: "c1", messageId: "m2", response: noFit }).exposures).toEqual([]);
  });

  it("does not count an Engine-owned assistance Phrase as a new Exposure", () => {
    const assistance: ChatResponse = {
      ...base,
      response: {
        ...base.response,
        segments: [
          { type: "text", content: "原句：For now，先确认目标。\n短语：", language: "zh" },
          { type: "assistance_phrase", content: "For now", phraseId: "p-for-now", pronunciation: "/fɔːr naʊ/" },
          { type: "text", content: "，表示目前先这样处理。", language: "zh" },
        ],
        usedPhraseIds: [],
        noFit: false,
      },
    };
    expect(createPersistenceRecords({ conversationId: "c1", messageId: "m3", response: assistance }).exposures).toEqual([]);
  });
});
