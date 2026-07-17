import { describe, expect, it } from "vitest";
import {
  analyzeComparisonDecisionRequirements,
  reviewComparisonDecisionRequirements,
} from "./comparison-requirements";

describe("M2.5.1 proportional Comparison Decision Requirements", () => {
  const requirements = analyzeComparisonDecisionRequirements(
    "两个方案拿不定主意，我该怎么做选择？",
  );

  it("requires dimensions, priority, trade-off, recording and a next action without forcing a trial", () => {
    expect(requirements).toEqual({
      needsComparisonDimensions: true,
      minimumDimensionCount: 2,
      needsUserPriority: true,
      needsTradeOff: true,
      needsRecordingMethod: true,
      needsReversibleTest: false,
      needsNextAction: true,
    });
  });

  it("reports precise evidence gaps", () => {
    expect(reviewComparisonDecisionRequirements("再想一想就决定。", requirements)).toEqual(
      expect.arrayContaining([
        "missing_comparison_dimensions",
        "missing_user_priority",
        "missing_trade_off",
        "missing_recording_method",
        "missing_next_action",
      ]),
    );
  });

  it("accepts natural prose rather than requiring headings or a table shape", () => {
    const answer =
      "先按时间成本、费用和风险各打 1–5 分，写在同一张清单里。把你最看重的条件设成双倍权重：方案 A 可能更省时间但费用高，方案 B 费用低却更费精力，这就是主要取舍。下一步今天先把已有数据打分，差距明显就选高分项。";
    expect(reviewComparisonDecisionRequirements(answer, requirements)).toEqual([]);
  });
});
