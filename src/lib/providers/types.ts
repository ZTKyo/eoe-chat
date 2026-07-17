import type { WireAttachment } from "@/domain/chat";
import type { ConversationFunction, GrammaticalRole, MockScenario, RealizationPosition } from "@/domain/eoe";

export type ProviderErrorCategory =
  | "authentication"
  | "rate_limit"
  | "timeout"
  | "cancelled"
  | "invalid_request"
  | "content_filter"
  | "provider_unavailable"
  | "invalid_response"
  | "unknown";

export interface ProviderCapabilities {
  text: boolean;
  vision: boolean;
  streaming: boolean;
  jsonMode: boolean;
  jsonSchema?: boolean;
  toolCalling: boolean;
}

export interface ProviderJsonSchemaRequest {
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
}

export interface ProviderMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProviderRequest {
  messages: ProviderMessage[];
  attachments: WireAttachment[];
  requestId: string;
  signal?: AbortSignal;
  responseFormat?: "json_schema" | "json_object" | "text";
  responseJsonSchema?: ProviderJsonSchemaRequest;
  generationAttempt?: 1 | 2;
  mockScenario?: MockScenario;
  liveMetadata?: {
    scenarioId: string;
    conversationTurnId: string;
  };
  eoeContext?: {
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    conversationFunction?: ConversationFunction;
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    selectedPhraseId?: string;
    selectedPhrase?: string;
    selectedPhraseVariants?: string[];
    allowedPositions?: RealizationPosition[];
    responseObligations?: Array<{
      kind: string;
      description: string;
      minimumEvidence?: string[];
    }>;
    allowedNoFitReasons?: string[];
    assistance?: {
      active: boolean;
      resolved: boolean;
      sourceTemplate?: string;
      pronunciation?: string;
      topic?: string;
      ambiguousPhraseIds?: string[];
    };
    assistanceV2?: {
      phraseCanonical: string;
      sourceSentence: string;
      pronunciation: string;
      previousUserMessage: string;
      topicSummary: string;
      assistanceType: "meaning" | "pronunciation" | "clarification" | "general";
    };
    visionObservation?: {
      observations: Array<{ description: string; confidence: "high" | "medium" | "low" }>;
      visibleText: string[];
      uncertainties: string[];
    };
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    selectedPhraseRole?: GrammaticalRole;
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    selectedPhrasePatterns?: string[];
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    selectedPhraseIsNew?: boolean;
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    maxEnglishSegments?: number;
    /** @deprecated M2.2 Envelope fixture compatibility only. */
    policyVersion?: string;
  };
}

export interface ProviderUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProviderResult {
  content: string;
  providerId: string;
  modelId: string;
  requestId: string;
  latencyMs: number;
  usage?: ProviderUsage;
}

export interface Provider {
  readonly id: string;
  readonly modelId: string;
  readonly capabilities: ProviderCapabilities;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly category: ProviderErrorCategory,
    public readonly retryable: boolean,
    public readonly status = 502,
    public readonly providerCode?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
