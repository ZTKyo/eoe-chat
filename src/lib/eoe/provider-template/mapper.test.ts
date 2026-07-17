import { describe, expect, it } from "vitest";
import type { ConversationAnalysis } from "@/domain/eoe";
import { mapProviderTemplateToDomain } from "./mapper";

const analysis: ConversationAnalysis = {
  primaryFunction: "advise", sensitivity: "normal", responseLength: "medium",
  overlaySuitability: "high", confidence: 0.95,
};
const context = {
  analysis, policyVersion: "test-policy", selectedPhraseId: "p-step-by-step",
  selectedPhrase: "step by step", selectedPhraseIsNew: true,
};

describe("Engine-owned Template mapper", () => {
  it.each([
    ["start", "{{EOE_PHRASE}}，先确认条件。", ["english_chunk", "text"]],
    ["middle", "先确认条件，{{EOE_PHRASE}}，再继续。", ["text", "english_chunk", "text"]],
  ])("creates Domain segments for %s without Provider segment metadata", (_name, responseTemplate, types) => {
    const result = mapProviderTemplateToDomain({ schemaVersion: "eoe.provider-template.v1", usePhrase: true, responseTemplate }, context);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.conversationFunction).toBe("advise");
      expect(result.response.segments.map((item) => item.type)).toEqual(types);
      expect(result.response.usedPhraseIds).toEqual(["p-step-by-step"]);
      expect(result.response.segments.find((item) => item.type === "english_chunk")).toMatchObject({
        content: "step by step", phraseId: "p-step-by-step", isNew: true, assistanceAvailable: true,
      });
    }
  });

  it("maps noFit to Engine-owned text semantics", () => {
    const result = mapProviderTemplateToDomain({
      schemaVersion: "eoe.provider-template.v1", usePhrase: false,
      responseTemplate: "我先直接回答问题。", noFitReason: "other",
    }, context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.response).toMatchObject({ conversationFunction: "advise", noFit: true, usedPhraseIds: [] });
  });
});
