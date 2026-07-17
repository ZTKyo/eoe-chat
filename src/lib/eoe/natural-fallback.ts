import { generatedResponseSchema, plainTextSegment, type GeneratedResponse } from "@/domain/chat";
import type { ConversationAnalysis } from "@/domain/eoe";
import { EOE_POLICY_VERSION } from "./constants";

function fallbackText(analysis: ConversationAnalysis, userMessage: string): string {
  const topic = userMessage.trim().replace(/\s+/gu, " ").slice(0, 48);
  switch (analysis.primaryFunction) {
    case "empathize":
      return "这件事确实会让人不好受。先别急着逼自己马上解决一切；可以先确认眼下最需要照顾的是情绪、休息，还是一个具体问题，我会继续陪你把它理清。";
    case "advise":
      return `关于“${topic}”，可以先明确最重要的目标，再选一个成本低、可逆、今天就能开始的小步骤。把具体限制告诉我后，我可以继续替你细化。`;
    case "explain":
      return `关于“${topic}”，先抓住核心关系：确认现象、找出直接原因，再区分触发条件和长期因素。你把具体例子或报错补充出来，我可以继续给出针对性的解释。`;
    case "clarify":
      return `关于“${topic}”，我会换一种更直接的说法：先确认你卡住的具体部分，再用一个具体例子解释，避免同时引入太多概念。`;
    case "summarize":
      return `关于“${topic}”，可以先归纳为三点：核心目标、当前限制，以及下一步可执行动作。若你把原文补充完整，我可以按这个结构直接整理。`;
    case "analyze_image":
      return "我会先按图片中可以确认的内容描述，不对模糊细节作过度推断。你也可以指出最希望我关注的区域，我会围绕那个重点继续分析。";
    case "complete_task":
      return `我会按“${topic}”的实际目标处理，优先保留必要信息和可直接使用的结果。若有格式、长度或语气限制，可以继续补充。`;
    case "ask_follow_up":
      return "最有帮助的信息通常是：你的目标、当前情况、已经尝试过什么，以及不能接受的限制。先补充其中最关键的一项就可以。";
    case "react":
      return "明白了。你可以继续说，我会沿着当前话题回应。";
    default:
      return `关于“${topic}”，我会先直接处理你的实际问题。为了给出更准确的答案，可以从目标、现状和限制三个方面继续展开。`;
  }
}

export function createNaturalFallback(analysis: ConversationAnalysis, userMessage: string): GeneratedResponse {
  return generatedResponseSchema.parse({
    schemaVersion: "eoe.response.v2",
    policyVersion: EOE_POLICY_VERSION,
    conversationFunction: analysis.primaryFunction,
    segments: [plainTextSegment(fallbackText(analysis, userMessage))],
    usedPhraseIds: [],
    noFit: true,
    intentPreserved: true,
  });
}
