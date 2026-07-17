import { describe, expect, it } from "vitest";
import type { ProviderGenerationEnvelopeV1 } from "./schema";
import { mapProviderEnvelopeToDomain } from "./mapper";

const context = {
  policyVersion: "eoe.scheduler.v1.1",
  selectedPhraseId: "p-good-place-to-start",
  selectedPhrase: "a good place to start",
  selectedPhraseVariants: [],
  selectedPhraseIsNew: true,
};

function envelope(overrides: Partial<ProviderGenerationEnvelopeV1> = {}): ProviderGenerationEnvelopeV1 {
  return {
    schemaVersion: "eoe.provider-envelope.v1",
    conversationFunction: "advise",
    beforeText: "我觉得先确认最重要的目标，是 ",
    englishChunk: { content: "a good place to start", phraseId: "p-good-place-to-start" },
    afterText: "；之后再决定具体动作。",
    noFit: false,
    intentPreserved: true,
    naturalnessConfidence: 0.91,
    ...overrides,
  };
}

describe("Provider Envelope to Domain mapper", () => {
  it("adds Domain-only English Segment fields deterministically", () => {
    const result = mapProviderEnvelopeToDomain(envelope(), context);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.response).toMatchObject({
      schemaVersion: "eoe.response.v2",
      policyVersion: "eoe.scheduler.v1.1",
      usedPhraseIds: ["p-good-place-to-start"],
      noFit: false,
    });
    expect(result.response.segments[1]).toEqual({
      type: "english_chunk",
      content: "a good place to start",
      phraseId: "p-good-place-to-start",
      isNew: true,
      assistanceAvailable: true,
    });
    expect(result.response.segments[0]).toMatchObject({ type: "text", language: "zh" });
  });

  it("maps noFit to ordinary Domain text without inventing a Chunk", () => {
    const result = mapProviderEnvelopeToDomain(
      envelope({ beforeText: "直接回答用户问题。", englishChunk: null, afterText: "", noFit: true }),
      { ...context, selectedPhraseId: undefined, selectedPhrase: undefined, selectedPhraseIsNew: false },
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.segments).toEqual([{ type: "text", content: "直接回答用户问题。", language: "zh" }]);
      expect(result.response.usedPhraseIds).toEqual([]);
    }
  });

  it.each([
    ["beforeText", envelope({ beforeText: "" })],
    ["afterText", envelope({ afterText: "" })],
  ])("preserves an empty %s slot without rewriting content", (_name, input) => {
    const result = mapProviderEnvelopeToDomain(input, context);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.segments.map((segment) => segment.content).join("")).toBe(
        `${input.beforeText}${input.englishChunk?.content ?? ""}${input.afterText}`,
      );
    }
  });

  it("fails defensively for mismatched or unknown Phrase IDs", () => {
    for (const englishChunk of [
      { content: "for now", phraseId: "p-for-now" },
      { content: "invented", phraseId: "p-unknown" },
    ]) {
      const result = mapProviderEnvelopeToDomain(envelope({ englishChunk }), context);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.diagnostics[0]?.code).toBe("mapper_failed");
    }
  });

  it("reports a Domain Schema failure without repairing an empty noFit response", () => {
    const result = mapProviderEnvelopeToDomain(
      envelope({ beforeText: "", englishChunk: null, afterText: "", noFit: true }),
      { ...context, selectedPhraseId: undefined, selectedPhrase: undefined, selectedPhraseIsNew: false },
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics[0]).toMatchObject({ stage: "domain_schema", code: "domain_schema_failed" });
    }
  });
});
