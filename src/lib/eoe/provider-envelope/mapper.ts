import { generatedResponseSchema, plainTextSegment, type GeneratedResponse, type MessageSegment } from "@/domain/chat";
import type { PipelineDiagnostic } from "@/domain/eoe";
import { EOE_RESPONSE_SCHEMA_VERSION } from "../constants";
import type { ProviderGenerationEnvelopeV1 } from "./schema";

export interface ProviderEnvelopeMappingContext {
  policyVersion: string;
  selectedPhraseId?: string;
  selectedPhrase?: string;
  selectedPhraseVariants?: string[];
  selectedPhraseIsNew: boolean;
}

export type ProviderEnvelopeMappingResult =
  | { success: true; response: GeneratedResponse; diagnostics: [] }
  | { success: false; diagnostics: PipelineDiagnostic[] };

function mapperDiagnostic(code: string, path?: string, details?: string): PipelineDiagnostic {
  return { stage: code === "domain_schema_failed" ? "domain_schema" : "deterministic_mapper", code, path, details };
}

export function mapProviderEnvelopeToDomain(
  envelope: ProviderGenerationEnvelopeV1,
  context: ProviderEnvelopeMappingContext,
): ProviderEnvelopeMappingResult {
  if (envelope.englishChunk) {
    const allowed = [context.selectedPhrase, ...(context.selectedPhraseVariants ?? [])].filter(
      (value): value is string => Boolean(value),
    );
    if (
      !context.selectedPhraseId ||
      envelope.englishChunk.phraseId !== context.selectedPhraseId ||
      !allowed.includes(envelope.englishChunk.content)
    ) {
      return {
        success: false,
        diagnostics: [mapperDiagnostic("mapper_failed", "englishChunk", "Envelope Phrase is not the selected Registry form")],
      };
    }
  }

  const segments: MessageSegment[] = [];
  if (envelope.beforeText.length > 0) segments.push(plainTextSegment(envelope.beforeText));
  if (envelope.englishChunk) {
    segments.push({
      type: "english_chunk",
      content: envelope.englishChunk.content,
      phraseId: envelope.englishChunk.phraseId,
      isNew: context.selectedPhraseIsNew,
      assistanceAvailable: true,
    });
  }
  if (envelope.afterText.length > 0) segments.push(plainTextSegment(envelope.afterText));

  const raw = {
    schemaVersion: EOE_RESPONSE_SCHEMA_VERSION,
    policyVersion: context.policyVersion,
    conversationFunction: envelope.conversationFunction,
    segments,
    usedPhraseIds: envelope.englishChunk ? [envelope.englishChunk.phraseId] : [],
    noFit: envelope.noFit,
    naturalnessConfidence: envelope.naturalnessConfidence,
    intentPreserved: envelope.intentPreserved,
  };
  const parsed = generatedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      diagnostics: [
        mapperDiagnostic("domain_schema_failed", issue?.path.map(String).join("."), issue?.code),
      ],
    };
  }
  return { success: true, response: parsed.data, diagnostics: [] };
}
