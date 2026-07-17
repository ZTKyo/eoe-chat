import type { ConversationAnalysis, OverlayDecision } from "@/domain/eoe";
import { EOE_POLICY_VERSION } from "./constants";

export function scheduleOverlay(input: {
  analysis: ConversationAnalysis;
  fixedLevel: number;
  enabled: boolean;
  hasImage: boolean;
  chineseOnlyScope?: boolean;
  difficultySignal?: boolean;
  contextualAcknowledgement?: boolean;
}): OverlayDecision {
  const fixedLevel = Math.max(1, Math.min(7, Math.round(input.fixedLevel)));
  let effectiveLevel = fixedLevel;
  const reasonCodes: string[] = [];

  if (input.hasImage) {
    return {
      mode: "disabled_for_image",
      fixedLevel,
      effectiveLevel: fixedLevel,
      maxNewFocus: 0,
      maxEnglishSegments: 0,
      reusePreferred: false,
      candidateCount: 0,
      reasonCodes: ["image_overlay_deferred"],
      policyVersion: EOE_POLICY_VERSION,
    };
  }

  if (!input.enabled) reasonCodes.push("engine_disabled");
  if (input.chineseOnlyScope) reasonCodes.push("explicit_chinese_scope");
  if (input.difficultySignal) {
    effectiveLevel = Math.max(1, fixedLevel - 1);
    reasonCodes.push("user_requested_lower_difficulty");
  }
  if (input.contextualAcknowledgement) {
    reasonCodes.push("contextual_acknowledgement");
  }
  if (input.analysis.sensitivity === "high_stakes") {
    effectiveLevel = 1;
    reasonCodes.push("high_stakes_clarity_first");
  } else if (input.analysis.sensitivity === "emotional") {
    effectiveLevel = Math.max(1, fixedLevel - 1);
    reasonCodes.push("emotional_density_reduced");
  } else if (input.analysis.sensitivity === "technical" && input.analysis.responseLength === "long") {
    effectiveLevel = Math.max(1, fixedLevel - 1);
    reasonCodes.push("complexity_reduced");
  }
  if (input.analysis.overlaySuitability === "none") reasonCodes.push("overlay_unsuitable");
  if (input.analysis.responseLength === "short") reasonCodes.push("short_response");

  const skip =
    !input.enabled ||
    input.chineseOnlyScope ||
    input.difficultySignal ||
    input.contextualAcknowledgement ||
    input.analysis.overlaySuitability === "none" ||
    (input.analysis.responseLength === "short" && input.analysis.overlaySuitability !== "high");

  if (!skip && reasonCodes.length === 0) reasonCodes.push("ordinary_substantive_turn");

  return {
    mode: skip ? "skip" : "preferred",
    fixedLevel,
    effectiveLevel,
    maxNewFocus: skip ? 0 : 1,
    maxEnglishSegments: skip ? 0 : 1,
    reusePreferred: true,
    candidateCount: 0,
    reasonCodes,
    policyVersion: EOE_POLICY_VERSION,
  };
}
