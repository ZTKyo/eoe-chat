import { describe, expect, it } from "vitest";
import { generatedResponseSchema, plainTextSegment, segmentsToPlainText } from "./chat";

describe("generatedResponseSchema", () => {
  it("accepts a noFit plain response", () => {
    const result = generatedResponseSchema.parse({
      schemaVersion: "eoe.response.v2",
      policyVersion: "eoe.scheduler.v1",
      conversationFunction: "answer",
      segments: [plainTextSegment("这是一个正常回复。")],
      usedPhraseIds: [],
      noFit: true,
    });
    expect(result.noFit).toBe(true);
  });

  it("rejects mismatched phrase ids", () => {
    const result = generatedResponseSchema.safeParse({
      schemaVersion: "eoe.response.v2",
      policyVersion: "eoe.scheduler.v1",
      conversationFunction: "answer",
      segments: [
        {
          type: "english_chunk",
          content: "makes sense",
          phraseId: "phrase-1",
          isNew: false,
          assistanceAvailable: true,
        },
      ],
      usedPhraseIds: [],
      noFit: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects English chunks in a noFit response", () => {
    const result = generatedResponseSchema.safeParse({
      schemaVersion: "eoe.response.v2",
      policyVersion: "eoe.scheduler.v1",
      conversationFunction: "react",
      segments: [
        {
          type: "english_chunk",
          content: "I see",
          phraseId: "phrase-2",
          isNew: true,
          assistanceAvailable: true,
        },
      ],
      usedPhraseIds: ["phrase-2"],
      noFit: true,
    });
    expect(result.success).toBe(false);
  });

  it("preserves boundary whitespace in an exact Plain Text Projection", () => {
    const parsed = generatedResponseSchema.parse({
      schemaVersion: "eoe.response.v2",
      policyVersion: "eoe.scheduler.v1.1",
      conversationFunction: "advise",
      segments: [
        { type: "text", content: "我觉得先确认最重要的目标，是 ", language: "zh" },
        { type: "english_chunk", content: "a good place to start", phraseId: "p-good-place-to-start", isNew: true, assistanceAvailable: true },
        { type: "text", content: "；之后再决定具体动作。", language: "zh" },
      ],
      usedPhraseIds: ["p-good-place-to-start"],
      noFit: false,
    });
    expect(segmentsToPlainText(parsed.segments)).toBe("我觉得先确认最重要的目标，是 a good place to start；之后再决定具体动作。");
  });
});
