import { describe, expect, it } from "vitest";
import { getPhraseById } from "./phrase-registry";
import {
  LIVE_SAFE_PHRASES,
  LIVE_SAFE_REALIZATION_PROFILES,
  LIVE_SAFE_REALIZATION_PROFILE_MAP,
} from "./phrase-realization";

describe("M2.4 Live-Safe Phrase realization set v2", () => {
  it("contains 8-15 existing active phrases without quota activation", () => {
    expect(LIVE_SAFE_PHRASES.length).toBeGreaterThanOrEqual(8);
    expect(LIVE_SAFE_PHRASES.length).toBeLessThanOrEqual(15);
    expect(LIVE_SAFE_PHRASES).toHaveLength(LIVE_SAFE_REALIZATION_PROFILES.length);
    for (const profile of LIVE_SAFE_REALIZATION_PROFILES) {
      expect(getPhraseById(profile.phraseId)?.status).toBe("active");
      expect(profile.liveSafe).toBe(true);
      expect(profile.allowedPositions.length).toBeGreaterThanOrEqual(1);
      expect(profile.taskReplacementRisk).toBeLessThan(0.7);
      expect(profile.forbiddenPatterns.length).toBeGreaterThan(0);
      expect(LIVE_SAFE_REALIZATION_PROFILE_MAP.get(profile.phraseId)).toEqual(profile);
    }
  });

  it("prioritizes simple phrases and removes the human-review failures from Live-Safe", () => {
    const ids = new Set(LIVE_SAFE_PHRASES.map((item) => item.id));
    for (const id of [
      "p-i-think",
      "p-it-depends",
      "p-that-makes-sense",
      "p-for-example",
      "p-for-now",
    ]) expect(ids.has(id)).toBe(true);
    expect(ids.has("p-a-little")).toBe(false);
    expect(ids.has("p-kind-of")).toBe(false);
    expect(ids.has("p-maybe")).toBe(false);
    expect(ids.has("p-step-by-step")).toBe(false);
    expect(ids.has("p-take-a-closer-look")).toBe(false);
  });

  it("keeps every profile structurally complete and unique", () => {
    expect(new Set(LIVE_SAFE_REALIZATION_PROFILES.map((item) => item.phraseId)).size).toBe(LIVE_SAFE_REALIZATION_PROFILES.length);
    expect(LIVE_SAFE_REALIZATION_PROFILES.every((item) => item.forbiddenBeforePunctuation.includes("："))).toBe(true);
  });
});
