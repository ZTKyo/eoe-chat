import { describe, expect, it } from "vitest";
import type { CandidateSelection, ConversationAnalysis, OverlayDecision } from "@/domain/eoe";
import { getPhraseById } from "./registry/phrase-registry";
import { getPhraseRealizationProfile } from "./registry/phrase-realization";
import { buildDirective } from "./directive-builder";

const analysis: ConversationAnalysis = { primaryFunction: "advise", sensitivity: "normal", responseLength: "medium", overlaySuitability: "high", confidence: 0.9 };
const decision: OverlayDecision = { mode: "preferred", fixedLevel: 2, effectiveLevel: 2, maxNewFocus: 1, maxEnglishSegments: 1, reusePreferred: true, candidateCount: 1, reasonCodes: [], policyVersion: "eoe.scheduler.v1" };
const selection: CandidateSelection = {
  candidates: [{
    phraseId: "p-for-now", score: 90, reasons: [], isReuse: false,
    grammaticalFit: "high", insertionPosition: "sentence_middle",
    allowedPositions: ["sentence_start", "sentence_middle"], bilingualCompatibility: 0.9,
    punctuationRisk: 0.15, translationRisk: 0.2, labelLikeRisk: 0.2, responseLengthFit: "high",
  }],
  selectedPhraseId: "p-for-now", noFit: false, selectorVersion: "eoe.selector.v1.1",
};
const selectedPhrase = getPhraseById("p-for-now")!;
const realizationProfile = getPhraseRealizationProfile("p-for-now")!;

describe("M2.3 Directive Builder", () => {
  it("requests only the strict Provider Template and keeps Engine IDs out of output instructions", () => {
    const directive = buildDirective({ analysis, decision, selection, candidates: [selectedPhrase], selectedPhrase, realizationProfile, recentExposurePhraseIds: [], attemptNumber: 1 });
    expect(directive).toContain("eoe.provider-template.v1");
    expect(directive).toContain("{{EOE_PHRASE}}");
    expect(directive).toContain("usePhrase");
    expect(directive).toContain("responseTemplate");
    expect(directive).toContain("noFitReason");
    expect(directive).toContain("Choose any allowed natural placeholder position");
    expect(directive).toContain("safeBilingualFrames");
    expect(directive).toContain("{{EOE_PHRASE}}，先保留风险更低的方案");
    expect(directive).not.toContain("templatePositionPreference");
    expect(directive).not.toContain("authorized live validation probe");
    expect(directive).toContain("Never output the phrase content itself");
    expect(directive).not.toContain("eoe.provider-envelope.v1");
    expect(directive).not.toContain("p-for-now");
    expect(directive.length).toBeLessThan(5_000);
  });

  it("passes normalized violation codes to Attempt 2", () => {
    const directive = buildDirective({
      analysis, decision, selection, candidates: [selectedPhrase], selectedPhrase, realizationProfile,
      recentExposurePhraseIds: [], attemptNumber: 2,
      previousValidation: { valid: false, violations: [{ code: "template_teacher_mode", severity: "error" }], retryable: true },
    });
    expect(directive).toContain("template_teacher_mode");
    expect(directive).toContain("Regenerate the complete Template");
  });

  it("turns observed Template failures into generic exact corrections without changing validation", () => {
    const directive = buildDirective({
      analysis, decision, selection, candidates: [selectedPhrase], selectedPhrase, realizationProfile,
      recentExposurePhraseIds: [], attemptNumber: 2,
      previousValidation: {
        valid: false,
        violations: [
          { code: "template_boundary_invalid", severity: "error" },
          { code: "missing_no_fit_reason", severity: "error" },
          { code: "duplicate_placeholder", severity: "error" },
        ],
        retryable: true,
      },
    });
    expect(directive).toContain("must never directly touch a Chinese character");
    expect(directive).toContain("noFitReason as one allowed enum value");
    expect(directive).toContain("remove every duplicate occurrence");
    expect(directive).toContain("Follow one selected safeBilingualFrame");
    expect(directive).toContain("preserve the punctuation or whitespace immediately adjacent");
    expect(directive).toContain("noFitReason=grammar_mismatch");
    expect(directive).toContain("exactly three keys");
    expect(directive).toContain("exactly four keys");
    expect(directive).not.toContain("我们将{{EOE_PHRASE}}推进");
  });

  it("gives a substantive-clause correction for grammatical role failures", () => {
    const phrase = getPhraseById("p-i-think")!;
    const profile = getPhraseRealizationProfile("p-i-think")!;
    const phraseSelection: CandidateSelection = {
      ...selection,
      candidates: [{
        ...selection.candidates[0],
        phraseId: "p-i-think",
        isReuse: true,
        insertionPosition: "sentence_start",
        allowedPositions: ["sentence_start"],
      }],
      selectedPhraseId: "p-i-think",
    };
    const directive = buildDirective({
      analysis,
      decision,
      selection: phraseSelection,
      candidates: [phrase],
      selectedPhrase: phrase,
      realizationProfile: profile,
      recentExposurePhraseIds: [],
      attemptNumber: 2,
      previousValidation: {
        valid: false,
        violations: [{ code: "grammatical_role_mismatch", severity: "error" }],
        retryable: true,
      },
    });
    expect(directive).toContain("actual judgment as a substantive clause");
    expect(directive).toContain("Do not follow it with meta instructions");
    expect(directive).toContain("{{EOE_PHRASE}}，这个方向值得继续");
  });

  it("passes proportional requirements and technical identifiers without weakening validation", () => {
    const directive = buildDirective({
      analysis: { ...analysis, sensitivity: "technical" },
      decision,
      selection,
      candidates: [selectedPhrase],
      selectedPhrase,
      realizationProfile,
      recentExposurePhraseIds: [],
      obligations: [{
        id: "obligation-explain_concept",
        kind: "explain_concept",
        description: "Explain the meaningful distinction.",
        required: true,
        technicalTerms: ["TypeScript", "unknown", "any"],
      }],
      attemptNumber: 2,
      previousValidation: {
        valid: false,
        violations: [
          { code: "technical_any_behavior_missing", severity: "error" },
          { code: "overlay_replaced_core_answer", severity: "error" },
        ],
        retryable: true,
      },
    });
    expect(directive).toContain("TECHNICAL DOMAIN CONTENT");
    expect(directive).toContain("are identifiers or technical terms");
    expect(directive).toContain("any bypasses or disables ordinary type checking");
    expect(directive).toContain("optional Phrase displaced required content");
    expect(directive).toContain("usePhrase=false is preferred");
  });
});
