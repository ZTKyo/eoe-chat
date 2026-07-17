import { describe, expect, it } from "vitest";
import { generatedResponseSchema } from "@/domain/chat";
import type { ConversationAnalysis } from "@/domain/eoe";
import {
  classifyMessageSegments,
  classifyTechnicalSurface,
  reviewTechnicalDistinction,
} from "./technical-segment-classification";
import { analyzeResponseObligations, reviewTaskCompleteness } from "./task-completeness";

describe("M2.5.1 technical semantic classification", () => {
  it("classifies identifiers and technical terms separately from Overlay", () => {
    expect(classifyTechnicalSurface("unknown")).toBe("code_identifier");
    expect(classifyTechnicalSurface("TypeScript")).toBe("technical_term");
    expect(classifyMessageSegments([
      { type: "text", content: "TypeScript 中 `unknown` 需要先收窄。", language: "zh" },
      {
        type: "english_chunk",
        content: "for example",
        phraseId: "p-for-example",
        isNew: true,
        assistanceAvailable: true,
      },
    ])).toEqual(expect.arrayContaining([
      { surface: "TypeScript", role: "technical_term" },
      { surface: "unknown", role: "code_identifier" },
      { surface: "for example", role: "english_overlay" },
    ]));
  });

  it("requires the real unknown/any behavioral distinction", () => {
    expect(reviewTechnicalDistinction(
      "TypeScript 中两者都是类型，区别很大。",
      ["TypeScript", "unknown", "any"],
    )).toEqual([
      "technical_any_behavior_missing",
      "technical_unknown_narrowing_missing",
      "technical_unknown_safety_missing",
      "technical_usage_advice_missing",
    ]);
    expect(reviewTechnicalDistinction(
      "`any` 会跳过类型检查，可以直接访问属性；`unknown` 必须先通过类型守卫进行类型收窄，之后才能使用。`unknown` 更安全，通常应优先使用它。",
      ["TypeScript", "unknown", "any"],
    )).toEqual([]);
  });

  it.each([
    "any 类型本质上关闭了类型检查，允许任意操作；unknown 类型强制要求在使用前进行类型收窄，确保了更高的安全性。实际开发通常优先选择 unknown。",
    "TypeScript 里的 unknown 和 any 都能表示任意类型，但 unknown 更安全。any 表示“关闭类型检查”，你可以像操作已知类型那样任意读写属性或调用方法。相比之下，unknown 在使用前必须通过类型守卫、断言或验证将其缩小为具体类型；建议默认使用 unknown。",
  ])("accepts real Provider wording without weakening the distinction: %s", (text) => {
    expect(reviewTechnicalDistinction(text, ["TypeScript", "unknown", "any"])).toEqual([]);
  });

  it("passes a complete TypeScript explanation as domain content", () => {
    const analysis: ConversationAnalysis = {
      primaryFunction: "explain",
      sensitivity: "technical",
      responseLength: "medium",
      overlaySuitability: "medium",
      confidence: 0.95,
    };
    const context = {
      chineseOnlyScope: false,
      difficultySignal: false,
      userEnglishPresent: false,
      userEnglishReuseOpportunity: false,
    };
    const obligations = analyzeResponseObligations({
      userMessage: "解释 TypeScript 里 unknown 和 any 的区别",
      analysis,
      hasImage: false,
      context,
    });
    const response = generatedResponseSchema.parse({
      schemaVersion: "eoe.response.v2",
      policyVersion: "eoe.scheduler.v2.0",
      conversationFunction: "explain",
      segments: [{
        type: "text",
        content: "`any` 会跳过类型检查，因此可以直接访问属性；`unknown` 更安全，因为必须先用类型守卫收窄，之后才能调用或读取。通常应优先使用 `unknown`，只在临时兼容时谨慎使用 `any`。",
        language: "zh",
      }],
      usedPhraseIds: [],
      noFit: true,
      intentPreserved: true,
    });
    expect(reviewTaskCompleteness({
      response,
      obligations,
      analysis,
      context,
    })).toMatchObject({ complete: true, issues: [] });
  });
});
