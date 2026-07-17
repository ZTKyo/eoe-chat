import { describe, expect, it } from "vitest";
import { noFitReasons } from "@/domain/eoe";
import {
  EOE_PHRASE_PLACEHOLDER,
  PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA,
  providerResponseTemplateV1Schema,
} from "./schema";

describe("ProviderResponseTemplateV1 schema", () => {
  it("accepts the strict four-field DTO surface", () => {
    expect(providerResponseTemplateV1Schema.safeParse({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: true,
      responseTemplate: `${EOE_PHRASE_PLACEHOLDER}，先确认条件。`,
    }).success).toBe(true);
    for (const noFitReason of noFitReasons) {
      expect(providerResponseTemplateV1Schema.safeParse({
        schemaVersion: "eoe.provider-template.v1",
        usePhrase: false,
        responseTemplate: "先确认条件。",
        noFitReason,
      }).success).toBe(true);
    }
  });

  it("rejects old Provider control fields as additionalProperties", () => {
    for (const extra of ["conversationFunction", "phraseId", "segments", "usedPhraseIds", "intentPreserved", "naturalnessConfidence"]) {
      const result = providerResponseTemplateV1Schema.safeParse({
        schemaVersion: "eoe.provider-template.v1",
        usePhrase: false,
        responseTemplate: "直接回答。",
        noFitReason: "other",
        [extra]: extra === "segments" || extra === "usedPhraseIds" ? [] : "forbidden",
      });
      expect(result.success, extra).toBe(false);
    }
  });

  it("publishes a strict JSON Schema", () => {
    expect(PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["schemaVersion", "usePhrase", "responseTemplate"],
    });
  });
});
