import { describe, expect, it } from "vitest";
import { parseProviderEnvelope, validateProviderEnvelopeSemantics } from "./parser";
import type { ProviderGenerationEnvelopeV1 } from "./schema";

const context = {
  selectedPhraseId: "p-good-place-to-start",
  selectedPhrase: "a good place to start",
  selectedPhraseVariants: [],
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

function codes(result: ReturnType<typeof parseProviderEnvelope>): string[] {
  return result.success ? [] : result.diagnostics.map((item) => item.code);
}

describe("Provider Envelope parser stages", () => {
  it("parses a valid raw Envelope without repairing it", () => {
    const raw = JSON.stringify(envelope());
    const result = parseProviderEnvelope(raw, context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.envelope.beforeText).toBe("我觉得先确认最重要的目标，是 ");
  });

  it("accepts a valid noFit Envelope without a selected Phrase", () => {
    const result = parseProviderEnvelope(
      JSON.stringify(envelope({ beforeText: "直接回答。", englishChunk: null, afterText: "", noFit: true })),
      {},
    );
    expect(result.success).toBe(true);
  });

  it.each([
    ["", "provider_empty_response"],
    ["not json", "provider_non_json_response"],
    [`\`\`\`json\n${JSON.stringify(envelope())}\n\`\`\``, "provider_markdown_wrapped_json"],
  ])("reports text/JSON stage failure for %j", (raw, expected) => {
    expect(codes(parseProviderEnvelope(raw, context))).toContain(expected);
  });

  it("reports missing fields, legacy segments, extra fields, and invalid confidence separately", () => {
    const missing = { ...envelope() } as Record<string, unknown>;
    delete missing.beforeText;
    expect(codes(parseProviderEnvelope(JSON.stringify(missing), context))).toContain("missing_beforeText");
    const missingAfter = { ...envelope() } as Record<string, unknown>;
    delete missingAfter.afterText;
    expect(codes(parseProviderEnvelope(JSON.stringify(missingAfter), context))).toContain("missing_afterText");
    expect(codes(parseProviderEnvelope(JSON.stringify({ ...envelope(), englishChunk: "invalid" }), context))).toContain(
      "invalid_englishChunk",
    );
    expect(codes(parseProviderEnvelope(JSON.stringify({ ...envelope(), segments: [] }), context))).toContain(
      "unexpected_segments_array",
    );
    expect(codes(parseProviderEnvelope(JSON.stringify({ ...envelope(), explanation: "x" }), context))).toContain(
      "unexpected_extra_field",
    );
    expect(codes(parseProviderEnvelope(JSON.stringify({ ...envelope(), naturalnessConfidence: 2 }), context))).toContain(
      "invalid_confidence",
    );
  });

  it("rejects noFit conflict, Phrase mismatch, and unknown Phrase semantically", () => {
    expect(codes(parseProviderEnvelope(JSON.stringify(envelope({ noFit: true })), context))).toEqual(
      expect.arrayContaining(["provider_envelope_semantic_failed", "provider_no_fit_conflict", "noFit_chunk_conflict"]),
    );
    expect(codes(parseProviderEnvelope(JSON.stringify(envelope({ englishChunk: null, noFit: false })), context))).toContain(
      "provider_no_fit_conflict",
    );
    expect(
      codes(
        parseProviderEnvelope(
          JSON.stringify(
            envelope({ englishChunk: { content: "for now", phraseId: "p-for-now" } }),
          ),
          context,
        ),
      ),
    ).toEqual(expect.arrayContaining(["provider_phrase_mismatch", "phrase_id_mismatch"]));
    expect(
      codes(
        parseProviderEnvelope(
          JSON.stringify(envelope({ englishChunk: { content: "invented", phraseId: "p-unknown" } })),
          context,
        ),
      ),
    ).toEqual(expect.arrayContaining(["provider_phrase_mismatch", "invalid_phrase_id"]));
  });

  it("keeps semantic checks separate from Zod shape checks", () => {
    const result = validateProviderEnvelopeSemantics(envelope({ beforeText: "", afterText: "" }), context);
    expect(result.map((item) => item.code)).toContain("provider_envelope_semantic_failed");
    expect(result.every((item) => item.stage === "provider_envelope_semantics")).toBe(true);
  });
});
