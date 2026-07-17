import { generatedResponseSchema, type GeneratedResponse, type MessageSegment } from "@/domain/chat";
import type { ConversationAnalysis, PipelineDiagnostic } from "@/domain/eoe";
import { EOE_RESPONSE_SCHEMA_VERSION } from "../constants";
import { EOE_PHRASE_PLACEHOLDER, type ProviderResponseTemplateV1 } from "./schema";

export type ProviderTemplateMappingResult =
  | { success: true; response: GeneratedResponse; diagnostics: [] }
  | { success: false; diagnostics: PipelineDiagnostic[] };

export function mapProviderTemplateToDomain(
  template: ProviderResponseTemplateV1,
  context: {
    analysis: ConversationAnalysis;
    policyVersion: string;
    selectedPhraseId?: string;
    selectedPhrase?: string;
    selectedPhraseIsNew: boolean;
  },
): ProviderTemplateMappingResult {
  const diagnostics: PipelineDiagnostic[] = [];
  const segments: MessageSegment[] = [];

  if (template.usePhrase) {
    if (!context.selectedPhraseId || !context.selectedPhrase) {
      return {
        success: false,
        diagnostics: [{ stage: "template_mapper", code: "use_phrase_conflict", details: "missing Engine-owned Phrase" }],
      };
    }
    const [before, after, ...extra] = template.responseTemplate.split(EOE_PHRASE_PLACEHOLDER);
    if (extra.length > 0) {
      return {
        success: false,
        diagnostics: [{ stage: "template_mapper", code: "duplicate_placeholder" }],
      };
    }
    if (before.length > 0) {
      segments.push({ type: "text", content: before, language: /[\u3400-\u9fff]/u.test(before) ? "zh" : "other" });
    }
    segments.push({
      type: "english_chunk",
      content: context.selectedPhrase,
      phraseId: context.selectedPhraseId,
      isNew: context.selectedPhraseIsNew,
      assistanceAvailable: true,
    });
    if (after.length > 0) {
      segments.push({ type: "text", content: after, language: /[\u3400-\u9fff]/u.test(after) ? "zh" : "other" });
    }
  } else {
    segments.push({
      type: "text",
      content: template.responseTemplate,
      language: /[\u3400-\u9fff]/u.test(template.responseTemplate) ? "zh" : "other",
    });
  }

  const parsed = generatedResponseSchema.safeParse({
    schemaVersion: EOE_RESPONSE_SCHEMA_VERSION,
    policyVersion: context.policyVersion,
    conversationFunction: context.analysis.primaryFunction,
    segments,
    usedPhraseIds: template.usePhrase && context.selectedPhraseId ? [context.selectedPhraseId] : [],
    noFit: !template.usePhrase,
  });

  if (!parsed.success) {
    diagnostics.push(
      ...parsed.error.issues.map((issue) => ({
        stage: "domain_schema" as const,
        code: "broken_structured_output",
        path: issue.path.join("."),
        details: issue.message,
      })),
    );
    return { success: false, diagnostics };
  }

  return { success: true, response: parsed.data, diagnostics: [] };
}
