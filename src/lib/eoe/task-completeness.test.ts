import { describe, expect, it } from "vitest";
import { generatedResponseSchema } from "@/domain/chat";
import type { ConversationAnalysis } from "@/domain/eoe";
import { getPhraseById } from "./registry/phrase-registry";
import { analyzeResponseObligations, reviewTaskCompleteness } from "./task-completeness";

const analysis: ConversationAnalysis = {
  primaryFunction: "advise",
  sensitivity: "normal",
  responseLength: "medium",
  overlaySuitability: "high",
  confidence: 0.9,
};
const context = {
  chineseOnlyScope: false,
  difficultySignal: false,
  userEnglishPresent: false,
  userEnglishReuseOpportunity: false,
};

function response(text: string) {
  return generatedResponseSchema.parse({
    schemaVersion: "eoe.response.v2",
    policyVersion: "eoe.scheduler.v2.0",
    conversationFunction: "advise",
    segments: [{ type: "text", content: text, language: "zh" }],
    usedPhraseIds: [],
    noFit: true,
  });
}

describe("M2.4 Task Completeness", () => {
  it("keeps plan obligations independent of noFit", () => {
    const obligations = analyzeResponseObligations({
      userMessage: "我该怎么安排下周学习计划？",
      analysis,
      hasImage: false,
      context,
    });
    const incomplete = reviewTaskCompleteness({
      response: response("先完成最小的一步。"),
      obligations,
      analysis,
      context,
    });
    expect(incomplete.complete).toBe(false);
    expect(incomplete.missingObligationIds).toContain("obligation-provide_plan");

    const complete = reviewTaskCompleteness({
      response: response("周一先确定本周目标和优先级；周二到周四每天练习 30 分钟；周五整理错题，周末复习检查。最小行动是今天列出三项任务，再根据完成率和反馈调整下周计划。"),
      obligations,
      analysis,
      context,
    });
    expect(complete.complete).toBe(true);
  });

  it("requires actionable comparison dimensions rather than a slogan", () => {
    const obligations = analyzeResponseObligations({
      userMessage: "两个方案拿不定主意，我该怎么选择？",
      analysis,
      hasImage: false,
      context,
    });
    expect(reviewTaskCompleteness({ response: response("先列出优缺点。"), obligations, analysis, context }).complete).toBe(false);
    expect(reviewTaskCompleteness({
      response: response("用成本、时间、风险和效果四个维度做表格并按 1–5 分记录；按重要性设置权重后权衡总分，再小范围试用一周并保留可逆退出。下一步是今天把数据写进表里。"),
      obligations,
      analysis,
      context,
    }).complete).toBe(true);
  });

  it("uses contextual assistance obligations instead of generic causal explanation obligations", () => {
    const assistanceContext = {
      ...context,
      assistance: {
        active: true as const,
        trigger: "click" as const,
        resolved: true,
        phraseId: "p-for-now",
        phrase: getPhraseById("p-for-now"),
        sourceSentence: "先列任务，for now，今天完成第一项。",
        sourceTemplate: "先列任务，{{EOE_PHRASE}}，今天完成第一项。",
        sourcePhraseSurface: "for now",
        topic: "我该怎么安排计划？",
        ambiguousPhraseIds: [],
        referenceResolution: {
          status: "resolved" as const,
          phraseId: "p-for-now",
          sourceMessageId: "a1",
          sourceSegmentIndex: 0,
        },
      },
    };
    const explainAnalysis = { ...analysis, primaryFunction: "explain" as const };
    const obligations = analyzeResponseObligations({
      userMessage: "请简短解释刚才的英文短语，然后继续原来的话题。",
      analysis: explainAnalysis,
      hasImage: false,
      context: assistanceContext,
    });
    expect(obligations.map((item) => item.kind)).toEqual([
      "answer_question",
      "clarify_prior_phrase",
      "continue_context",
    ]);
    expect(obligations.map((item) => item.kind)).not.toContain("explain_concept");
    expect(obligations.map((item) => item.kind)).not.toContain("provide_reasons");
  });
});
