import { z } from "zod";

/** @deprecated eoe.provider-envelope.v1 — deprecated after M2.2. Retained for historical regression only. */
import { conversationFunctions, conversationFunctionSchema } from "@/domain/eoe";
import { EOE_PROVIDER_ENVELOPE_SCHEMA_VERSION } from "../constants";

export const providerEnglishChunkSchema = z
  .object({
    content: z.string().min(1),
    phraseId: z.string().min(1),
  })
  .strict();

export const providerGenerationEnvelopeV1Schema = z
  .object({
    schemaVersion: z.literal(EOE_PROVIDER_ENVELOPE_SCHEMA_VERSION),
    conversationFunction: conversationFunctionSchema,
    beforeText: z.string(),
    englishChunk: providerEnglishChunkSchema.nullable(),
    afterText: z.string(),
    noFit: z.boolean(),
    intentPreserved: z.boolean(),
    naturalnessConfidence: z.number().min(0).max(1),
  })
  .strict();

export type ProviderGenerationEnvelopeV1 = z.infer<typeof providerGenerationEnvelopeV1Schema>;

export const PROVIDER_GENERATION_ENVELOPE_JSON_SCHEMA: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "ProviderGenerationEnvelopeV1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "conversationFunction",
    "beforeText",
    "englishChunk",
    "afterText",
    "noFit",
    "intentPreserved",
    "naturalnessConfidence",
  ],
  properties: {
    schemaVersion: { const: EOE_PROVIDER_ENVELOPE_SCHEMA_VERSION },
    conversationFunction: { type: "string", enum: [...conversationFunctions] },
    beforeText: { type: "string" },
    englishChunk: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["content", "phraseId"],
          properties: {
            content: { type: "string", minLength: 1 },
            phraseId: { type: "string", minLength: 1 },
          },
        },
      ],
    },
    afterText: { type: "string" },
    noFit: { type: "boolean" },
    intentPreserved: { type: "boolean" },
    naturalnessConfidence: { type: "number", minimum: 0, maximum: 1 },
  },
};
