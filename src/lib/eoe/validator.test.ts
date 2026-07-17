import { describe, expect, it } from "vitest";
import type { CandidateSelection, ConversationAnalysis, OverlayDecision } from "@/domain/eoe";
import { validateStructuredResponse } from "./validator";

const phraseId = "p-good-place-to-start";
const phrase = "a good place to start";
const analysis: ConversationAnalysis = { primaryFunction: "answer", sensitivity: "normal", responseLength: "medium", overlaySuitability: "high", confidence: 0.9 };
const decision: OverlayDecision = { mode: "preferred", fixedLevel: 2, effectiveLevel: 2, maxNewFocus: 1, maxEnglishSegments: 1, reusePreferred: true, candidateCount: 1, reasonCodes: [], policyVersion: "eoe.scheduler.v1.1" };

function selection(overrides: Partial<CandidateSelection["candidates"][number]> = {}): CandidateSelection {
  return {
    candidates: [{
      phraseId,
      score: 90,
      reasons: [],
      isReuse: false,
      grammaticalFit: "high",
      insertionPosition: "sentence_middle",
      allowedPositions: ["sentence_middle"],
      bilingualCompatibility: 0.9,
      punctuationRisk: 0.15,
      translationRisk: 0.2,
      labelLikeRisk: 0.2,
      responseLengthFit: "high",
      ...overrides,
    }],
    selectedPhraseId: phraseId,
    noFit: false,
    selectorVersion: "eoe.selector.v1.1",
  };
}

function response(overrides: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: "eoe.response.v2",
    policyVersion: "eoe.scheduler.v1.1",
    conversationFunction: "answer",
    segments: [
      { type: "text", content: "我觉得先确认最重要的目标，是 ", language: "zh" },
      { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true },
      { type: "text", content: "；之后再决定下一步。", language: "zh" },
    ],
    usedPhraseIds: [phraseId],
    noFit: false,
    naturalnessConfidence: 0.96,
    intentPreserved: true,
    ...overrides,
  };
}

function codes(raw: unknown, candidateSelection = selection()): string[] {
  return validateStructuredResponse(raw, { analysis, decision, selection: candidateSelection }).result.violations.map((item) => item.code);
}

describe("M2.1 Hard Validator", () => {
  it("accepts a sentence-middle, grammar-supported Semantic response", () => {
    expect(validateStructuredResponse(response(), { analysis, decision, selection: selection() }).result.valid).toBe(true);
  });

  it("does not mistake ordinary plan content about knowledge points for Teacher Mode", () => {
    expect(codes(response({
      segments: [
        { type: "text", content: "周六整理本周知识点，", language: "zh" },
        { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true },
        { type: "text", content: "；周日再复盘调整。", language: "zh" },
      ],
    }))).not.toContain("teacher_mode");
  });

  it("does not apply English-teaching rules to technical identifiers in ordinary text", () => {
    const raw = response({
      segments: [
        {
          type: "text",
          content: "TypeScript 中 `unknown` 必须先通过类型守卫收窄，",
          language: "zh",
        },
        { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true },
        {
          type: "text",
          content: "；而 `any` 会跳过类型检查，所以可以直接访问属性。",
          language: "zh",
        },
      ],
    });
    expect(codes(raw)).not.toEqual(expect.arrayContaining([
      "teacher_mode",
      "automatic_gloss",
      "duplicated_translation",
    ]));
  });

  it.each([
    ["invalid_phrase_id", response({ segments: [{ type: "text", content: "可以先 ", language: "zh" }, { type: "english_chunk", content: "invented", phraseId: "missing", isNew: true, assistanceAvailable: true }, { type: "text", content: " 再继续。", language: "zh" }], usedPhraseIds: ["missing"] })],
    ["teacher_mode", response({ segments: [{ type: "text", content: "今天我们来学习这个短语，是 ", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "。", language: "zh" }] })],
    ["automatic_gloss", response({ segments: [{ type: "text", content: "我觉得这是 ", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "（意思是一个好的开始。）", language: "zh" }] })],
    ["unsolicited_pronunciation", response({ segments: [{ type: "text", content: "发音是 /ə gʊd pleɪs/，这是 ", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "。", language: "zh" }] })],
    ["translation_mode", response({ segments: [{ type: "text", content: "你的话翻译成英文是 ", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "。", language: "zh" }] })],
  ] as const)("blocks %s", (code, raw) => {
    expect(codes(raw)).toContain(code);
  });

  it.each([
    ["label_like_overlay", response({ segments: [{ type: "text", content: "建议是 ", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "：先确认目标。", language: "zh" }] })],
    ["orphan_english_chunk", response({ segments: [{ type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }], usedPhraseIds: [phraseId] })],
    ["unnatural_segment_boundary", response({ segments: [{ type: "text", content: "这是", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "然后继续", language: "zh" }] })],
    ["punctuation_boundary_error", response({ segments: [{ type: "text", content: "这是", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "然后继续", language: "zh" }] })],
    ["duplicated_translation", response({ segments: [{ type: "text", content: "英文意思是 ", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "，然后继续。", language: "zh" }] })],
    ["phrase_position_violation", response({ segments: [{ type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "，然后继续。", language: "zh" }] })],
    ["isolated_learning_card_style", response({ segments: [{ type: "text", content: "建议\n", language: "zh" }, { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true }, { type: "text", content: "\n之后继续。", language: "zh" }] })],
  ] as const)("blocks M2.1 violation %s", (code, raw) => {
    expect(codes(raw)).toContain(code);
  });

  it("blocks grammatical mismatch and forced overlay", () => {
    expect(codes(response(), selection({ grammaticalFit: "low" }))).toContain("grammatical_role_mismatch");
    const noFitSelection = { ...selection(), candidates: [], selectedPhraseId: undefined, noFit: true };
    expect(codes(response(), noFitSelection)).toContain("forced_overlay");
  });

  it("accepts a live-safe clause stem with substantive Chinese clause support", () => {
    const phraseSelection: CandidateSelection = {
      candidates: [{
        phraseId: "p-i-think",
        score: 100,
        reasons: ["user_phrase_reuse"],
        isReuse: true,
        grammaticalFit: "high",
        insertionPosition: "sentence_start",
        allowedPositions: ["sentence_start"],
        bilingualCompatibility: 0.9,
        punctuationRisk: 0.15,
        translationRisk: 0.2,
        labelLikeRisk: 0.2,
        responseLengthFit: "high",
      }],
      selectedPhraseId: "p-i-think",
      noFit: false,
      selectorVersion: "eoe.selector.v1.1",
    };
    const valid = response({
      segments: [
        { type: "english_chunk", content: "I think", phraseId: "p-i-think", isNew: false, assistanceAvailable: true },
        { type: "text", content: "，这个计划确实有用，但还要确认执行成本。", language: "zh" },
      ],
      usedPhraseIds: ["p-i-think"],
    });
    const metaPreamble = response({
      segments: [
        { type: "english_chunk", content: "I think", phraseId: "p-i-think", isNew: false, assistanceAvailable: true },
        { type: "text", content: "，先给出明确判断，再说明理由。", language: "zh" },
      ],
      usedPhraseIds: ["p-i-think"],
    });
    expect(codes(valid, phraseSelection)).not.toContain("grammatical_role_mismatch");
    expect(codes(metaPreamble, phraseSelection)).toContain("grammatical_role_mismatch");
  });

  it("blocks budget overflow and broken output", () => {
    const over = response({
      segments: [
        { type: "text", content: "这是 ", language: "zh" },
        { type: "english_chunk", content: phrase, phraseId, isNew: true, assistanceAvailable: true },
        { type: "text", content: "，同时 ", language: "zh" },
        { type: "english_chunk", content: phrase, phraseId, isNew: false, assistanceAvailable: true },
        { type: "text", content: "。", language: "zh" },
      ],
    });
    expect(codes(over)).toContain("overlay_budget_exceeded");
    expect(codes(undefined)[0]).toBe("broken_structured_output");
  });
});
