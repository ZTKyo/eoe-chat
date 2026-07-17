import type {
  ConversationFunction,
  EngineDiagnostics,
  GenerationPipeline,
  PipelineDiagnostic,
  ProviderPipelineStage,
  ValidationResult,
  ResponseObligation,
  TaskCompletenessReview,
  NoFitDecisionSource,
  VisionObservationEnvelopeV1,
} from "./eoe";

export type { Phrase } from "./eoe";

export interface ExposureEvent {
  id: string;
  phraseId: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  fixedLevel: number;
  effectiveLevel: number;
  conversationFunction: ConversationFunction;
  isNew: boolean;
  provider: string;
  policyVersion: string;
  registryVersion: string;
  selectorVersion: string;
  generationAttemptId: string;
}

export interface ComprehensionEvidence {
  id: string;
  phraseId: string;
  sourceEventId: string;
  strength: "weak" | "moderate" | "strong" | "difficulty";
  score: number;
  policyVersion: string;
  createdAt: number;
}

export interface ProgressionState {
  id: "local-user";
  progressionLevel: number;
  effectiveLevel: number;
  locked: boolean;
  policyVersion: string;
  replayedThrough?: string;
  recalculatedAt: number;
}

export interface GenerationAttempt {
  id: string;
  conversationId: string;
  messageId: string;
  providerId: string;
  modelId: string;
  requestId: string;
  attemptNumber: number;
  timestamp: number;
  latencyMs: number;
  providerFallbackUsed: boolean;
  validatorRetry: boolean;
  outcome: "valid" | "invalid" | "provider_error";
  validation: ValidationResult;
  errorCategory?: string;
  pipelineStage?: ProviderPipelineStage;
  pipelineDiagnostics?: PipelineDiagnostic[];
  pipeline?: GenerationPipeline;
  policyVersion: string;
}

export interface AssistanceRequest {
  id: string;
  phraseId: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  kind: "phrase_click" | "phrase_long_press" | "meaning" | "pronunciation" | "clarification";
  sourceMessageId?: string;
  segmentIndex?: number;
}

export interface AssistanceOutcome {
  id: string;
  requestId?: string;
  conversationId: string;
  messageId: string;
  sourceMessageId?: string;
  phraseId?: string;
  resolved: boolean;
  topicResumed: boolean;
  contextVersion?: "eoe.assistance-context.v2";
  assistanceContentFallback?: boolean;
  providerContentPass?: boolean;
  timestamp: number;
}

export interface ResponseObligationRecord extends ResponseObligation {
  recordId: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
}

export interface TaskCompletenessReviewRecord extends TaskCompletenessReview {
  id: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  noFitDecisionSource?: NoFitDecisionSource;
}

export interface StoredEngineDiagnostics {
  id: string;
  conversationId: string;
  messageId: string;
  timestamp: number;
  diagnostics: EngineDiagnostics;
}

export interface EnginePolicy {
  version: string;
  effectiveAt: number;
  config: Record<string, unknown>;
}

export interface ProviderObservation {
  id: string;
  providerId: string;
  modelId: string;
  createdAt: number;
  latencyMs?: number;
  errorCategory?: string;
  fallbackUsed: boolean;
  conversationId?: string;
  messageId?: string;
  schemaVersion?: "eoe.vision-observation.v1";
  valid?: boolean;
  envelope?: VisionObservationEnvelopeV1;
  violationCodes?: string[];
}
