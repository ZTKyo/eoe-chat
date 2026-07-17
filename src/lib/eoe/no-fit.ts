import type {
  CandidateSelection,
  ConversationAnalysis,
  NoFitDecisionSource,
  NoFitReason,
  OverlayDecision,
} from "@/domain/eoe";
import type { ConversationContext } from "./conversation-context";

export interface NoFitPolicy {
  decisionSource: NoFitDecisionSource;
  allowedReasons: NoFitReason[];
}

export function deriveNoFitPolicy(input: {
  analysis: ConversationAnalysis;
  decision: OverlayDecision;
  selection: CandidateSelection;
  context: ConversationContext;
}): NoFitPolicy {
  if (input.decision.mode === "disabled_for_image") {
    return input.context.chineseOnlyScope
      ? { decisionSource: "image_overlay_deferred", allowedReasons: ["explicit_chinese_request", "image_overlay_deferred"] }
      : { decisionSource: "image_overlay_deferred", allowedReasons: ["image_overlay_deferred"] };
  }
  if (input.context.chineseOnlyScope) {
    return { decisionSource: "explicit_chinese_no_fit", allowedReasons: ["explicit_chinese_request"] };
  }
  if (input.analysis.sensitivity === "high_stakes") {
    return { decisionSource: "high_stakes_no_fit", allowedReasons: ["sensitive_context"] };
  }
  if (input.decision.reasonCodes.includes("short_response") && input.decision.mode === "skip") {
    return { decisionSource: "short_turn_no_fit", allowedReasons: ["conversation_too_short"] };
  }
  if (input.context.difficultySignal && input.selection.noFit) {
    return { decisionSource: "contextual_no_fit", allowedReasons: ["user_requested_lower_difficulty", "no_safe_candidate"] };
  }
  if (input.decision.mode === "skip") {
    return { decisionSource: "scheduler_no_fit", allowedReasons: ["phrase_not_natural", "no_safe_candidate"] };
  }
  if (input.selection.noFit || !input.selection.selectedPhraseId) {
    return {
      decisionSource: "selector_no_candidate",
      allowedReasons: input.analysis.sensitivity === "technical"
        ? ["technical_complexity", "no_safe_candidate"]
        : ["no_safe_candidate"],
    };
  }
  return {
    decisionSource: "provider_phrase_rejected",
    allowedReasons: input.analysis.sensitivity === "technical"
      ? ["phrase_not_natural", "technical_complexity", "grammar_mismatch", "position_mismatch", "translation_risk", "label_like_risk", "other"]
      : ["phrase_not_natural", "grammar_mismatch", "position_mismatch", "translation_risk", "label_like_risk", "other"],
  };
}
