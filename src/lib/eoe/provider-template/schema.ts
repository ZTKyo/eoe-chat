import { z } from "zod";
import { noFitReasonSchema } from "@/domain/eoe";
import { EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION } from "../constants";

export const EOE_PHRASE_PLACEHOLDER = "{{EOE_PHRASE}}" as const;

export const providerResponseTemplateV1Schema = z.strictObject({
  schemaVersion: z.literal(EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION),
  usePhrase: z.boolean(),
  responseTemplate: z.string(),
  noFitReason: noFitReasonSchema.optional(),
});

export type ProviderResponseTemplateV1 = z.infer<typeof providerResponseTemplateV1Schema>;

export const PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "usePhrase", "responseTemplate"],
  properties: {
    schemaVersion: { type: "string", const: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION },
    usePhrase: { type: "boolean" },
    responseTemplate: { type: "string" },
    noFitReason: {
      type: "string",
      enum: [
        "phrase_not_natural",
        "conversation_too_short",
        "sensitive_context",
        "technical_complexity",
        "no_safe_candidate",
        "explicit_chinese_request",
        "user_requested_lower_difficulty",
        "grammar_mismatch",
        "position_mismatch",
        "translation_risk",
        "label_like_risk",
        "other",
      ],
    },
  },
};
