import { describe, expect, it } from "vitest";
import {
  PROVIDER_GENERATION_ENVELOPE_JSON_SCHEMA,
  providerGenerationEnvelopeV1Schema,
} from "./schema";

const noFitEnvelope = {
  schemaVersion: "eoe.provider-envelope.v1",
  conversationFunction: "answer",
  beforeText: "我先直接回答这个问题。",
  englishChunk: null,
  afterText: "",
  noFit: true,
  intentPreserved: true,
  naturalnessConfidence: 0.87,
} as const;

describe("ProviderGenerationEnvelopeV1 schema", () => {
  it("accepts the fixed noFit and English Chunk slots", () => {
    expect(providerGenerationEnvelopeV1Schema.safeParse(noFitEnvelope).success).toBe(true);
    expect(
      providerGenerationEnvelopeV1Schema.safeParse({
        ...noFitEnvelope,
        beforeText: "我觉得先确认目标，是 ",
        englishChunk: { content: "a good place to start", phraseId: "p-good-place-to-start" },
        afterText: "；之后再决定下一步。",
        noFit: false,
      }).success,
    ).toBe(true);
  });

  it("requires every slot and rejects extra fields and invalid confidence", () => {
    const missing: Record<string, unknown> = { ...noFitEnvelope };
    delete missing.beforeText;
    expect(providerGenerationEnvelopeV1Schema.safeParse(missing).success).toBe(false);
    expect(providerGenerationEnvelopeV1Schema.safeParse({ ...noFitEnvelope, segments: [] }).success).toBe(false);
    expect(providerGenerationEnvelopeV1Schema.safeParse({ ...noFitEnvelope, naturalnessConfidence: 1.01 }).success).toBe(false);
  });

  it("exports an equivalent strict JSON Schema", () => {
    const schema = PROVIDER_GENERATION_ENVELOPE_JSON_SCHEMA as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      "schemaVersion",
      "conversationFunction",
      "beforeText",
      "englishChunk",
      "afterText",
      "noFit",
      "intentPreserved",
      "naturalnessConfidence",
    ]);
    expect((schema.properties.englishChunk as { anyOf: unknown[] }).anyOf[0]).toEqual({ type: "null" });
    expect(schema.properties.naturalnessConfidence).toMatchObject({ minimum: 0, maximum: 1 });
  });
});
