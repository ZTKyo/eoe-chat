import { describe, expect, it } from "vitest";
import type { CandidateSelection, ConversationAnalysis, OverlayDecision } from "@/domain/eoe";
import { reviewNaturalness } from "./soft-naturalness-validator";

const analysis: ConversationAnalysis = { primaryFunction: "advise", sensitivity: "normal", responseLength: "medium", overlaySuitability: "high", confidence: 0.9 };
const decision: OverlayDecision = { mode: "preferred", fixedLevel: 2, effectiveLevel: 2, maxNewFocus: 1, maxEnglishSegments: 1, reusePreferred: true, candidateCount: 1, reasonCodes: [], policyVersion: "eoe.scheduler.v1.1" };
const selection: CandidateSelection = {
  candidates: [{ phraseId: "p-good-place-to-start", score: 90, reasons: [], isReuse: false, grammaticalFit: "high", insertionPosition: "sentence_middle", allowedPositions: ["sentence_middle"], bilingualCompatibility: 0.9, punctuationRisk: 0.15, translationRisk: 0.2, labelLikeRisk: 0.2, responseLengthFit: "high" }],
  selectedPhraseId: "p-good-place-to-start",
  noFit: false,
  selectorVersion: "eoe.selector.v1.1",
};
const response = {
  schemaVersion: "eoe.response.v2" as const,
  policyVersion: "eoe.scheduler.v1.1",
  conversationFunction: "advise" as const,
  segments: [
    { type: "text" as const, content: "我觉得先确认目标，是 ", language: "zh" as const },
    { type: "english_chunk" as const, content: "a good place to start", phraseId: "p-good-place-to-start", isNew: true, assistanceAvailable: true },
    { type: "text" as const, content: "；之后再决定具体动作。", language: "zh" as const },
  ],
  usedPhraseIds: ["p-good-place-to-start"],
  noFit: false,
  naturalnessConfidence: 0.96,
  intentPreserved: true,
};

describe("Soft Naturalness Validator", () => {
  it("does not fabricate a natural=true confidence score for a structurally clean result", () => {
    const review = reviewNaturalness({ response, context: { analysis, decision, selection }, attemptNumber: 1, mode: "default" });
    expect(review).toBeUndefined();
  });

  it("does not rewrite and requests regeneration for a colon label", () => {
    const colon = { ...response, segments: [response.segments[0], response.segments[1], { type: "text" as const, content: "：先确认目标。", language: "zh" as const }] };
    const review = reviewNaturalness({ response: colon, context: { analysis, decision, selection }, attemptNumber: 1, mode: "benchmark" });
    expect(review).toMatchObject({ natural: false, suggestedAction: "regenerate" });
    expect(review?.issues).toContain("label_like_colon_boundary");
    expect(colon.segments[2].content).toBe("：先确认目标。");
  });

  it("uses noFit after a second naturalness rejection", () => {
    const colon = { ...response, segments: [response.segments[0], response.segments[1], { type: "text" as const, content: "：先确认目标。", language: "zh" as const }] };
    expect(reviewNaturalness({ response: colon, context: { analysis, decision, selection }, attemptNumber: 2, mode: "live" })?.suggestedAction).toBe("use_no_fit");
  });
});
