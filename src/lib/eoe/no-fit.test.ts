import { describe, expect, it } from "vitest";
import type { CandidateSelection, ConversationAnalysis, OverlayDecision } from "@/domain/eoe";
import { deriveNoFitPolicy } from "./no-fit";

const analysis: ConversationAnalysis = { primaryFunction: "explain", sensitivity: "technical", responseLength: "medium", overlaySuitability: "medium", confidence: 0.9 };
const decision: OverlayDecision = { mode: "preferred", fixedLevel: 3, effectiveLevel: 3, maxNewFocus: 1, maxEnglishSegments: 1, reusePreferred: true, candidateCount: 0, reasonCodes: [], policyVersion: "eoe.scheduler.v2.0" };
const selection: CandidateSelection = { candidates: [], noFit: true, selectorVersion: "eoe.selector.v2.0" };
const context = { chineseOnlyScope: false, difficultySignal: false, userEnglishPresent: false, userEnglishReuseOpportunity: false };

describe("M2.4 noFit calibration", () => {
  it("does not mislabel a substantive technical question as too short", () => {
    const policy = deriveNoFitPolicy({ analysis, decision, selection, context });
    expect(policy.decisionSource).toBe("selector_no_candidate");
    expect(policy.allowedReasons).toEqual(["technical_complexity", "no_safe_candidate"]);
    expect(policy.allowedReasons).not.toContain("conversation_too_short");
  });

  it("records explicit Chinese scope separately", () => {
    expect(deriveNoFitPolicy({ analysis, decision: { ...decision, mode: "skip" }, selection, context: { ...context, chineseOnlyScope: true } })).toEqual({
      decisionSource: "explicit_chinese_no_fit",
      allowedReasons: ["explicit_chinese_request"],
    });
  });

  it("records the image policy as the noFit decision source", () => {
    expect(deriveNoFitPolicy({
      analysis: { ...analysis, primaryFunction: "analyze_image" },
      decision: { ...decision, mode: "disabled_for_image", maxEnglishSegments: 0, maxNewFocus: 0 },
      selection,
      context,
    })).toEqual({
      decisionSource: "image_overlay_deferred",
      allowedReasons: ["image_overlay_deferred"],
    });
  });
});
