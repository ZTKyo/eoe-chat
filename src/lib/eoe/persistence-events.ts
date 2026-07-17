import type { ChatResponse } from "@/domain/chat";
import type {
  AssistanceOutcome,
  ExposureEvent,
  GenerationAttempt,
  ResponseObligationRecord,
  StoredEngineDiagnostics,
  TaskCompletenessReviewRecord,
  ProviderObservation,
} from "@/domain/persistence";
import { createId } from "@/lib/ids";

export function createPersistenceRecords(input: {
  conversationId: string;
  messageId: string;
  response: ChatResponse;
  timestamp?: number;
}): {
  exposures: ExposureEvent[];
  attempts: GenerationAttempt[];
  diagnostics: StoredEngineDiagnostics;
  obligations: ResponseObligationRecord[];
  completeness: TaskCompletenessReviewRecord;
  assistanceOutcome?: AssistanceOutcome;
  providerObservation?: ProviderObservation;
} {
  const timestamp = input.timestamp ?? Date.now();
  const { response, engine, provider } = input.response;
  const exposures: ExposureEvent[] = response.segments
    .filter((segment) => segment.type === "english_chunk")
    .map((segment) => ({
      id: createId("exposure"),
      phraseId: segment.phraseId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      timestamp,
      fixedLevel: engine.decision.fixedLevel,
      effectiveLevel: engine.decision.effectiveLevel,
      conversationFunction: engine.analysis.primaryFunction,
      isNew: segment.isNew,
      provider: provider.providerId,
      policyVersion: engine.policyVersion,
      registryVersion: engine.registryVersion,
      selectorVersion: engine.selectorVersion,
      generationAttemptId: response.generationAttemptId ?? engine.attempts.at(-1)?.id ?? "none",
    }));
  const attempts: GenerationAttempt[] = engine.attempts.map((attempt) => ({
    id: attempt.id,
    conversationId: input.conversationId,
    messageId: input.messageId,
    providerId: attempt.providerId,
    modelId: attempt.modelId,
    requestId: attempt.requestId,
    attemptNumber: attempt.attemptNumber,
    timestamp,
    latencyMs: attempt.latencyMs,
    providerFallbackUsed: attempt.providerFallbackUsed,
    validatorRetry: attempt.validatorRetry,
    outcome: attempt.outcome,
    validation: attempt.validation,
    errorCategory: attempt.errorCategory,
    pipelineStage: attempt.pipelineStage,
    pipelineDiagnostics: attempt.pipelineDiagnostics,
    pipeline: attempt.pipeline,
    policyVersion: engine.policyVersion,
  }));
  return {
    exposures,
    attempts,
    obligations: engine.responseObligations.map((obligation) => ({
      ...obligation,
      recordId: createId("obligation"),
      conversationId: input.conversationId,
      messageId: input.messageId,
      timestamp,
    })),
    completeness: {
      ...engine.taskCompleteness,
      id: createId("completeness"),
      conversationId: input.conversationId,
      messageId: input.messageId,
      timestamp,
      noFitDecisionSource: engine.noFitDecisionSource,
    },
    assistanceOutcome: engine.assistance ? {
      id: createId("assistance-outcome"),
      conversationId: input.conversationId,
      messageId: input.messageId,
      sourceMessageId: engine.assistance.sourceMessageId,
      phraseId: engine.assistance.phraseId,
      resolved: engine.assistance.resolved,
      topicResumed: engine.taskCompleteness.fulfilledObligationIds.includes("obligation-continue_context"),
      contextVersion: engine.assistance.contextVersion,
      assistanceContentFallback: engine.assistance.assistanceContentFallback,
      providerContentPass: engine.assistance.providerContentPass,
      timestamp,
    } : undefined,
    providerObservation: engine.visionObservation ? {
      id: createId("provider-observation"),
      providerId: engine.visionObservation.providerId,
      modelId: engine.visionObservation.modelId,
      createdAt: timestamp,
      latencyMs: engine.visionObservation.latencyMs,
      fallbackUsed: engine.visionObservation.fallbackUsed,
      conversationId: input.conversationId,
      messageId: input.messageId,
      schemaVersion: "eoe.vision-observation.v1",
      valid: engine.visionObservation.valid,
      envelope: engine.visionObservation.envelope,
      violationCodes: engine.visionObservation.violationCodes,
    } : undefined,
    diagnostics: {
      id: createId("diagnostics"),
      conversationId: input.conversationId,
      messageId: input.messageId,
      timestamp,
      diagnostics: engine,
    },
  };
}
