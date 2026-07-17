import { describe, expect, it } from "vitest";
import type { ConversationAnalysis } from "@/domain/eoe";
import { selectCandidates } from "./candidate-selector";
import { PHRASE_REGISTRY } from "./registry/phrase-registry";
import { scheduleOverlay } from "./scheduler";
import { LIVE_SAFE_PHRASES, LIVE_SAFE_REALIZATION_PROFILE_MAP } from "./registry/phrase-realization";

const analysis: ConversationAnalysis = {
  primaryFunction: "advise",
  sensitivity: "normal",
  responseLength: "medium",
  overlaySuitability: "high",
  confidence: 0.9,
};

describe("Candidate Selector", () => {
  it("returns a deterministic ranked pool and selected Registry phrase", () => {
    const decision = scheduleOverlay({ analysis, fixedLevel: 2, enabled: true, hasImage: false });
    const input = { registry: LIVE_SAFE_PHRASES, decision, analysis, userMessage: "下一步该怎么做？", recentExposurePhraseIds: [], realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP };
    const first = selectCandidates(input);
    expect(first).toEqual(selectCandidates(input));
    expect(first.candidates.length, JSON.stringify(first.candidates)).toBeGreaterThanOrEqual(3);
    expect(first.candidates.length).toBeLessThanOrEqual(5);
    expect(first.selectedPhraseId).toBe(first.candidates[0]?.phraseId);
    expect(PHRASE_REGISTRY.some((phrase) => phrase.id === first.selectedPhraseId)).toBe(true);
    expect(first.candidates.every((candidate) => candidate.grammaticalFit !== "low")).toBe(true);
    expect(first.candidates.every((candidate) => candidate.allowedPositions.length > 0)).toBe(true);
    expect(first.candidates.every((candidate) => candidate.labelLikeRisk < 0.7)).toBe(true);
  });

  it("enforces cooldown and permits noFit", () => {
    const decision = scheduleOverlay({ analysis, fixedLevel: 2, enabled: true, hasImage: false });
    const first = selectCandidates({ registry: LIVE_SAFE_PHRASES, decision, analysis, userMessage: "给我建议", recentExposurePhraseIds: [], realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP });
    const cooled = selectCandidates({
      registry: LIVE_SAFE_PHRASES,
      decision,
      analysis,
      userMessage: "给我建议",
      recentExposurePhraseIds: [first.selectedPhraseId ?? ""],
      realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP,
    });
    expect(cooled.selectedPhraseId).not.toBe(first.selectedPhraseId);
    const skipped = selectCandidates({
      registry: LIVE_SAFE_PHRASES,
      decision: { ...decision, mode: "skip", maxEnglishSegments: 0, maxNewFocus: 0 },
      analysis,
      userMessage: "只用中文",
      recentExposurePhraseIds: [],
      realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP,
    });
    expect(skipped).toMatchObject({ candidates: [], noFit: true });
  });

  it("prioritizes an exact user Phrase reuse opportunity even during cooldown", () => {
    const answerAnalysis = { ...analysis, primaryFunction: "answer" as const };
    const decision = scheduleOverlay({ analysis: answerAnalysis, fixedLevel: 2, enabled: true, hasImage: false });
    const result = selectCandidates({
      registry: LIVE_SAFE_PHRASES,
      decision,
      analysis: answerAnalysis,
      userMessage: "I think this plan is useful，你怎么看？",
      recentExposurePhraseIds: ["p-i-think"],
      realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP,
      userPhraseReuseOpportunity: { phraseId: "p-i-think", matchedText: "I think", confidence: 1, source: "exact" },
    });
    expect(result.selectedPhraseId).toBe("p-i-think");
    expect(result.candidates[0]).toMatchObject({ phraseId: "p-i-think", isReuse: true });
    expect(result.candidates[0]?.reasons).toContain("reuse_opportunity");
  });

  it("does not let user Phrase reuse bypass high-risk or explicit skip policy", () => {
    const highRiskAnalysis = { ...analysis, sensitivity: "high_stakes" as const };
    const decision = scheduleOverlay({ analysis: highRiskAnalysis, fixedLevel: 2, enabled: true, hasImage: false });
    const common = {
      registry: LIVE_SAFE_PHRASES,
      userMessage: "I think 这个剂量安全吗？",
      recentExposurePhraseIds: [] as string[],
      realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP,
      userPhraseReuseOpportunity: { phraseId: "p-i-think", matchedText: "I think", confidence: 1, source: "exact" as const },
    };
    expect(selectCandidates({ ...common, decision, analysis: highRiskAnalysis })).toMatchObject({ candidates: [], noFit: true });
    expect(selectCandidates({
      ...common,
      decision: { ...decision, mode: "skip", maxEnglishSegments: 0, maxNewFocus: 0 },
      analysis,
    })).toMatchObject({ candidates: [], noFit: true });
  });

  it("does not use standalone agreement reactions for an unrelated factual answer", () => {
    const answerAnalysis = {
      ...analysis,
      primaryFunction: "answer" as const,
      secondaryFunction: undefined,
    };
    const decision = scheduleOverlay({
      analysis: answerAnalysis,
      fixedLevel: 2,
      enabled: true,
      hasImage: false,
    });
    const result = selectCandidates({
      registry: LIVE_SAFE_PHRASES,
      decision,
      analysis: answerAnalysis,
      userMessage: "布偶猫为什么叫布偶猫？",
      recentExposurePhraseIds: [],
      realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP,
    });
    expect(result.candidates.map((candidate) => candidate.phraseId)).not.toContain("p-that-makes-sense");
    expect(result.candidates.map((candidate) => candidate.phraseId)).not.toContain("p-sounds-good");
  });
});
