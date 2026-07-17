import { generatedResponseSchema, plainTextSegment, type ChatRequest, type ChatResponse, type GeneratedResponse } from "@/domain/chat";
import type {
  CandidateSelection,
  ConversationAnalysis,
  EngineDiagnostics,
  GenerationAttemptDiagnostic,
  GenerationPipeline,
  NaturalnessReview,
  NoFitReason,
  Phrase,
  PhraseRealizationProfile,
  PipelineDiagnostic,
  PremisePreservationReview,
  RealizationPosition,
  TaskCompletenessReview,
  ValidationResult,
  OverlayDecision,
  ResponseObligation,
  SoftQualityReview,
} from "@/domain/eoe";
import { createId } from "@/lib/ids";
import type { GatewayResult, ProviderGateway } from "@/lib/providers/gateway";
import { ProviderError } from "@/lib/providers/types";
import { selectCandidates } from "./candidate-selector";
import { analyzeConversation } from "./conversation-analyzer";
import {
  EOE_DIRECTIVE_VERSION,
  EOE_POLICY_VERSION,
  EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
  EOE_REALIZATION_POLICY_VERSION,
  EOE_SELECTOR_VERSION,
  EOE_TEMPLATE_VALIDATOR_VERSION,
  EOE_VALIDATOR_VERSION,
} from "./constants";
import type { EoeConfig } from "./config";
import { buildDirective } from "./directive-builder";
import { resolveConversationContext } from "./conversation-context";
import { validateContextContinuity } from "./context-continuity";
import { createNaturalFallback } from "./natural-fallback";
import { deriveNoFitPolicy } from "./no-fit";
import { mapProviderTemplateToDomain } from "./provider-template/mapper";
import { parseProviderResponseTemplate } from "./provider-template/parser";
import { PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA } from "./provider-template/schema";
import { validateProviderResponseTemplate } from "./provider-template/validator";
import { REGISTRY_VERSION, getPhraseById } from "./registry/phrase-registry";
import {
  LIVE_SAFE_PHRASES,
  LIVE_SAFE_REALIZATION_PROFILE_MAP,
  getAssistanceRealizationProfile,
  getPhraseRealizationProfile,
  realizePhraseSurface,
} from "./registry/phrase-realization";
import { scheduleOverlay } from "./scheduler";
import { reviewNaturalness, type NaturalnessMode } from "./soft-naturalness-validator";
import {
  buildSoftQualityReview,
  hardCompletenessValidation,
  softQualityScore,
} from "./soft-quality-review";
import { analyzeResponseObligations, reviewTaskCompleteness } from "./task-completeness";
import { validateQuantitativeClaims } from "./quantitative-claim";
import {
  extractExplicitUserPremises,
  reviewPremisePreservation,
  validatePremisePreservation,
} from "./explicit-user-premise";
import { validateStructuredResponse } from "./validator";
import { phrasePronunciation } from "./vocabulary-assistance";
import {
  buildAssistanceDirective,
  buildAssistanceResponse,
  engineAssistanceFallbackContent,
  parseAssistanceContent,
  validateAssistanceContent,
  VOCABULARY_ASSISTANCE_CONTENT_JSON_SCHEMA,
  type VocabularyAssistanceContextV2,
} from "./assistance-v2";
import type { ConversationContext } from "./conversation-context";
import {
  buildVisionObservationDirective,
  parseVisionObservation,
  VISION_OBSERVATION_JSON_SCHEMA,
} from "./vision-observation";

export interface EngineRunResult {
  response: GeneratedResponse;
  provider: ChatResponse["provider"];
  diagnostics: EngineDiagnostics;
}

interface HardValidCandidate {
  response: GeneratedResponse;
  taskCompleteness: TaskCompletenessReview;
  naturalness?: NaturalnessReview;
  softQuality: SoftQualityReview;
  premisePreservation: PremisePreservationReview;
  noFitReason?: NoFitReason;
  realizedPhrasePosition?: RealizationPosition;
}

function invalidResult(code: string, details?: string, retryable = true): ValidationResult {
  return { valid: false, violations: [{ code, severity: "error", details }], retryable };
}

function emptyPipeline(): GenerationPipeline {
  return {
    templateParse: "not_reached",
    templateSemantics: "not_reached",
    templateValidator: "not_reached",
    mapper: "not_reached",
    domainSchema: "not_reached",
    domainValidator: "not_reached",
    taskCompleteness: "not_reached",
  };
}

function assistanceSelection(phrase: Phrase, profile: PhraseRealizationProfile): CandidateSelection {
  return {
    candidates: [{
      phraseId: phrase.id,
      score: 100,
      reasons: ["explicit_vocabulary_assistance", "history_resolved", "reuse_opportunity"],
      isReuse: true,
      grammaticalFit: "high",
      insertionPosition: profile.allowedPositions[0] ?? "sentence_middle",
      allowedPositions: profile.allowedPositions,
      bilingualCompatibility: 1,
      punctuationRisk: phrase.punctuationRisk,
      translationRisk: profile.translationRisk,
      labelLikeRisk: profile.labelLikeRisk,
      responseLengthFit: "high",
    }],
    selectedPhraseId: phrase.id,
    noFit: false,
    selectorVersion: EOE_SELECTOR_VERSION,
  };
}

function completenessValidation(
  review: TaskCompletenessReview,
  response: GeneratedResponse,
): ValidationResult {
  if (review.complete) return { valid: true, violations: [], retryable: false };
  const violations: ValidationResult["violations"] = [
    { code: "task_incomplete", severity: "error", details: review.issues.join(", ") },
    ...review.missingObligationIds.map((id) => ({
      code: "response_obligation_missing",
      severity: "error" as const,
      details: id,
    })),
  ];
  if (review.issues.some((issue) => [
    "missing_timeline",
    "missing_stage_structure",
    "missing_task_assignment",
    "missing_priority",
    "missing_feedback_loop",
  ].includes(issue))) {
    violations.push({ code: "plan_not_actionable", severity: "error" });
    violations.push(...review.issues
      .filter((issue) => [
        "missing_timeline",
        "missing_stage_structure",
        "missing_task_assignment",
        "missing_priority",
        "missing_feedback_loop",
      ].includes(issue))
      .map((code) => ({ code, severity: "error" as const })));
  }
  const comparisonIssueCodes = [
    "missing_comparison_dimensions",
    "missing_user_priority",
    "missing_trade_off",
    "missing_recording_method",
    "missing_reversible_test",
    "missing_next_action",
  ];
  if (review.issues.some((issue) => comparisonIssueCodes.includes(issue))) {
    violations.push({ code: "comparison_not_actionable", severity: "error" });
    violations.push(...review.issues
      .filter((issue) => comparisonIssueCodes.includes(issue))
      .map((code) => ({ code, severity: "error" as const })));
  }
  const dailyAdviceIssueCodes = [
    "missing_concrete_action",
    "missing_action_assignment",
    "missing_start_condition",
    "missing_adjustment_option",
  ];
  if (review.issues.some((issue) => dailyAdviceIssueCodes.includes(issue))) {
    violations.push({ code: "daily_advice_not_actionable", severity: "error" });
    violations.push(...review.issues
      .filter((issue) => dailyAdviceIssueCodes.includes(issue))
      .map((code) => ({ code, severity: "error" as const })));
  }
  const technicalIssueCodes = [
    "technical_any_behavior_missing",
    "technical_unknown_narrowing_missing",
  ];
  if (review.issues.some((issue) => technicalIssueCodes.includes(issue))) {
    violations.push({ code: "technical_distinction_incomplete", severity: "error" });
    violations.push(...review.issues
      .filter((issue) => technicalIssueCodes.includes(issue))
      .map((code) => ({ code, severity: "error" as const })));
  }
  if (review.issues.some((issue) => issue.startsWith("image_analysis_missing_"))) {
    violations.push({ code: "image_analysis_missing_visual_evidence", severity: "error" });
  }
  if (review.issues.some((issue) => issue.includes("phrase_clarification") || issue.startsWith("assistance_"))) {
    violations.push({ code: "phrase_clarification_context_error", severity: "error" });
  }
  if (response.segments.some((segment) => segment.type === "english_chunk")) {
    violations.push({ code: "overlay_replaced_core_answer", severity: "error" });
  }
  return { valid: false, violations, retryable: true };
}

function diagnosticsToValidation(diagnostics: PipelineDiagnostic[]): ValidationResult {
  return {
    valid: false,
    violations: diagnostics.map((item) => ({
      code: item.code,
      severity: "error" as const,
      details: [item.path ? `path=${item.path}` : undefined, item.details].filter(Boolean).join("; ") || undefined,
    })),
    retryable: true,
  };
}

function sumUsage(attempts: GenerationAttemptDiagnostic[]): EngineDiagnostics["totalUsage"] {
  const used = attempts.filter((attempt) => attempt.usage);
  if (used.length === 0) return undefined;
  return {
    promptTokens: used.reduce((sum, attempt) => sum + (attempt.usage?.promptTokens ?? 0), 0),
    completionTokens: used.reduce((sum, attempt) => sum + (attempt.usage?.completionTokens ?? 0), 0),
    totalTokens: used.reduce((sum, attempt) => sum + (attempt.usage?.totalTokens ?? 0), 0),
  };
}

function benchmarkType(input: {
  request: ChatRequest;
  naturalnessMode?: NaturalnessMode;
}): EngineDiagnostics["benchmarkType"] {
  return input.request.engineState?.benchmarkType ??
    (input.naturalnessMode === "benchmark" ? "structural" : input.naturalnessMode === "live" ? "live_evidence" : "production");
}

function acknowledgementTopicLabel(priorTopic?: string): string | undefined {
  const normalized = priorTopic?.replace(/\s+/gu, " ").trim().replace(/[。！？!?]+$/u, "");
  if (!normalized) return undefined;
  const withoutSpeaker = normalized
    .replace(/^(?:我|我们)(?:想|准备|打算|需要)?(?:先)?/u, "")
    .replace(/^(?:请|麻烦|帮我|能不能|可以)/u, "")
    .trim();
  return withoutSpeaker || normalized;
}

function runContextualAcknowledgement(input: {
  request: ChatRequest;
  analysis: ConversationAnalysis;
  decision: OverlayDecision;
  selection: CandidateSelection;
  obligations: ResponseObligation[];
  context: ConversationContext;
  developerMode: boolean;
  naturalnessMode?: NaturalnessMode;
}): EngineRunResult {
  const latestUser = [...input.request.messages].reverse()
    .find((message) => message.role === "user")?.content.trim() ?? "";
  const lead = /^(?:哦|嗯|明白了)/u.test(latestUser) ? "明白了" : "好";
  const topic = acknowledgementTopicLabel(
    input.context.contextualAcknowledgement?.priorTopic,
  );
  const content = topic
    ? `${lead}，先按刚才这一步做；需要继续时，我们再处理“${topic}”。`
    : `${lead}，我们继续刚才的话题。`;
  const response = generatedResponseSchema.parse({
    schemaVersion: "eoe.response.v2",
    policyVersion: EOE_POLICY_VERSION,
    conversationFunction: input.analysis.primaryFunction,
    segments: [plainTextSegment(content)],
    usedPhraseIds: [],
    noFit: true,
    intentPreserved: true,
  });
  const finalValidation = validateStructuredResponse(response, {
    analysis: input.analysis,
    decision: input.decision,
    selection: input.selection,
    assistanceActive: false,
  }).result;
  const taskCompleteness = reviewTaskCompleteness({
    response,
    obligations: input.obligations,
    analysis: input.analysis,
    context: input.context,
  });
  const type = benchmarkType(input);
  const requestId = createId("engine-context");
  const diagnostics: EngineDiagnostics = {
    analysis: input.analysis,
    responseObligations: input.obligations,
    taskCompleteness,
    decision: input.decision,
    selection: input.selection,
    attempts: [],
    finalValidation,
    displayedWithSoftQualityWarning: false,
    responseExecutionSource: "engine_owned_acknowledgement",
    noFit: true,
    noFitDecisionSource: "contextual_no_fit",
    noFitReason: "conversation_too_short",
    userEnglishReuseOpportunity: input.context.userEnglishReuseOpportunity,
    userPhraseReuseOpportunity: input.context.userPhraseReuseOpportunity,
    temporaryOverlayPreference: input.context.temporaryOverlayPreference ?? {
      mode: "normal",
      reason: "user_resume",
    },
    contextualAcknowledgement: input.context.contextualAcknowledgement ?? {
      active: true,
    },
    benchmarkType: type,
    naturalnessEvidence: type === "structural"
      ? "structural_only"
      : type === "live_evidence"
        ? "independent_human_pending"
        : "none",
    providerId: "engine-context",
    modelId: "contextual-acknowledgement-v1",
    totalLatencyMs: 0,
    fallbackUsed: false,
    naturalFallbackUsed: false,
    policyVersion: EOE_POLICY_VERSION,
    registryVersion: REGISTRY_VERSION,
    selectorVersion: EOE_SELECTOR_VERSION,
    directiveVersion: EOE_DIRECTIVE_VERSION,
    validatorVersion: EOE_VALIDATOR_VERSION,
    providerTemplateSchemaVersion: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
    realizationPolicyVersion: EOE_REALIZATION_POLICY_VERSION,
    templateValidatorVersion: EOE_TEMPLATE_VALIDATOR_VERSION,
    developerMode: input.developerMode,
  };
  return {
    response,
    provider: {
      providerId: diagnostics.providerId,
      modelId: diagnostics.modelId,
      fallbackUsed: false,
      requestId,
      latencyMs: 0,
    },
    diagnostics,
  };
}

function runAmbiguousPhraseClarification(input: {
  request: ChatRequest;
  analysis: ConversationAnalysis;
  decision: OverlayDecision;
  selection: CandidateSelection;
  obligations: ResponseObligation[];
  context: ConversationContext;
  developerMode: boolean;
  naturalnessMode?: NaturalnessMode;
}): EngineRunResult {
  const resolution = input.context.assistance?.referenceResolution;
  if (!resolution || resolution.status !== "ambiguous") {
    throw new Error("Ambiguous Phrase clarification requires an ambiguous reference");
  }
  const surfaces = resolution.candidates.map((candidate) => `“${candidate.canonical}”`);
  const list = surfaces.length === 2
    ? surfaces.join(" 还是 ")
    : `${surfaces.slice(0, -1).join("、")}，还是 ${surfaces.at(-1)}`;
  const response = generatedResponseSchema.parse({
    schemaVersion: "eoe.response.v2",
    policyVersion: EOE_POLICY_VERSION,
    conversationFunction: input.analysis.primaryFunction,
    segments: [plainTextSegment(`刚才出现了不止一个英文短语。你指的是哪一个：${list}？`)],
    usedPhraseIds: [],
    noFit: true,
    intentPreserved: true,
  });
  const finalValidation = validateStructuredResponse(response, {
    analysis: input.analysis,
    decision: input.decision,
    selection: input.selection,
    assistanceActive: false,
  }).result;
  const taskCompleteness = reviewTaskCompleteness({
    response,
    obligations: input.obligations,
    analysis: input.analysis,
    context: input.context,
  });
  const type = benchmarkType(input);
  const requestId = createId("engine-context");
  const diagnostics: EngineDiagnostics = {
    analysis: input.analysis,
    responseObligations: input.obligations,
    taskCompleteness,
    decision: input.decision,
    selection: input.selection,
    attempts: [],
    finalValidation,
    displayedWithSoftQualityWarning: false,
    responseExecutionSource: "engine_owned_resolution",
    noFit: true,
    noFitDecisionSource: "contextual_no_fit",
    noFitReason: "other",
    userEnglishReuseOpportunity: input.context.userEnglishReuseOpportunity,
    userPhraseReuseOpportunity: input.context.userPhraseReuseOpportunity,
    temporaryOverlayPreference: input.context.temporaryOverlayPreference ?? { mode: "normal", reason: "user_resume" },
    contextualAcknowledgement: input.context.contextualAcknowledgement ?? { active: false },
    assistance: {
      active: true,
      trigger: input.context.assistance?.trigger ?? "clarification",
      resolved: false,
      referenceStatus: "ambiguous",
      ambiguousCandidatePhraseIds: resolution.candidates.map((candidate) => candidate.phraseId),
      engineOwnedClarification: true,
    },
    benchmarkType: type,
    naturalnessEvidence: type === "structural"
      ? "structural_only"
      : type === "live_evidence"
        ? "independent_human_pending"
        : "none",
    providerId: "engine-context",
    modelId: "phrase-reference-resolution-v1",
    totalLatencyMs: 0,
    fallbackUsed: false,
    naturalFallbackUsed: false,
    policyVersion: EOE_POLICY_VERSION,
    registryVersion: REGISTRY_VERSION,
    selectorVersion: EOE_SELECTOR_VERSION,
    directiveVersion: EOE_DIRECTIVE_VERSION,
    validatorVersion: EOE_VALIDATOR_VERSION,
    providerTemplateSchemaVersion: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
    realizationPolicyVersion: EOE_REALIZATION_POLICY_VERSION,
    templateValidatorVersion: EOE_TEMPLATE_VALIDATOR_VERSION,
    developerMode: input.developerMode,
  };
  return {
    response,
    provider: {
      providerId: diagnostics.providerId,
      modelId: diagnostics.modelId,
      fallbackUsed: false,
      requestId,
      latencyMs: 0,
    },
    diagnostics,
  };
}

async function runAssistanceV2(input: {
  request: ChatRequest;
  gateway: ProviderGateway;
  signal?: AbortSignal;
  analysis: ConversationAnalysis;
  decision: OverlayDecision;
  selection: CandidateSelection;
  obligations: ResponseObligation[];
  context: ConversationContext;
  assistance: VocabularyAssistanceContextV2;
  phrase: Phrase;
  developerMode: boolean;
  naturalnessMode?: NaturalnessMode;
}): Promise<EngineRunResult> {
  const attempts: GenerationAttemptDiagnostic[] = [];
  let lastResult: GatewayResult | undefined;
  let finalResponse: GeneratedResponse | undefined;
  let finalValidation: ValidationResult = invalidResult("assistance_content_unavailable");
  let finalCompleteness: TaskCompletenessReview | undefined;
  let previousCodes: string[] = [];

  for (const attemptNumber of [1, 2] as const) {
    const attemptId = createId("attempt");
    const requestId = createId("req");
    const pipeline = emptyPipeline();
    const started = performance.now();
    try {
      const result = await input.gateway.generate({
        messages: [
          { role: "system", content: buildAssistanceDirective(input.assistance, previousCodes) },
          ...input.request.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
        attachments: [],
        requestId,
        signal: input.signal,
        responseFormat: "json_schema",
        responseJsonSchema: {
          name: "eoe_assistance_content_v2",
          schema: VOCABULARY_ASSISTANCE_CONTENT_JSON_SCHEMA,
          strict: true,
        },
        generationAttempt: attemptNumber,
        mockScenario: input.request.engineState?.mockScenario,
        eoeContext: { assistanceV2: input.assistance },
      });
      lastResult = result;
      const content = parseAssistanceContent(result.content);
      let validation: ValidationResult;
      let response: GeneratedResponse | undefined;
      let completeness: TaskCompletenessReview | undefined;
      if (!content) {
        validation = invalidResult("assistance_content_parse_failed");
        pipeline.templateParse = "not_reached";
      } else if (validateAssistanceContent(input.assistance, content).length > 0) {
        const codes = validateAssistanceContent(input.assistance, content);
        validation = {
          valid: false,
          violations: codes.map((code) => ({ code, severity: "error" as const })),
          retryable: true,
        };
        pipeline.templateParse = "passed";
      } else {
        response = buildAssistanceResponse({
          context: input.assistance,
          content,
          analysis: input.analysis,
          generationAttemptId: attemptId,
        });
        pipeline.mapper = "passed";
        pipeline.domainSchema = "passed";
        const hard = validateStructuredResponse(response, {
          analysis: input.analysis,
          decision: input.decision,
          selection: input.selection,
          assistanceActive: true,
        });
        pipeline.domainValidator = hard.result.valid ? "passed" : "failed";
        if (!hard.result.valid || !hard.response) {
          validation = hard.result;
        } else {
          completeness = reviewTaskCompleteness({
            response: hard.response,
            obligations: input.obligations,
            analysis: input.analysis,
            context: input.context,
          });
          pipeline.taskCompleteness = completeness.complete ? "passed" : "failed";
          validation = completenessValidation(completeness, hard.response);
          if (validation.valid) response = hard.response;
        }
      }
      const pipelineStage = !content
        ? "assistance_content_parse" as const
        : validation.valid
          ? "domain_validator" as const
          : pipeline.taskCompleteness === "failed"
            ? "task_completeness_validator" as const
            : "domain_validator" as const;
      attempts.push({
        id: attemptId,
        attemptNumber,
        providerId: result.providerId,
        modelId: result.modelId,
        requestId: result.requestId,
        latencyMs: result.latencyMs,
        usage: result.usage,
        providerFallbackUsed: result.fallbackUsed,
        validatorRetry: attemptNumber === 2,
        outcome: validation.valid ? "valid" : "invalid",
        validation,
        pipelineStage,
        pipelineDiagnostics: validation.violations.map((item) => ({ stage: pipelineStage, code: item.code, details: item.details })),
        pipeline,
        providerOutputPreview: result.content.slice(0, 4_000),
      });
      finalCompleteness = completeness;
      finalValidation = validation;
      previousCodes = validation.violations.map((item) => item.code);
      if (validation.valid && response) {
        finalResponse = response;
        break;
      }
    } catch (error) {
      const providerError = error instanceof ProviderError
        ? error
        : new ProviderError(error instanceof Error ? error.message : "Provider failure", "unknown", false);
      const validation = invalidResult("provider_error", providerError.category, providerError.retryable);
      attempts.push({
        id: attemptId,
        attemptNumber,
        providerId: "unavailable",
        modelId: "unavailable",
        requestId,
        latencyMs: Math.round(performance.now() - started),
        providerFallbackUsed: false,
        validatorRetry: attemptNumber === 2,
        outcome: "provider_error",
        validation,
        errorCategory: providerError.category,
        pipelineStage: "provider_error",
        pipelineDiagnostics: [{ stage: "provider_error", code: "provider_error", details: providerError.category }],
        pipeline,
      });
      finalValidation = validation;
      previousCodes = ["provider_error"];
      if (!providerError.retryable || providerError.category === "cancelled") break;
    }
  }

  const assistanceContentFallback = !finalResponse;
  if (!finalResponse) {
    finalResponse = buildAssistanceResponse({
      context: input.assistance,
      content: engineAssistanceFallbackContent(input.phrase, input.assistance),
      analysis: input.analysis,
      generationAttemptId: attempts.at(-1)?.id,
    });
    finalValidation = validateStructuredResponse(finalResponse, {
      analysis: input.analysis,
      decision: input.decision,
      selection: input.selection,
      assistanceActive: true,
    }).result;
    finalCompleteness = reviewTaskCompleteness({
      response: finalResponse,
      obligations: input.obligations,
      analysis: input.analysis,
      context: input.context,
    });
  }

  const type = benchmarkType(input);
  const profile = getAssistanceRealizationProfile(input.phrase.id);
  const diagnostics: EngineDiagnostics = {
    analysis: input.analysis,
    responseObligations: input.obligations,
    taskCompleteness: finalCompleteness ?? reviewTaskCompleteness({
      response: finalResponse,
      obligations: input.obligations,
      analysis: input.analysis,
      context: input.context,
    }),
    decision: input.decision,
    selection: input.selection,
    attempts,
    finalValidation,
    displayedWithSoftQualityWarning: false,
    responseExecutionSource: assistanceContentFallback
      ? "engine_owned_assistance_fallback"
      : "provider_generated",
    noFit: false,
    userEnglishReuseOpportunity: input.context.userEnglishReuseOpportunity,
    userPhraseReuseOpportunity: input.context.userPhraseReuseOpportunity,
    phraseRealizationProfile: profile,
    temporaryOverlayPreference: input.context.temporaryOverlayPreference ?? { mode: "normal", reason: "user_resume" },
    contextualAcknowledgement: input.context.contextualAcknowledgement ?? { active: false },
    assistance: {
      active: true,
      trigger: input.context.assistance?.trigger ?? "clarification",
      resolved: true,
      sourceMessageId: input.assistance.sourceMessageId,
      sourceSegmentIndex: input.assistance.sourceSegmentIndex,
      phraseId: input.assistance.phraseId,
      contextVersion: "eoe.assistance-context.v2",
      assistanceContentFallback,
      providerContentPass: !assistanceContentFallback,
      referenceStatus: "resolved",
      engineOwnedClarification: false,
    },
    benchmarkType: type,
    naturalnessEvidence: type === "structural" ? "structural_only" : type === "live_evidence" ? "independent_human_pending" : "none",
    providerId: lastResult?.providerId ?? "engine",
    modelId: lastResult?.modelId ?? "assistance-fallback-v2",
    totalLatencyMs: attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0),
    totalUsage: sumUsage(attempts),
    fallbackUsed: attempts.some((attempt) => attempt.providerFallbackUsed),
    naturalFallbackUsed: false,
    policyVersion: EOE_POLICY_VERSION,
    registryVersion: REGISTRY_VERSION,
    selectorVersion: EOE_SELECTOR_VERSION,
    directiveVersion: EOE_DIRECTIVE_VERSION,
    validatorVersion: EOE_VALIDATOR_VERSION,
    providerTemplateSchemaVersion: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
    realizationPolicyVersion: EOE_REALIZATION_POLICY_VERSION,
    templateValidatorVersion: EOE_TEMPLATE_VALIDATOR_VERSION,
    assistanceContentSchemaVersion: "eoe.assistance-content.v2",
    developerMode: input.developerMode,
  };
  return {
    response: finalResponse,
    provider: {
      providerId: diagnostics.providerId,
      modelId: diagnostics.modelId,
      fallbackUsed: diagnostics.fallbackUsed,
      requestId: lastResult?.requestId ?? attempts.at(-1)?.requestId ?? createId("req"),
      latencyMs: diagnostics.totalLatencyMs,
      usage: diagnostics.totalUsage,
    },
    diagnostics,
  };
}

export async function runEoeEngine(input: {
  request: ChatRequest;
  gateway: ProviderGateway;
  config: EoeConfig;
  signal?: AbortSignal;
  naturalnessMode?: NaturalnessMode;
}): Promise<EngineRunResult> {
  const userMessage = [...input.request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const hasImage = input.request.attachments.length > 0;
  const conversationContext = resolveConversationContext(input.request);
  const explicitUserPremises = extractExplicitUserPremises(userMessage);
  const developerMode = input.config.developerMode || input.request.engineState?.developerMode === true;
  const fixedLevel =
    developerMode && input.request.engineState?.fixedLevelOverride
      ? input.request.engineState.fixedLevelOverride
      : input.config.fixedLevel;
  const analysis = analyzeConversation({
    userMessage,
    hasImage,
    chineseOnlyScope: conversationContext.chineseOnlyScope,
    difficultySignal: conversationContext.difficultySignal,
  });
  const responseObligations = analyzeResponseObligations({
    userMessage,
    analysis,
    hasImage,
    context: conversationContext,
  });
  let decision = scheduleOverlay({
    analysis,
    fixedLevel,
    enabled: input.config.enabled,
    hasImage,
    chineseOnlyScope: conversationContext.chineseOnlyScope,
    difficultySignal: conversationContext.difficultySignal,
    contextualAcknowledgement: conversationContext.contextualAcknowledgement?.active,
  });
  let selection = selectCandidates({
    registry: LIVE_SAFE_PHRASES,
    decision,
    analysis,
    userMessage,
    recentExposurePhraseIds: input.request.engineState?.recentExposurePhraseIds ?? [],
    realizationProfiles: LIVE_SAFE_REALIZATION_PROFILE_MAP,
    userPhraseReuseOpportunity: conversationContext.userPhraseReuseOpportunity,
  });
  if (conversationContext.assistance?.resolved && conversationContext.assistance.phrase) {
    const assistanceProfile = getAssistanceRealizationProfile(conversationContext.assistance.phrase.id);
    selection = assistanceSelection(conversationContext.assistance.phrase, assistanceProfile);
    decision = {
      ...decision,
      mode: "preferred",
      maxNewFocus: 0,
      maxEnglishSegments: 1,
      reusePreferred: true,
      reasonCodes: [...decision.reasonCodes, "explicit_vocabulary_assistance"],
    };
  }
  decision = { ...decision, candidateCount: selection.candidates.length };
  const candidates = selection.candidates
    .map((candidate) => getPhraseById(candidate.phraseId))
    .filter((phrase) => phrase !== undefined);
  const attempts: GenerationAttemptDiagnostic[] = [];
  let previousValidation: ValidationResult | undefined;
  let lastResult: GatewayResult | undefined;
  let finalResponse: GeneratedResponse | undefined;
  let latestNaturalness: NaturalnessReview | undefined;
  let latestSoftQuality: SoftQualityReview | undefined;
  let latestTaskCompleteness: TaskCompletenessReview | undefined;
  let latestPremisePreservation: PremisePreservationReview | undefined;
  let displayedWithSoftQualityWarning = false;
  const hardValidCandidates: HardValidCandidate[] = [];
  const safeIncompleteCandidates: HardValidCandidate[] = [];
  let finalNoFitReason: NoFitReason | undefined;
  let realizedPhrasePosition: RealizationPosition | undefined;
  const selectedPhrase = selection.selectedPhraseId ? getPhraseById(selection.selectedPhraseId) : undefined;
  const selectedCandidate = selection.candidates.find((candidate) => candidate.phraseId === selection.selectedPhraseId);
  const realizationProfile = selectedPhrase
    ? conversationContext.assistance?.resolved
      ? getAssistanceRealizationProfile(selectedPhrase.id)
      : getPhraseRealizationProfile(selectedPhrase.id)
    : undefined;
  const noFitPolicy = deriveNoFitPolicy({ analysis, decision, selection, context: conversationContext });

  if (conversationContext.assistance?.referenceResolution.status === "ambiguous") {
    return runAmbiguousPhraseClarification({
      request: input.request,
      analysis,
      decision,
      selection,
      obligations: responseObligations,
      context: conversationContext,
      developerMode,
      naturalnessMode: input.naturalnessMode,
    });
  }

  if (conversationContext.assistance?.resolved && conversationContext.assistance.contextV2 && selectedPhrase) {
    return runAssistanceV2({
      request: input.request,
      gateway: input.gateway,
      signal: input.signal,
      analysis,
      decision,
      selection,
      obligations: responseObligations,
      context: conversationContext,
      assistance: conversationContext.assistance.contextV2,
      phrase: selectedPhrase,
      developerMode,
      naturalnessMode: input.naturalnessMode,
    });
  }

  if (conversationContext.contextualAcknowledgement?.active) {
    return runContextualAcknowledgement({
      request: input.request,
      analysis,
      decision,
      selection,
      obligations: responseObligations,
      context: conversationContext,
      developerMode,
      naturalnessMode: input.naturalnessMode,
    });
  }

  let visionObservationDiagnostics: EngineDiagnostics["visionObservation"];
  let visionObservation: NonNullable<EngineDiagnostics["visionObservation"]>["envelope"];
  if (hasImage) {
    const requestId = createId("vision-observation");
    const started = performance.now();
    try {
      const observationResult = await input.gateway.generate({
        messages: [
          { role: "system", content: buildVisionObservationDirective(userMessage) },
          { role: "user", content: userMessage },
        ],
        attachments: input.request.attachments,
        requestId,
        signal: input.signal,
        responseFormat: "json_schema",
        responseJsonSchema: {
          name: "eoe_vision_observation_v1",
          schema: VISION_OBSERVATION_JSON_SCHEMA,
          strict: true,
        },
        generationAttempt: 1,
        mockScenario: input.request.engineState?.mockScenario,
      });
      lastResult = observationResult;
      const parsedObservation = parseVisionObservation(observationResult.content);
      visionObservation = parsedObservation.envelope;
      visionObservationDiagnostics = {
        envelope: parsedObservation.envelope,
        valid: Boolean(parsedObservation.envelope),
        providerId: observationResult.providerId,
        modelId: observationResult.modelId,
        requestId: observationResult.requestId,
        latencyMs: observationResult.latencyMs,
        usage: observationResult.usage,
        fallbackUsed: observationResult.fallbackUsed,
        violationCodes: parsedObservation.violations,
        providerOutputPreview: observationResult.content.slice(0, 4_000),
      };
    } catch (error) {
      const providerError = error instanceof ProviderError
        ? error
        : new ProviderError(error instanceof Error ? error.message : "Vision observation failure", "unknown", false);
      visionObservationDiagnostics = {
        valid: false,
        providerId: "unavailable",
        modelId: "unavailable",
        requestId,
        latencyMs: Math.round(performance.now() - started),
        fallbackUsed: false,
        violationCodes: [`provider_error:${providerError.category}`],
      };
    }
  }

  const generationAttemptNumbers: Array<1 | 2> = hasImage
    ? visionObservation ? [1] : []
    : [1, 2];
  for (const attemptNumber of generationAttemptNumbers) {
    const retryWithoutOverlay = attemptNumber === 2 && Boolean(
      previousValidation && (
        previousValidation.violations.some((violation) =>
          violation.code === "task_incomplete" ||
          violation.code === "overlay_replaced_core_answer"
        ) ||
        (previousValidation.valid && previousValidation.retryable)
      ),
    );
    const attemptDecision: OverlayDecision = retryWithoutOverlay
      ? {
          ...decision,
          mode: "skip",
          maxNewFocus: 0,
          maxEnglishSegments: 0,
          reusePreferred: false,
          candidateCount: 0,
          reasonCodes: [...decision.reasonCodes, "validator_retry_without_overlay"],
        }
      : decision;
    const attemptSelection: CandidateSelection = retryWithoutOverlay
      ? {
          candidates: [],
          noFit: true,
          selectorVersion: selection.selectorVersion,
        }
      : selection;
    const attemptCandidates = retryWithoutOverlay ? [] : candidates;
    const attemptSelectedPhrase = retryWithoutOverlay ? undefined : selectedPhrase;
    const attemptRealizationProfile = retryWithoutOverlay ? undefined : realizationProfile;
    const attemptId = createId("attempt");
    const requestId = createId("req");
    const started = performance.now();
    const pipeline = emptyPipeline();
    try {
      const directive = buildDirective({
        analysis,
        decision: attemptDecision,
        selection: attemptSelection,
        candidates: attemptCandidates,
        selectedPhrase: attemptSelectedPhrase,
        realizationProfile: attemptRealizationProfile,
        recentExposurePhraseIds: input.request.engineState?.recentExposurePhraseIds ?? [],
        obligations: responseObligations,
        noFitPolicy,
        assistance: conversationContext.assistance,
        conversationContext,
        visionObservation,
        userPhraseReuseOpportunity: conversationContext.userPhraseReuseOpportunity,
        explicitUserPremises,
        attemptNumber,
        previousValidation,
      });
      const result = await input.gateway.generate({
        messages: [
          { role: "system", content: directive },
          ...input.request.messages.map((message) => ({ role: message.role, content: message.content })),
        ],
        attachments: hasImage ? [] : input.request.attachments,
        requestId,
        signal: input.signal,
        responseFormat: "json_schema",
        responseJsonSchema: {
          name: "eoe_provider_response_template_v1",
          schema: PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA,
          strict: true,
        },
        generationAttempt: attemptNumber,
        mockScenario: input.request.engineState?.mockScenario,
        eoeContext: {
          selectedPhrase: attemptSelectedPhrase?.canonical,
          selectedPhraseVariants: attemptSelectedPhrase?.variants,
          allowedPositions: attemptRealizationProfile?.allowedPositions,
          responseObligations: responseObligations.map((item) => ({
            kind: item.kind,
            description: item.description,
            minimumEvidence: item.minimumEvidence,
          })),
          allowedNoFitReasons: noFitPolicy.allowedReasons,
          assistance: conversationContext.assistance ? {
            active: true,
            resolved: conversationContext.assistance.resolved,
            sourceTemplate: conversationContext.assistance.sourceTemplate,
            pronunciation: conversationContext.assistance.phrase
              ? phrasePronunciation(conversationContext.assistance.phrase)
              : undefined,
            topic: conversationContext.assistance.topic ?? conversationContext.assistance.previousUserMessage,
            ambiguousPhraseIds: conversationContext.assistance.ambiguousPhraseIds,
          } : undefined,
          visionObservation,
        },
      });
      lastResult = result;
      const context = {
        analysis,
        decision: attemptDecision,
        selection: attemptSelection,
        assistanceActive: conversationContext.assistance?.contextV2 !== undefined,
      };
      const templateResult = parseProviderResponseTemplate(result.content);
      let pipelineDiagnostics: PipelineDiagnostic[] = [];
      let pipelineStage: GenerationAttemptDiagnostic["pipelineStage"] = "provider_template_parse";
      let naturalness: NaturalnessReview | undefined;
      let softQuality: SoftQualityReview | undefined;
      let acceptedResponse: GeneratedResponse | undefined;
      let attemptNoFitReason: NoFitReason | undefined;
      let attemptRealizedPhrasePosition: RealizationPosition | undefined;
      let validation: ValidationResult;

      if (!templateResult.success) {
        pipelineDiagnostics = templateResult.diagnostics;
        pipeline.templateParse = "failed";
        pipelineStage = pipelineDiagnostics.at(-1)?.stage ?? "provider_template_parse";
        validation = diagnosticsToValidation(pipelineDiagnostics);
      } else {
        pipeline.templateParse = "passed";
        const templateValidation = validateProviderResponseTemplate(templateResult.template, {
          selectedPhrase: attemptSelectedPhrase,
          realizationProfile: attemptRealizationProfile,
          effectiveLevel: attemptDecision.effectiveLevel,
          allowedNoFitReasons: noFitPolicy.allowedReasons,
          assistanceActive: conversationContext.assistance?.contextV2 !== undefined,
        });
        pipeline.templateSemantics = templateValidation.result.valid ? "passed" : "failed";
        pipeline.templateValidator = templateValidation.result.valid ? "passed" : "failed";
        if (!templateValidation.result.valid) {
          pipelineStage = "template_validator";
          pipelineDiagnostics = templateValidation.result.violations.map((item) => ({
            stage: "template_validator" as const,
            code: item.code,
            details: item.details,
          }));
          validation = templateValidation.result;
        } else {
          const mapping = mapProviderTemplateToDomain(templateResult.template, {
            analysis,
            policyVersion: EOE_POLICY_VERSION,
            selectedPhraseId: attemptSelection.selectedPhraseId,
            selectedPhrase: attemptSelectedPhrase
              ? conversationContext.assistance?.resolved && conversationContext.assistance.sourcePhraseSurface
                ? conversationContext.assistance.sourcePhraseSurface
                : realizePhraseSurface(attemptSelectedPhrase, templateValidation.position)
              : undefined,
            selectedPhraseIsNew: selectedCandidate ? !selectedCandidate.isReuse : false,
          });
          if (!mapping.success) {
            pipelineDiagnostics = mapping.diagnostics;
            const domainSchemaFailure = mapping.diagnostics.some((item) => item.stage === "domain_schema");
            pipeline.mapper = domainSchemaFailure ? "passed" : "failed";
            pipeline.domainSchema = domainSchemaFailure ? "failed" : "not_reached";
            pipelineStage = mapping.diagnostics.at(-1)?.stage ?? "template_mapper";
            validation = diagnosticsToValidation(mapping.diagnostics);
          } else {
            pipeline.mapper = "passed";
            pipeline.domainSchema = "passed";
            const hardValidation = validateStructuredResponse(mapping.response, context);
            pipeline.domainValidator = hardValidation.result.valid ? "passed" : "failed";
            pipelineStage = "domain_validator";
            if (!hardValidation.result.valid || !hardValidation.response) {
              pipelineDiagnostics = [
                { stage: "domain_validator", code: "domain_validator_failed" },
                ...hardValidation.result.violations.map((item) => ({
                  stage: "domain_validator" as const,
                  code: item.code,
                  details: item.details,
                })),
              ];
              validation = {
                valid: false,
                violations: [
                  { code: "domain_validator_failed", severity: "error" },
                  ...hardValidation.result.violations,
                ],
                retryable: true,
              };
            } else {
              const quantitativeValidation = validateQuantitativeClaims({
                response: hardValidation.response,
                sourceTexts: input.request.messages.map((message) => message.content),
              });
              const continuityValidation = validateContextContinuity({
                response: hardValidation.response,
                context: conversationContext,
              });
              const premiseValidation = validatePremisePreservation({
                response: hardValidation.response,
                premises: explicitUserPremises,
              });
              latestPremisePreservation = premiseValidation.review;
              const additionalHardViolations = [
                ...quantitativeValidation.violations,
                ...continuityValidation.violations,
                ...premiseValidation.result.violations,
              ];
              if (additionalHardViolations.length > 0) {
                validation = {
                  valid: false,
                  violations: additionalHardViolations,
                  retryable: true,
                };
                pipeline.domainValidator = "failed";
                pipelineDiagnostics = additionalHardViolations.map((item) => ({
                  stage: "domain_validator" as const,
                  code: item.code,
                  details: item.details,
                }));
              } else {
                const completeness = reviewTaskCompleteness({
                  response: hardValidation.response,
                  obligations: responseObligations,
                  analysis,
                  context: conversationContext,
                  visionObservation,
                });
                const hardCompleteness = hardCompletenessValidation(completeness);
                latestTaskCompleteness = completeness;
                pipeline.taskCompleteness = hardCompleteness.valid ? "passed" : "failed";
                if (!hardCompleteness.valid) {
                  pipelineStage = "task_completeness_validator";
                  validation = hardCompleteness;
                  pipelineDiagnostics = validation.violations.map((item) => ({
                    stage: "task_completeness_validator" as const,
                    code: item.code,
                    details: item.details,
                  }));
                  const incompleteNaturalness = reviewNaturalness({
                    response: hardValidation.response,
                    context,
                    attemptNumber,
                    mode: input.naturalnessMode ?? "default",
                  });
                  naturalness = incompleteNaturalness;
                  const incompleteWarnings = [
                    ...new Set([
                      ...completeness.issues,
                      ...(incompleteNaturalness?.issues ?? []),
                    ]),
                  ];
                  softQuality = {
                    acceptable: false,
                    warnings: incompleteWarnings,
                    confidence: Number(Math.max(
                      0.2,
                      0.8 - incompleteWarnings.length * 0.08,
                    ).toFixed(2)),
                    retryRecommended: attemptNumber === 1,
                  };
                  if (!completeness.issues.includes("non_answering_template")) {
                    safeIncompleteCandidates.push({
                      response: generatedResponseSchema.parse({
                        ...hardValidation.response,
                        policyVersion: EOE_POLICY_VERSION,
                        generationAttemptId: attemptId,
                      }),
                      taskCompleteness: completeness,
                      naturalness: incompleteNaturalness,
                      softQuality,
                      premisePreservation: latestPremisePreservation ?? reviewPremisePreservation({
                        responseText: "",
                        premises: [],
                      }),
                      noFitReason: templateResult.template.usePhrase
                        ? undefined
                        : templateResult.template.noFitReason,
                      realizedPhrasePosition: templateResult.template.usePhrase
                        ? templateValidation.position
                        : undefined,
                    });
                  }
                } else {
                  naturalness = reviewNaturalness({
                    response: hardValidation.response,
                    context,
                    attemptNumber,
                    mode: input.naturalnessMode ?? "default",
                  });
                  softQuality = buildSoftQualityReview({
                    response: hardValidation.response,
                    completeness,
                    obligations: responseObligations,
                    naturalness,
                    attemptNumber,
                  });
                  pipelineStage = "naturalness_validator";
                  validation = {
                    valid: true,
                    violations: softQuality.warnings.map((code) => ({
                      code,
                      severity: "warning" as const,
                    })),
                    retryable: softQuality.retryRecommended,
                  };
                  pipelineDiagnostics = softQuality.warnings.map((code) => ({
                    stage: "naturalness_validator" as const,
                    code,
                  }));
                  acceptedResponse = hardValidation.response;
                  attemptNoFitReason = templateResult.template.usePhrase
                    ? undefined
                    : templateResult.template.noFitReason;
                  attemptRealizedPhrasePosition = templateResult.template.usePhrase
                    ? templateValidation.position
                    : undefined;
                }
              }
            }
          }
        }
      }

      latestNaturalness = naturalness;
      attempts.push({
        id: attemptId,
        attemptNumber,
        providerId: result.providerId,
        modelId: result.modelId,
        requestId: result.requestId,
        latencyMs: result.latencyMs,
        usage: result.usage,
        providerFallbackUsed: result.fallbackUsed,
        validatorRetry: attemptNumber === 2,
        outcome: validation.valid ? "valid" : "invalid",
        validation,
        naturalness,
        softQuality,
        pipelineStage,
        pipelineDiagnostics,
        pipeline,
        providerOutputPreview: result.content.slice(0, 4_000),
      });
      if (acceptedResponse && validation.valid) {
        const candidateResponse = generatedResponseSchema.parse({
          ...acceptedResponse,
          policyVersion: EOE_POLICY_VERSION,
          generationAttemptId: attemptId,
        });
        const candidateSoftQuality = softQuality ?? {
          acceptable: true,
          warnings: [],
          confidence: 1,
          retryRecommended: false,
        };
        const candidateCompleteness = latestTaskCompleteness ?? reviewTaskCompleteness({
          response: candidateResponse,
          obligations: responseObligations,
          analysis,
          context: conversationContext,
          visionObservation,
        });
        hardValidCandidates.push({
          response: candidateResponse,
          taskCompleteness: candidateCompleteness,
          naturalness,
          softQuality: candidateSoftQuality,
          premisePreservation: latestPremisePreservation ?? reviewPremisePreservation({
            responseText: "",
            premises: [],
          }),
          noFitReason: attemptNoFitReason,
          realizedPhrasePosition: attemptRealizedPhrasePosition,
        });
        previousValidation = validation;
        if (candidateSoftQuality.retryRecommended && attemptNumber === 1) continue;
        const chosen = [...hardValidCandidates].sort(
          (left, right) =>
            softQualityScore(right) - softQualityScore(left),
        )[0];
        finalResponse = chosen.response;
        latestTaskCompleteness = chosen.taskCompleteness;
        latestNaturalness = chosen.naturalness;
        latestSoftQuality = chosen.softQuality;
        latestPremisePreservation = chosen.premisePreservation;
        finalNoFitReason = chosen.noFitReason;
        realizedPhrasePosition = chosen.realizedPhrasePosition;
        displayedWithSoftQualityWarning = chosen.softQuality.warnings.length > 0;
        break;
      }
      previousValidation = validation;
    } catch (error) {
      const providerError =
        error instanceof ProviderError
          ? error
          : new ProviderError(error instanceof Error ? error.message : "Provider failure", "unknown", false);
      const validation = invalidResult("provider_error", providerError.category, providerError.retryable);
      const pipelineDiagnostics: PipelineDiagnostic[] = [
        { stage: "provider_error", code: "provider_error", details: providerError.category },
      ];
      attempts.push({
        id: attemptId,
        attemptNumber,
        providerId: "unavailable",
        modelId: "unavailable",
        requestId,
        latencyMs: Math.round(performance.now() - started),
        providerFallbackUsed: false,
        validatorRetry: attemptNumber === 2,
        outcome: "provider_error",
        validation,
        errorCategory: providerError.category,
        pipelineStage: "provider_error",
        pipelineDiagnostics,
        pipeline,
      });
      previousValidation = validation;
      if (!providerError.retryable || providerError.category === "cancelled") break;
    }
  }

  if (!finalResponse && hardValidCandidates.length > 0) {
    const chosen = [...hardValidCandidates].sort(
      (left, right) => softQualityScore(right) - softQualityScore(left),
    )[0];
    finalResponse = chosen.response;
    latestTaskCompleteness = chosen.taskCompleteness;
    latestNaturalness = chosen.naturalness;
    latestSoftQuality = chosen.softQuality;
    latestPremisePreservation = chosen.premisePreservation;
    finalNoFitReason = chosen.noFitReason;
    realizedPhrasePosition = chosen.realizedPhrasePosition;
    displayedWithSoftQualityWarning = chosen.softQuality.warnings.length > 0;
    previousValidation = {
      valid: true,
      violations: chosen.softQuality.warnings.map((code) => ({
        code,
        severity: "warning",
      })),
      retryable: false,
    };
  }
  if (!finalResponse && safeIncompleteCandidates.length > 0) {
    const chosen = [...safeIncompleteCandidates].sort(
      (left, right) => softQualityScore(right) - softQualityScore(left),
    )[0];
    finalResponse = chosen.response;
    latestTaskCompleteness = chosen.taskCompleteness;
    latestNaturalness = chosen.naturalness;
    latestSoftQuality = chosen.softQuality;
    latestPremisePreservation = chosen.premisePreservation;
    finalNoFitReason = chosen.noFitReason;
    realizedPhrasePosition = chosen.realizedPhrasePosition;
    displayedWithSoftQualityWarning = true;
  }
  if (realizedPhrasePosition && selection.selectedPhraseId) {
    selection = {
      ...selection,
      candidates: selection.candidates.map((candidate) =>
        candidate.phraseId === selection.selectedPhraseId
          ? { ...candidate, insertionPosition: realizedPhrasePosition as RealizationPosition }
          : candidate,
      ),
    };
  }

  let naturalFallbackUsed = false;
  let finalValidation: ValidationResult;
  if (finalResponse) {
    finalValidation = previousValidation ?? { valid: true, violations: [], retryable: false };
  } else {
    naturalFallbackUsed = true;
    finalResponse = createNaturalFallback(analysis);
    const fallbackContext = {
      analysis,
      decision,
      selection,
      assistanceActive: conversationContext.assistance?.contextV2 !== undefined,
    };
    finalValidation = validateStructuredResponse(finalResponse, fallbackContext).result;
    latestTaskCompleteness = reviewTaskCompleteness({
      response: finalResponse,
      obligations: responseObligations,
      analysis,
      context: conversationContext,
      visionObservation,
    });
    latestNaturalness = reviewNaturalness({
      response: finalResponse,
      context: fallbackContext,
      attemptNumber: 2,
      mode: input.naturalnessMode ?? "default",
    });
    latestPremisePreservation = reviewPremisePreservation({
      responseText: finalResponse.segments.map((segment) => segment.content).join(""),
      premises: explicitUserPremises,
    });
  }

  const providerId = lastResult?.providerId ?? "engine";
  const modelId = lastResult?.modelId ?? "natural-fallback-v1";
  const fallbackUsed = attempts.some((attempt) => attempt.providerFallbackUsed) || visionObservationDiagnostics?.fallbackUsed === true;
  const benchmarkTypeValue = benchmarkType(input);
  const attemptUsage = sumUsage(attempts);
  const observationUsage = visionObservationDiagnostics?.usage;
  const totalUsage = attemptUsage || observationUsage ? {
    promptTokens: (attemptUsage?.promptTokens ?? 0) + (observationUsage?.promptTokens ?? 0),
    completionTokens: (attemptUsage?.completionTokens ?? 0) + (observationUsage?.completionTokens ?? 0),
    totalTokens: (attemptUsage?.totalTokens ?? 0) + (observationUsage?.totalTokens ?? 0),
  } : undefined;
  const diagnostics: EngineDiagnostics = {
    analysis,
    responseObligations,
    taskCompleteness: latestTaskCompleteness ?? reviewTaskCompleteness({
      response: finalResponse,
      obligations: responseObligations,
      analysis,
      context: conversationContext,
      visionObservation,
    }),
    decision,
    selection,
    attempts,
    finalValidation,
    naturalness: latestNaturalness,
    softQualityReview: latestSoftQuality,
    displayedWithSoftQualityWarning,
    explicitUserPremises,
    premisePreservationReview: latestPremisePreservation,
    responseExecutionSource: naturalFallbackUsed
      ? "natural_fallback"
      : "provider_generated",
    noFit: finalResponse.noFit,
    noFitDecisionSource: finalResponse.noFit
      ? hasImage
        ? "image_overlay_deferred"
        : naturalFallbackUsed
        ? "contextual_no_fit"
        : noFitPolicy.decisionSource
      : undefined,
    noFitReason: finalResponse.noFit
      ? hasImage
        ? noFitPolicy.allowedReasons[0]
        : naturalFallbackUsed ? "other" : finalNoFitReason
      : undefined,
    userEnglishReuseOpportunity: conversationContext.userEnglishReuseOpportunity,
    userPhraseReuseOpportunity: conversationContext.userPhraseReuseOpportunity,
    realizedPhrasePosition,
    phraseRealizationProfile: realizationProfile,
    temporaryOverlayPreference: conversationContext.temporaryOverlayPreference ?? { mode: "normal", reason: "user_resume" },
    contextualAcknowledgement: conversationContext.contextualAcknowledgement ?? { active: false },
    assistance: conversationContext.assistance ? {
      active: true,
      trigger: conversationContext.assistance.trigger,
      resolved: conversationContext.assistance.resolved,
      sourceMessageId: conversationContext.assistance.sourceMessageId,
      sourceSegmentIndex: conversationContext.assistance.segmentIndex,
      phraseId: conversationContext.assistance.phraseId,
      referenceStatus: conversationContext.assistance.referenceResolution.status,
      engineOwnedClarification: false,
    } : undefined,
    visionObservation: visionObservationDiagnostics,
    benchmarkType: benchmarkTypeValue,
    naturalnessEvidence: benchmarkTypeValue === "structural"
      ? "structural_only"
      : benchmarkTypeValue === "live_evidence"
        ? "independent_human_pending"
        : "none",
    providerId,
    modelId,
    totalLatencyMs: attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0) + (visionObservationDiagnostics?.latencyMs ?? 0),
    totalUsage,
    fallbackUsed,
    naturalFallbackUsed,
    policyVersion: EOE_POLICY_VERSION,
    registryVersion: REGISTRY_VERSION,
    selectorVersion: EOE_SELECTOR_VERSION,
    directiveVersion: EOE_DIRECTIVE_VERSION,
    validatorVersion: EOE_VALIDATOR_VERSION,
    providerTemplateSchemaVersion: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
    realizationPolicyVersion: EOE_REALIZATION_POLICY_VERSION,
    templateValidatorVersion: EOE_TEMPLATE_VALIDATOR_VERSION,
    visionObservationSchemaVersion: hasImage ? "eoe.vision-observation.v1" : undefined,
    developerMode,
  };

  return {
    response: finalResponse,
    provider: {
      providerId,
      modelId,
      fallbackUsed,
      requestId: lastResult?.requestId ?? attempts.at(-1)?.requestId ?? createId("req"),
      latencyMs: diagnostics.totalLatencyMs,
      usage: diagnostics.totalUsage,
    },
    diagnostics,
  };
}
