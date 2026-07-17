import { generatedResponseSchema, plainTextSegment, type GeneratedResponse } from "@/domain/chat";
import type { ConversationAnalysis } from "@/domain/eoe";
import { EOE_POLICY_VERSION } from "./constants";

const NATURAL_FALLBACK_MESSAGE =
  "这次生成的回复没有通过质量检查，我没有显示可能答非所问的内容。请重新发送或点击重试，我会改用中文直接回答。";

export function createNaturalFallback(analysis: ConversationAnalysis): GeneratedResponse {
  return generatedResponseSchema.parse({
    schemaVersion: "eoe.response.v2",
    policyVersion: EOE_POLICY_VERSION,
    conversationFunction: analysis.primaryFunction,
    segments: [plainTextSegment(NATURAL_FALLBACK_MESSAGE)],
    usedPhraseIds: [],
    noFit: true,
    intentPreserved: false,
  });
}
