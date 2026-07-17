import { describe, expect, it } from "vitest";
import { LIVE_SAFE_PHRASES } from "./registry/phrase-realization";
import { detectUserPhraseReuse } from "./user-phrase-reuse";

describe("UserPhraseReuseDetector", () => {
  it("detects an exact Registry Phrase", () => {
    expect(detectUserPhraseReuse("I think this plan works，你怎么看？", LIVE_SAFE_PHRASES)).toMatchObject({
      phraseId: "p-i-think",
      matchedText: "I think",
      source: "exact",
      confidence: 1,
    });
  });

  it("detects case and punctuation normalized variants", () => {
    expect(detectUserPhraseReuse("（IT DEPENDS），我再补充条件。", LIVE_SAFE_PHRASES)).toMatchObject({
      phraseId: "p-it-depends",
      source: "normalized_variant",
    });
  });

  it("does not infer arbitrary English", () => {
    expect(detectUserPhraseReuse("This custom sentence is useful.", LIVE_SAFE_PHRASES)).toBeUndefined();
  });
});
