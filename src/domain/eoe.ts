import { z } from "zod";

export const conversationFunctions = [
  "answer",
  "react",
  "empathize",
  "advise",
  "explain",
  "clarify",
  "ask_follow_up",
  "summarize",
  "analyze_image",
  "complete_task",
] as const;

export const conversationFunctionSchema = z.enum(conversationFunctions);
export type ConversationFunction = z.infer<typeof conversationFunctionSchema>;

export const grammaticalRoles = [
  "discourse_marker",
  "adverbial",
  "reaction",
  "verb_phrase",
  "noun_phrase",
  "clause_stem",
  "clause",
] as const;
export const grammaticalRoleSchema = z.enum(grammaticalRoles);
export type GrammaticalRole = z.infer<typeof grammaticalRoleSchema>;

export const phrasePositions = ["sentence_start", "sentence_middle", "sentence_end", "standalone"] as const;
export const phrasePositionSchema = z.enum(phrasePositions);
export type PhrasePosition = z.infer<typeof phrasePositionSchema>;

export const naturalnessRiskSchema = z.number().min(0).max(1);
export const grammaticalFitSchema = z.enum(["high", "medium", "low"]);
export type GrammaticalFit = z.infer<typeof grammaticalFitSchema>;

export const conversationAnalysisSchema = z.object({
  primaryFunction: conversationFunctionSchema,
  secondaryFunction: conversationFunctionSchema.optional(),
  sensitivity: z.enum(["normal", "emotional", "high_stakes", "technical"]),
  responseLength: z.enum(["short", "medium", "long"]),
  overlaySuitability: z.enum(["high", "medium", "low", "none"]),
  confidence: z.number().min(0).max(1),
});
export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;

export const planRequirementsSchema = z.object({
  needsTimeline: z.boolean(),
  needsStages: z.boolean(),
  needsTasks: z.boolean(),
  needsPriority: z.boolean(),
  needsFeedbackLoop: z.boolean(),
});
export type PlanRequirements = z.infer<typeof planRequirementsSchema>;

export const comparisonDecisionRequirementsSchema = z.object({
  needsComparisonDimensions: z.boolean(),
  minimumDimensionCount: z.number().int().min(1).max(8),
  needsUserPriority: z.boolean(),
  needsTradeOff: z.boolean(),
  needsRecordingMethod: z.boolean(),
  needsReversibleTest: z.boolean(),
  needsNextAction: z.boolean(),
});
export type ComparisonDecisionRequirements = z.infer<typeof comparisonDecisionRequirementsSchema>;

export const explicitUserPremiseSchema = z.object({
  id: z.string().min(1),
  sourceText: z.string().min(1),
  kind: z.enum([
    "numeric",
    "time",
    "cost",
    "constraint",
    "preference",
    "comparison",
    "condition",
    "other",
  ]),
  normalizedValue: z.string().min(1).optional(),
  mustPreserve: z.boolean(),
});
export type ExplicitUserPremise = z.infer<typeof explicitUserPremiseSchema>;

export const premisePreservationReviewSchema = z.object({
  preservedPremiseIds: z.array(z.string().min(1)),
  omittedPremiseIds: z.array(z.string().min(1)),
  contradictedPremiseIds: z.array(z.string().min(1)),
  replacedPremiseIds: z.array(z.string().min(1)),
  valid: z.boolean(),
});
export type PremisePreservationReview = z.infer<typeof premisePreservationReviewSchema>;

export const technicalConceptComparisonRequirementsSchema = z.object({
  concepts: z.array(z.string().min(1)).min(2),
  needsCoreDifference: z.boolean(),
  needsSafetyDifference: z.boolean(),
  needsUsagePrecondition: z.boolean(),
  needsPracticalRecommendation: z.boolean(),
  needsExample: z.boolean().optional(),
});
export type TechnicalConceptComparisonRequirements = z.infer<
  typeof technicalConceptComparisonRequirementsSchema
>;

export const dailyAdviceRequirementsSchema = z.object({
  needsConcreteAction: z.boolean(),
  minimumActionCount: z.number().int().min(1).max(5),
  needsSequence: z.boolean(),
  needsTimeAnchor: z.boolean(),
  needsAdjustmentOption: z.boolean(),
});
export type DailyAdviceRequirements = z.infer<typeof dailyAdviceRequirementsSchema>;

export const responseDepthProfileSchema = z.object({
  level: z.enum(["brief", "standard", "detailed"]),
  namedFactors: z.array(z.string().min(1)),
  requiresInteractions: z.boolean(),
  minimumInteractionCount: z.number().int().min(0).max(8),
  requiresTradeOffs: z.boolean(),
  requiresConclusion: z.boolean(),
});
export type ResponseDepthProfile = z.infer<typeof responseDepthProfileSchema>;

export const temporaryOverlayPreferenceSchema = z.object({
  mode: z.enum(["normal", "reduced", "chinese_only"]),
  reason: z.enum(["user_difficulty", "explicit_chinese", "user_resume"]),
});
export type TemporaryOverlayPreference = z.infer<typeof temporaryOverlayPreferenceSchema>;

export const technicalSegmentRoles = [
  "code_identifier",
  "technical_term",
  "english_overlay",
  "vocabulary_assistance",
  "unsolicited_teaching",
] as const;
export const technicalSegmentRoleSchema = z.enum(technicalSegmentRoles);
export type TechnicalSegmentRole = z.infer<typeof technicalSegmentRoleSchema>;

export const responseObligationKinds = [
  "answer_question",
  "provide_reasons",
  "provide_steps",
  "provide_plan",
  "provide_daily_advice",
  "compare_options",
  "analyze_image",
  "explain_concept",
  "acknowledge_emotion",
  "respect_language_request",
  "clarify_prior_phrase",
  "continue_context",
  "contextual_acknowledgement",
  "provide_detailed_analysis",
  "other",
] as const;
export const responseObligationKindSchema = z.enum(responseObligationKinds);
export type ResponseObligationKind = z.infer<typeof responseObligationKindSchema>;

export const responseObligationSchema = z.object({
  id: z.string().min(1),
  kind: responseObligationKindSchema,
  description: z.string().min(1),
  required: z.boolean(),
  minimumEvidence: z.array(z.string().min(1)).optional(),
  planRequirements: planRequirementsSchema.optional(),
  comparisonRequirements: comparisonDecisionRequirementsSchema.optional(),
  dailyAdviceRequirements: dailyAdviceRequirementsSchema.optional(),
  responseDepthProfile: responseDepthProfileSchema.optional(),
  technicalTerms: z.array(z.string().min(1)).optional(),
  technicalComparisonRequirements: technicalConceptComparisonRequirementsSchema.optional(),
});
export type ResponseObligation = z.infer<typeof responseObligationSchema>;

export const taskCompletenessReviewSchema = z.object({
  complete: z.boolean(),
  confidence: z.number().min(0).max(1),
  fulfilledObligationIds: z.array(z.string().min(1)),
  missingObligationIds: z.array(z.string().min(1)),
  issues: z.array(z.string()),
  suggestedAction: z.enum(["accept", "regenerate"]),
  reviewVersion: z.string().min(1),
});
export type TaskCompletenessReview = z.infer<typeof taskCompletenessReviewSchema>;

export const overlayDecisionSchema = z.object({
  mode: z.enum(["preferred", "skip", "disabled_for_image"]),
  fixedLevel: z.number().int().min(1).max(7),
  effectiveLevel: z.number().int().min(1).max(7),
  maxNewFocus: z.number().int().min(0).max(1),
  maxEnglishSegments: z.number().int().min(0).max(2),
  reusePreferred: z.boolean(),
  candidateCount: z.number().int().nonnegative(),
  reasonCodes: z.array(z.string()),
  policyVersion: z.string().min(1),
});
export type OverlayDecision = z.infer<typeof overlayDecisionSchema>;

export const candidateSelectionSchema = z.object({
  candidates: z.array(
    z.object({
      phraseId: z.string().min(1),
      score: z.number(),
      reasons: z.array(z.string()),
      isReuse: z.boolean(),
      grammaticalFit: grammaticalFitSchema,
      insertionPosition: phrasePositionSchema,
      allowedPositions: z.array(phrasePositionSchema).min(1),
      bilingualCompatibility: z.number().min(0).max(1),
      punctuationRisk: naturalnessRiskSchema,
      translationRisk: naturalnessRiskSchema,
      labelLikeRisk: naturalnessRiskSchema,
      responseLengthFit: grammaticalFitSchema,
    }),
  ),
  selectedPhraseId: z.string().min(1).optional(),
  noFit: z.boolean(),
  selectorVersion: z.string().min(1),
});
export type CandidateSelection = z.infer<typeof candidateSelectionSchema>;

export const validationViolationSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["error", "warning"]),
  details: z.string().optional(),
});

export const validationResultSchema = z.object({
  valid: z.boolean(),
  violations: z.array(validationViolationSchema),
  retryable: z.boolean(),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

export const naturalnessReviewSchema = z.object({
  natural: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
  suggestedAction: z.enum(["accept", "regenerate", "use_no_fit"]),
  triggers: z.array(z.string()),
  validatorVersion: z.string().min(1),
});
export type NaturalnessReview = z.infer<typeof naturalnessReviewSchema>;

export const softQualityReviewSchema = z.object({
  acceptable: z.boolean(),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  retryRecommended: z.boolean(),
});
export type SoftQualityReview = z.infer<typeof softQualityReviewSchema>;

export const phraseSchema = z.object({
  id: z.string().min(1),
  canonical: z.string().min(1),
  variants: z.array(z.string().min(1)),
  level: z.number().int().min(1).max(7),
  difficulty: z.number().int().min(1).max(10),
  frequencyRank: z.number().int().positive(),
  reuseValue: z.number().min(0).max(1),
  conversationFunctions: z.array(conversationFunctionSchema).min(1),
  semanticTags: z.array(z.string().min(1)),
  compatibleTones: z.array(z.string().min(1)),
  contextualHints: z.array(z.string().min(1)),
  pronunciation: z.string().min(1),
  baseMeaningZh: z.string().min(1),
  optionalShortExample: z.string().min(1).optional(),
  cooldownTurns: z.number().int().nonnegative(),
  grammaticalRole: grammaticalRoleSchema,
  preferredPositions: z.array(phrasePositionSchema).min(1),
  requiresSubject: z.boolean(),
  requiresCopula: z.boolean(),
  canStandAlone: z.boolean(),
  punctuationCompatibility: z.array(z.string().min(1)).min(1),
  bilingualPatterns: z.array(z.string().min(1)),
  unsafePatterns: z.array(z.string().min(1)),
  bilingualCompatibility: z.number().min(0).max(1),
  punctuationRisk: naturalnessRiskSchema,
  translationRisk: naturalnessRiskSchema,
  labelLikeRisk: naturalnessRiskSchema,
  status: z.enum(["active", "disabled"]),
  registryVersion: z.string().min(1),
});
export type Phrase = z.infer<typeof phraseSchema>;

export const noFitReasons = [
  "phrase_not_natural",
  "conversation_too_short",
  "sensitive_context",
  "technical_complexity",
  "no_safe_candidate",
  "explicit_chinese_request",
  "user_requested_lower_difficulty",
  "grammar_mismatch",
  "position_mismatch",
  "translation_risk",
  "label_like_risk",
  "image_overlay_deferred",
  "other",
] as const;
export const noFitReasonSchema = z.enum(noFitReasons);
export type NoFitReason = z.infer<typeof noFitReasonSchema>;

export const noFitDecisionSources = [
  "scheduler_no_fit",
  "selector_no_candidate",
  "provider_phrase_rejected",
  "high_stakes_no_fit",
  "explicit_chinese_no_fit",
  "short_turn_no_fit",
  "contextual_no_fit",
  "image_overlay_deferred",
] as const;
export const noFitDecisionSourceSchema = z.enum(noFitDecisionSources);
export type NoFitDecisionSource = z.infer<typeof noFitDecisionSourceSchema>;

export const visionObservationEnvelopeV1Schema = z.strictObject({
  schemaVersion: z.literal("eoe.vision-observation.v1"),
  observations: z.array(z.strictObject({
    description: z.string().trim().min(1),
    confidence: z.enum(["high", "medium", "low"]),
  })).min(1),
  visibleText: z.array(z.string().trim().min(1)),
  uncertainties: z.array(z.string().trim().min(1)),
});
export type VisionObservationEnvelopeV1 = z.infer<typeof visionObservationEnvelopeV1Schema>;

export const userPhraseReuseOpportunitySchema = z.object({
  phraseId: z.string().min(1),
  matchedText: z.string().min(1),
  confidence: z.number().min(0).max(1),
  source: z.enum(["exact", "normalized_variant"]),
});
export type UserPhraseReuseOpportunity = z.infer<typeof userPhraseReuseOpportunitySchema>;

export const realizationPositions = ["sentence_start", "sentence_middle", "sentence_end"] as const;
export const realizationPositionSchema = z.enum(realizationPositions);
export type RealizationPosition = z.infer<typeof realizationPositionSchema>;

export const betaBilingualFrameTypes = [
  "standalone_reaction",
  "sentence_initial_connector",
  "english_clause_stem",
  "user_phrase_reuse",
] as const;
export const betaBilingualFrameTypeSchema = z.enum(betaBilingualFrameTypes);
export type BetaBilingualFrameType = z.infer<typeof betaBilingualFrameTypeSchema>;

export const betaBilingualFrameProfileSchema = z.strictObject({
  phraseId: z.string().min(1),
  autoLiveSafe: z.boolean(),
  allowedFrameTypes: z.array(betaBilingualFrameTypeSchema).min(1),
  allowedFrames: z.array(z.string().min(1)),
  forbiddenFrames: z.array(z.string().min(1)),
  requiresFollowingClause: z.boolean(),
  capitalizationPolicy: z.string().min(1),
  punctuationPolicy: z.string().min(1),
});
export type BetaBilingualFrameProfile = z.infer<typeof betaBilingualFrameProfileSchema>;

export const phraseRealizationProfileSchema = z.strictObject({
  phraseId: z.string().min(1),
  bilingualSafety: z.enum(["high", "medium", "low"]),
  grammaticalRole: z.enum([
    "discourse_marker",
    "stance_marker",
    "adverbial",
    "predicate_complement",
    "clause_frame",
    "other",
  ]),
  allowedPositions: z.array(realizationPositionSchema).min(1),
  forbiddenPatterns: z.array(z.string()),
  forbiddenBeforePunctuation: z.array(z.string()),
  forbiddenAfterPunctuation: z.array(z.string()),
  requiresChineseConnectorBefore: z.boolean(),
  requiresChineseConnectorAfter: z.boolean(),
  canBeWholeClause: z.boolean(),
  requiresClauseSupport: z.boolean(),
  requiresFollowUpContent: z.boolean(),
  canBeStandaloneReaction: z.boolean(),
  canStartChineseSentence: z.boolean(),
  canAppearAfterChineseSubject: z.boolean(),
  canAppearBeforeChinesePredicate: z.boolean(),
  preferredFunctions: z.array(conversationFunctionSchema),
  excludedFunctions: z.array(conversationFunctionSchema),
  labelLikeRisk: naturalnessRiskSchema,
  translationRisk: naturalnessRiskSchema,
  taskReplacementRisk: naturalnessRiskSchema,
  capitalizeAtSentenceStart: z.boolean(),
  liveSafe: z.boolean(),
  betaFrame: betaBilingualFrameProfileSchema,
  realizationVersion: z.string().min(1),
});
export type PhraseRealizationProfile = z.infer<typeof phraseRealizationProfileSchema>;

export const mockScenarios = [
  "valid_no_fit",
  "valid_english_chunk",
  "invalid_phrase_id",
  "automatic_gloss",
  "teacher_mode",
  "overlay_budget_exceeded",
  "broken_json",
  "missing_envelope_field",
  "unexpected_segments_array",
  "retry_then_success",
  "double_failure",
  "provider_retryable_error",
  "provider_non_retryable_error",
  "no_fit_chunk_conflict",
  "phrase_id_mismatch",
  "markdown_wrapped_json",
  "unexpected_extra_field",
  "invalid_confidence",
  "valid_template_start",
  "valid_template_middle",
  "valid_template_no_fit",
  "template_missing_placeholder",
  "template_duplicate_placeholder",
  "template_unexpected_placeholder",
  "template_use_phrase_conflict",
  "template_missing_no_fit_reason",
  "template_unexpected_no_fit_reason",
  "template_empty_response",
  "template_html",
  "template_label_like",
  "template_isolated_placeholder",
  "template_colon_explanation",
  "template_translation_duplication",
  "template_position_violation",
  "template_punctuation_violation",
  "template_full_english_takeover",
  "template_teacher_mode",
  "template_internal_prompt_leak",
  "template_old_control_fields",
  "template_retry_then_success",
  "template_double_failure",
  "task_incomplete_then_success",
  "task_incomplete_double_failure",
] as const;
export const mockScenarioSchema = z.enum(mockScenarios);
export type MockScenario = z.infer<typeof mockScenarioSchema>;

const usageSchema = z.object({
  promptTokens: z.number().nonnegative().optional(),
  completionTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
});

export const providerPipelineStages = [
  "provider_text_extraction",
  "json_object_extraction",
  "provider_envelope_parse",
  "provider_envelope_semantics",
  "provider_template_parse",
  "provider_template_semantics",
  "template_validator",
  "template_mapper",
  "deterministic_mapper",
  "domain_schema",
  "domain_validator",
  "task_completeness_validator",
  "vision_observation_parse",
  "assistance_content_parse",
  "naturalness_validator",
  "provider_error",
] as const;
export const providerPipelineStageSchema = z.enum(providerPipelineStages);
export type ProviderPipelineStage = z.infer<typeof providerPipelineStageSchema>;

export const pipelineDiagnosticSchema = z.object({
  stage: providerPipelineStageSchema,
  code: z.string().min(1),
  path: z.string().optional(),
  details: z.string().optional(),
});
export type PipelineDiagnostic = z.infer<typeof pipelineDiagnosticSchema>;

const pipelineStepStatusSchema = z.enum(["passed", "failed", "not_reached"]);
export const generationPipelineSchema = z.object({
  envelopeParse: pipelineStepStatusSchema.optional(),
  envelopeSemantics: pipelineStepStatusSchema.optional(),
  templateParse: pipelineStepStatusSchema.optional(),
  templateSemantics: pipelineStepStatusSchema.optional(),
  templateValidator: pipelineStepStatusSchema.optional(),
  mapper: pipelineStepStatusSchema,
  domainSchema: pipelineStepStatusSchema,
  domainValidator: pipelineStepStatusSchema,
  taskCompleteness: pipelineStepStatusSchema.optional(),
});
export type GenerationPipeline = z.infer<typeof generationPipelineSchema>;

export const generationAttemptDiagnosticSchema = z.object({
  id: z.string().min(1),
  attemptNumber: z.number().int().min(1).max(2),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  requestId: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  usage: usageSchema.optional(),
  providerFallbackUsed: z.boolean(),
  validatorRetry: z.boolean(),
  outcome: z.enum(["valid", "invalid", "provider_error"]),
  validation: validationResultSchema,
  naturalness: naturalnessReviewSchema.optional(),
  softQuality: softQualityReviewSchema.optional(),
  errorCategory: z.string().optional(),
  pipelineStage: providerPipelineStageSchema.optional(),
  pipelineDiagnostics: z.array(pipelineDiagnosticSchema).optional(),
  pipeline: generationPipelineSchema.optional(),
  providerOutputPreview: z.string().max(4_000).optional(),
});
export type GenerationAttemptDiagnostic = z.infer<typeof generationAttemptDiagnosticSchema>;

export const responseExecutionSources = [
  "provider_generated",
  "engine_owned_resolution",
  "engine_owned_acknowledgement",
  "engine_owned_assistance_fallback",
  "natural_fallback",
] as const;
export const responseExecutionSourceSchema = z.enum(responseExecutionSources);
export type ResponseExecutionSource = z.infer<typeof responseExecutionSourceSchema>;

export const engineDiagnosticsSchema = z.object({
  analysis: conversationAnalysisSchema,
  responseObligations: z.array(responseObligationSchema),
  taskCompleteness: taskCompletenessReviewSchema,
  decision: overlayDecisionSchema,
  selection: candidateSelectionSchema,
  attempts: z.array(generationAttemptDiagnosticSchema).max(2),
  finalValidation: validationResultSchema,
  naturalness: naturalnessReviewSchema.optional(),
  softQualityReview: softQualityReviewSchema.optional(),
  displayedWithSoftQualityWarning: z.boolean().optional(),
  explicitUserPremises: z.array(explicitUserPremiseSchema).optional(),
  premisePreservationReview: premisePreservationReviewSchema.optional(),
  responseExecutionSource: responseExecutionSourceSchema,
  noFit: z.boolean(),
  noFitDecisionSource: noFitDecisionSourceSchema.optional(),
  noFitReason: noFitReasonSchema.optional(),
  userEnglishReuseOpportunity: z.boolean(),
  userPhraseReuseOpportunity: userPhraseReuseOpportunitySchema.optional(),
  realizedPhrasePosition: realizationPositionSchema.optional(),
  phraseRealizationProfile: phraseRealizationProfileSchema.optional(),
  temporaryOverlayPreference: temporaryOverlayPreferenceSchema.optional(),
  contextualAcknowledgement: z.object({
    active: z.boolean(),
    priorTopic: z.string().optional(),
  }).optional(),
  assistance: z.object({
    active: z.boolean(),
    trigger: z.enum(["click", "long_press", "meaning", "pronunciation", "clarification"]),
    resolved: z.boolean(),
    sourceMessageId: z.string().optional(),
    sourceSegmentIndex: z.number().int().nonnegative().optional(),
    phraseId: z.string().optional(),
    contextVersion: z.literal("eoe.assistance-context.v2").optional(),
    assistanceContentFallback: z.boolean().optional(),
    providerContentPass: z.boolean().optional(),
    referenceStatus: z.enum(["resolved", "ambiguous", "not_found"]).optional(),
    ambiguousCandidatePhraseIds: z.array(z.string().min(1)).optional(),
    engineOwnedClarification: z.boolean().optional(),
  }).optional(),
  visionObservation: z.object({
    envelope: visionObservationEnvelopeV1Schema.optional(),
    valid: z.boolean(),
    providerId: z.string().min(1),
    modelId: z.string().min(1),
    requestId: z.string().min(1),
    latencyMs: z.number().nonnegative(),
    usage: usageSchema.optional(),
    fallbackUsed: z.boolean(),
    violationCodes: z.array(z.string()),
    providerOutputPreview: z.string().max(4_000).optional(),
  }).optional(),
  benchmarkType: z.enum(["production", "structural", "live_evidence"]),
  naturalnessEvidence: z.enum(["none", "structural_only", "independent_human_pending"]),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  totalLatencyMs: z.number().nonnegative(),
  totalUsage: usageSchema.optional(),
  fallbackUsed: z.boolean(),
  naturalFallbackUsed: z.boolean(),
  policyVersion: z.string().min(1),
  registryVersion: z.string().min(1),
  selectorVersion: z.string().min(1),
  directiveVersion: z.string().min(1),
  validatorVersion: z.string().min(1),
  providerTemplateSchemaVersion: z.string().min(1),
  realizationPolicyVersion: z.string().min(1),
  templateValidatorVersion: z.string().min(1),
  assistanceContentSchemaVersion: z.literal("eoe.assistance-content.v2").optional(),
  visionObservationSchemaVersion: z.literal("eoe.vision-observation.v1").optional(),
  developerMode: z.boolean(),
});
export type EngineDiagnostics = z.infer<typeof engineDiagnosticsSchema>;
