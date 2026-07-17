import { z } from "zod";
import { generatedResponseSchema, plainTextSegment, type GeneratedResponse, type MessageSegment } from "@/domain/chat";
import type { ConversationAnalysis, Phrase } from "@/domain/eoe";
import { EOE_POLICY_VERSION } from "./constants";

export const vocabularyAssistanceContextV2Schema = z.strictObject({
  sourceMessageId: z.string().min(1),
  sourceSegmentIndex: z.number().int().nonnegative(),
  phraseId: z.string().min(1),
  phraseCanonical: z.string().min(1),
  sourceSentence: z.string().min(1),
  pronunciation: z.string().min(1),
  previousUserMessage: z.string().min(1),
  topicSummary: z.string().min(1),
  assistanceType: z.enum(["meaning", "pronunciation", "clarification", "general"]),
});
export type VocabularyAssistanceContextV2 = z.infer<typeof vocabularyAssistanceContextV2Schema>;

export const vocabularyAssistanceContentV2Schema = z.strictObject({
  schemaVersion: z.literal("eoe.assistance-content.v2"),
  contextualMeaning: z.string().trim().min(1).max(600),
  shortExample: z.string().trim().min(1).max(300).optional(),
  topicContinuation: z.string().trim().min(1).max(1_200),
});
export type VocabularyAssistanceContentV2 = z.infer<typeof vocabularyAssistanceContentV2Schema>;

export const VOCABULARY_ASSISTANCE_CONTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "contextualMeaning", "topicContinuation"],
  properties: {
    schemaVersion: { const: "eoe.assistance-content.v2" },
    contextualMeaning: { type: "string", minLength: 1, maxLength: 600 },
    shortExample: { type: "string", minLength: 1, maxLength: 300 },
    topicContinuation: { type: "string", minLength: 1, maxLength: 1200 },
  },
} as const;

export function parseAssistanceContent(raw: string): VocabularyAssistanceContentV2 | undefined {
  try {
    return vocabularyAssistanceContentV2Schema.parse(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function buildAssistanceDirective(context: VocabularyAssistanceContextV2, previousCodes: string[]): string {
  return [
    "Return exactly one JSON object matching eoe.assistance-content.v2.",
    "The Engine already resolved the source. Do not search history, rewrite the source sentence or Phrase, invent pronunciation, deny the Phrase, teach a lesson, ask for repetition, or add exercises.",
    context.assistanceType === "pronunciation"
      ? "The user asked only for pronunciation. contextualMeaning must be one very short context hint. Omit shortExample. topicContinuation must resume the actual prior topic in one concise sentence."
      : "Write a brief Chinese contextualMeaning and a useful topic-specific Chinese topicContinuation. shortExample is optional and must be one short natural example only.",
    `Assistance type: ${context.assistanceType}.`,
    `Phrase: ${JSON.stringify(context.phraseCanonical)}.`,
    `Source sentence: ${JSON.stringify(context.sourceSentence)}.`,
    `Previous user message: ${JSON.stringify(context.previousUserMessage)}.`,
    `Topic summary: ${JSON.stringify(context.topicSummary)}.`,
    ...(previousCodes.length > 0 ? [`Correct these previous codes: ${previousCodes.join(", ")}.`] : []),
    "Allowed keys only: schemaVersion, contextualMeaning, optional shortExample, topicContinuation.",
  ].join("\n");
}

export function validateAssistanceContent(
  context: VocabularyAssistanceContextV2,
  content: VocabularyAssistanceContentV2,
): string[] {
  const violations: string[] = [];
  if (context.assistanceType === "pronunciation" && content.shortExample) {
    violations.push("pronunciation_assistance_unrequested_example");
  }
  if (context.assistanceType === "pronunciation" && content.contextualMeaning.length > 80) {
    violations.push("pronunciation_assistance_too_verbose");
  }
  const genericContinuation =
    /^(?:继续原来的话题|回到原来的话题|你可以再告诉我|我们继续讨论|可以继续聊)[。！]?$/u.test(
      content.topicContinuation.trim(),
    );
  const topicTerms = context.topicSummary.match(/[\u3400-\u9fff]{2,8}/gu)?.slice(0, 10) ?? [];
  const topicSpecific = topicTerms.some((term) => content.topicContinuation.includes(term)) ||
    content.topicContinuation.includes(context.topicSummary.slice(0, 12));
  if (genericContinuation || !topicSpecific) {
    violations.push("assistance_topic_continuation_generic");
  }
  return violations;
}

function segments(context: VocabularyAssistanceContextV2, content: VocabularyAssistanceContentV2): MessageSegment[] {
  if (context.assistanceType === "pronunciation") {
    return [
      plainTextSegment(`原句：${context.sourceSentence}\n`),
      {
        type: "assistance_phrase",
        content: context.phraseCanonical,
        phraseId: context.phraseId,
        pronunciation: context.pronunciation,
      },
      plainTextSegment(` 读作 ${context.pronunciation}。这里是${content.contextualMeaning}\n${content.topicContinuation}`),
    ];
  }
  return [
    plainTextSegment(`原句：${context.sourceSentence}\n`),
    { type: "assistance_phrase", content: context.phraseCanonical, phraseId: context.phraseId, pronunciation: context.pronunciation },
    plainTextSegment(`：${content.contextualMeaning}`),
    ...(content.shortExample ? [plainTextSegment(`\n例如：${content.shortExample}`)] : []),
    plainTextSegment(`\n${content.topicContinuation}`),
  ];
}

export function buildAssistanceResponse(input: {
  context: VocabularyAssistanceContextV2;
  content: VocabularyAssistanceContentV2;
  analysis: ConversationAnalysis;
  generationAttemptId?: string;
}): GeneratedResponse {
  return generatedResponseSchema.parse({
    schemaVersion: "eoe.response.v2",
    policyVersion: EOE_POLICY_VERSION,
    conversationFunction: input.analysis.primaryFunction,
    segments: segments(input.context, input.content),
    usedPhraseIds: [],
    noFit: false,
    generationAttemptId: input.generationAttemptId,
    intentPreserved: true,
  });
}

export function engineAssistanceFallbackContent(phrase: Phrase, context: VocabularyAssistanceContextV2): VocabularyAssistanceContentV2 {
  const pronunciationOnly = context.assistanceType === "pronunciation";
  return {
    schemaVersion: "eoe.assistance-content.v2",
    contextualMeaning: pronunciationOnly ? `承接“${context.previousUserMessage.slice(0, 24)}”这个语境` : phrase.baseMeaningZh,
    shortExample: pronunciationOnly ? undefined : phrase.optionalShortExample,
    topicContinuation: `回到“${context.topicSummary}”，我们继续处理刚才的重点。`,
  };
}
