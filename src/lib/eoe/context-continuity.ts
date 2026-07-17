import { segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type { ValidationResult } from "@/domain/eoe";
import type { ConversationContext } from "./conversation-context";

const resetPattern =
  /你好|您好|请问有什么可以帮|有什么可以帮助|你想讨论什么|可以直接说你想聊什么/u;

export function validateContextContinuity(input: {
  response: GeneratedResponse;
  context: ConversationContext;
}): ValidationResult {
  const text = segmentsToPlainText(input.response.segments);
  const violations: ValidationResult["violations"] = [];
  if (input.context.contextualAcknowledgement?.active && resetPattern.test(text)) {
    violations.push({
      code: "context_reset_after_acknowledgement",
      severity: "error",
      details: input.context.contextualAcknowledgement.priorTopic,
    });
  }
  if (input.context.difficultySignal && resetPattern.test(text)) {
    violations.push({ code: "difficulty_context_reset", severity: "error" });
  }
  if (
    input.context.difficultySignal &&
    /非常抱歉|深表歉意|作为.{0,12}人工智能|我们要面对现实|你说得对/u.test(text)
  ) {
    violations.push({ code: "difficulty_response_disconnected", severity: "error" });
  }
  return {
    valid: violations.length === 0,
    violations,
    retryable: violations.length > 0,
  };
}
