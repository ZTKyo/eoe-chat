import { describe, expect, it } from "vitest";
import { phraseSchema } from "@/domain/eoe";
import { PHRASE_REGISTRY, REGISTRY_VERSION } from "./phrase-registry";
import { LIVE_SAFE_PHRASES } from "./phrase-realization";

describe("Phrase Registry", () => {
  it("contains 50 unique, schema-valid phrases with audited M2.1 language metadata", () => {
    expect(PHRASE_REGISTRY).toHaveLength(50);
    expect(new Set(PHRASE_REGISTRY.map((phrase) => phrase.id)).size).toBe(50);
    for (const phrase of PHRASE_REGISTRY) {
      expect(phraseSchema.parse(phrase).registryVersion).toBe(REGISTRY_VERSION);
      expect(phrase.conversationFunctions.length).toBeGreaterThan(0);
      expect(phrase.preferredPositions.length).toBeGreaterThan(0);
      expect(phrase.punctuationCompatibility.length).toBeGreaterThan(0);
      expect(phrase.unsafePatterns).toContain("{phrase}：{chinese_explanation}");
    }
    expect(PHRASE_REGISTRY.filter((phrase) => phrase.status === "active").length).toBeGreaterThanOrEqual(26);
    expect(PHRASE_REGISTRY.filter((phrase) => phrase.status === "disabled").length).toBeGreaterThan(0);
    expect(PHRASE_REGISTRY.filter((phrase) => phrase.status === "active").every((phrase) => phrase.bilingualPatterns.length > 0)).toBe(true);
  });

  it("keeps the initial registry curated and reusable", () => {
    expect(PHRASE_REGISTRY.filter((phrase) => phrase.level <= 2).length).toBeGreaterThanOrEqual(40);
    expect(PHRASE_REGISTRY.every((phrase) => phrase.reuseValue >= 0.7)).toBe(true);
  });

  it("provides Engine-owned assistance metadata for every Live-Safe Phrase", () => {
    expect(LIVE_SAFE_PHRASES).toHaveLength(8);
    expect(LIVE_SAFE_PHRASES.every((phrase) => phrase.pronunciation.trim().length > 0)).toBe(true);
    expect(LIVE_SAFE_PHRASES.every((phrase) => phrase.baseMeaningZh.trim().length > 0)).toBe(true);
    expect(LIVE_SAFE_PHRASES.every((phrase) => phrase.optionalShortExample?.trim())).toBe(true);
  });
});
