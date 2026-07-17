import { segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type { NaturalnessReview } from "@/domain/eoe";
import { EOE_NATURALNESS_VALIDATOR_VERSION } from "./constants";
import type { ValidationContext } from "./validator";

export type NaturalnessMode = "default" | "benchmark" | "live";

export function reviewNaturalness(input: {
  response: GeneratedResponse;
  context: ValidationContext;
  attemptNumber: 1 | 2;
  mode: NaturalnessMode;
}): NaturalnessReview | undefined {
  const englishIndex = input.response.segments.findIndex((segment) => segment.type === "english_chunk");
  if (englishIndex < 0) return undefined;

  const chunk = input.response.segments[englishIndex];
  if (chunk.type !== "english_chunk") return undefined;
  const candidate = input.context.selection.candidates.find((item) => item.phraseId === chunk.phraseId);
  const previous = input.response.segments[englishIndex - 1];
  const next = input.response.segments[englishIndex + 1];
  const previousText = previous?.type === "text" ? previous.content : "";
  const nextText = next?.type === "text" ? next.content : "";
  const triggers = new Set<string>();
  const issues = new Set<string>();
  let confidence = 0.96;

  if (!candidate?.isReuse) triggers.add("first_use");
  if (candidate?.grammaticalFit !== "high") triggers.add("grammatical_fit_not_high");
  if (englishIndex === 0) triggers.add("sentence_start");
  if (/^\s*[:：]/u.test(nextText)) triggers.add("colon_after_chunk");
  if (input.response.segments.length > 3) triggers.add("segment_count_over_three");
  if ((candidate?.labelLikeRisk ?? 0) >= 0.6) triggers.add("high_label_like_risk");
  if ((candidate?.translationRisk ?? 0) >= 0.6) triggers.add("high_translation_risk");
  if (triggers.size === 0) return undefined;

  const startAllowed = candidate?.allowedPositions.includes("sentence_start") === true;
  const endAllowed = candidate?.allowedPositions.includes("sentence_end") === true;
  if ((!previousText && !startAllowed) || (!nextText && !endAllowed)) {
    confidence -= 0.35;
    issues.add("orphan_or_disallowed_edge_chunk");
  }
  if (/[:：]\s*$/u.test(previousText) || /^\s*[:：]/u.test(nextText)) {
    confidence -= 0.4;
    issues.add("label_like_colon_boundary");
  }
  if (input.response.segments.length > 3) {
    confidence -= 0.12;
    issues.add("fragmented_segment_flow");
  }
  if ((candidate?.labelLikeRisk ?? 0) >= 0.6) {
    confidence -= 0.2;
    issues.add("candidate_label_like_risk");
  }
  if ((candidate?.translationRisk ?? 0) >= 0.6) {
    confidence -= 0.18;
    issues.add("candidate_translation_risk");
  }
  if (/(?:意思是|也就是|中文是|英文是)/u.test(segmentsToPlainText(input.response.segments))) {
    confidence -= 0.3;
    issues.add("possible_duplicated_translation");
  }

  confidence = Number(Math.max(0, Math.min(1, confidence)).toFixed(2));
  if (issues.size === 0) return undefined;
  const natural = confidence >= 0.75 && issues.size === 0;
  return {
    natural,
    confidence,
    issues: [...issues],
    suggestedAction: natural ? "accept" : input.attemptNumber === 1 ? "regenerate" : "use_no_fit",
    triggers: [...triggers],
    validatorVersion: EOE_NATURALNESS_VALIDATOR_VERSION,
  };
}
