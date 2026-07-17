import { describe, expect, it } from "vitest";
import type { ConversationAnalysis } from "@/domain/eoe";
import { scheduleOverlay } from "./scheduler";

const normal: ConversationAnalysis = {
  primaryFunction: "answer",
  sensitivity: "normal",
  responseLength: "medium",
  overlaySuitability: "high",
  confidence: 0.9,
};

describe("Overlay Scheduler", () => {
  it("is deterministic and preserves the fixed level", () => {
    const first = scheduleOverlay({ analysis: normal, fixedLevel: 2, enabled: true, hasImage: false });
    const second = scheduleOverlay({ analysis: normal, fixedLevel: 2, enabled: true, hasImage: false });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ mode: "preferred", fixedLevel: 2, effectiveLevel: 2, maxNewFocus: 1 });
  });

  it("temporarily lowers high-stakes turns without mutating fixed level", () => {
    const result = scheduleOverlay({
      analysis: { ...normal, sensitivity: "high_stakes", overlaySuitability: "low" },
      fixedLevel: 4,
      enabled: true,
      hasImage: false,
    });
    expect(result.fixedLevel).toBe(4);
    expect(result.effectiveLevel).toBe(1);
    expect(result.reasonCodes).toContain("high_stakes_clarity_first");
  });

  it("skips when the context is unsuitable", () => {
    expect(
      scheduleOverlay({ analysis: { ...normal, overlaySuitability: "none" }, fixedLevel: 2, enabled: true, hasImage: false }).mode,
    ).toBe("skip");
  });

  it("disables automatic Overlay on every image turn", () => {
    const result = scheduleOverlay({ analysis: normal, fixedLevel: 2, enabled: true, hasImage: true });
    expect(result).toMatchObject({
      mode: "disabled_for_image",
      fixedLevel: 2,
      effectiveLevel: 2,
      maxNewFocus: 0,
      maxEnglishSegments: 0,
      candidateCount: 0,
    });
    expect(result.reasonCodes).toContain("image_overlay_deferred");
  });
});
