import { describe, expect, it } from "vitest";
import { M24_CORE_CORPUS_IDS, M24_MULTI_TURN_CORPUS, NATURAL_OVERLAY_OPPORTUNITY_CORPUS } from "./m2-4-corpora";

describe("M2.4 evaluation corpora", () => {
  it("keeps Core20, Opportunity12, and eight real multi-turn histories separate", () => {
    expect(M24_CORE_CORPUS_IDS).toHaveLength(20);
    expect(NATURAL_OVERLAY_OPPORTUNITY_CORPUS).toHaveLength(12);
    expect(M24_MULTI_TURN_CORPUS).toHaveLength(8);
    expect(M24_MULTI_TURN_CORPUS.every((scenario) => scenario.turns.length >= 2)).toBe(true);
    expect(M24_MULTI_TURN_CORPUS.filter((scenario) => scenario.turns.length >= 3).length).toBeGreaterThanOrEqual(7);
  });
});
