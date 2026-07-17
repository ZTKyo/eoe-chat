import { segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type {
  NaturalnessReview,
  ResponseObligation,
  SoftQualityReview,
  TaskCompletenessReview,
  ValidationResult,
} from "@/domain/eoe";
import { reviewResponseDepth } from "./response-depth";

const hardCompletenessIssues = new Set([
  "empty_or_trivial_answer",
  "explicit_language_request_violated",
  "phrase_clarification_ambiguity_not_resolved",
  "phrase_clarification_context_error",
  "assistance_source_sentence_missing",
  "assistance_pronunciation_missing",
  "assistance_contextual_meaning_missing",
  "assistance_topic_resume_missing",
  "image_analysis_missing_grounded_observation",
  "image_analysis_missing_epistemic_boundary",
  "technical_any_behavior_missing",
  "technical_unknown_explanation_missing",
  "technical_core_difference_missing",
  "technical_concepts_incorrect_or_equated",
]);

export function isHardCompletenessIssue(issue: string): boolean {
  return hardCompletenessIssues.has(issue) ||
    issue.startsWith("image_analysis_missing_") ||
    issue.startsWith("technical_concept_missing:");
}

export function buildSoftQualityReview(input: {
  response: GeneratedResponse;
  completeness: TaskCompletenessReview;
  obligations: ResponseObligation[];
  naturalness?: NaturalnessReview;
  attemptNumber: 1 | 2;
}): SoftQualityReview {
  const warnings = input.completeness.issues.filter((issue) => !isHardCompletenessIssue(issue));
  if (input.naturalness) warnings.push(...input.naturalness.issues);
  const depthProfile = input.obligations.find((item) => item.responseDepthProfile)?.responseDepthProfile;
  if (depthProfile) {
    warnings.push(...reviewResponseDepth(
      segmentsToPlainText(input.response.segments),
      depthProfile,
    ).warnings);
  }
  const uniqueWarnings = [...new Set(warnings)];
  const confidence = Number(Math.max(
    0.35,
    0.98 - uniqueWarnings.length * 0.09,
  ).toFixed(2));
  return {
    acceptable: uniqueWarnings.length === 0,
    warnings: uniqueWarnings,
    confidence,
    retryRecommended: input.attemptNumber === 1 && uniqueWarnings.length > 0,
  };
}

export function hardCompletenessValidation(
  completeness: TaskCompletenessReview,
): ValidationResult {
  const hardIssues = completeness.issues.filter(isHardCompletenessIssue);
  if (hardIssues.length === 0) return { valid: true, violations: [], retryable: false };
  return {
    valid: false,
    violations: [
      { code: "task_incomplete", severity: "error", details: hardIssues.join(", ") },
      ...hardIssues.map((code) => ({ code, severity: "error" as const })),
    ],
    retryable: true,
  };
}

export function softQualityScore(input: {
  response: GeneratedResponse;
  taskCompleteness: TaskCompletenessReview;
  softQuality: SoftQualityReview;
}): number {
  const fulfilled = input.taskCompleteness.fulfilledObligationIds.length;
  const length = Math.min(1_200, segmentsToPlainText(input.response.segments).length);
  return fulfilled * 100 + input.softQuality.confidence * 50 + length * 0.02 - input.softQuality.warnings.length * 15;
}
