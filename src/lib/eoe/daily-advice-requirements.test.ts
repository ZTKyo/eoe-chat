import { describe, expect, it } from "vitest";
import {
  analyzeDailyAdviceRequirements,
  isDailyAdviceRequest,
  reviewDailyAdviceRequirements,
} from "./daily-advice-requirements";

describe("M2.5.1 proportional Daily Advice Requirements", () => {
  it("separates lightweight daily advice from a structured plan", () => {
    expect(isDailyAdviceRequest("周末只想真正放松一下，你建议怎么安排？")).toBe(true);
    expect(isDailyAdviceRequest("帮我安排一个不累的周末整理计划。")).toBe(false);
    expect(isDailyAdviceRequest("帮我安排今天的计划。")).toBe(false);
  });

  it("accepts concrete, time-anchored leisure advice with a light alternative", () => {
    const requirements = analyzeDailyAdviceRequirements(
      "周末只想真正放松一下，你建议怎么安排？",
    );
    const answer =
      "周六上午先睡到自然醒，下午去公园散步半小时，晚上留给一部想看的电影。如果起床后还是很累，就把散步换成泡澡或听音乐，不必把行程排满。";
    expect(reviewDailyAdviceRequirements(answer, requirements)).toEqual([]);
  });

  it.each(["慢慢来。", "先做最小的一步。", "可以试试看。"])(
    "rejects empty advice: %s",
    (answer) => {
      const issues = reviewDailyAdviceRequirements(
        answer,
        analyzeDailyAdviceRequirements("周末怎么安排更放松？"),
      );
      expect(issues).toContain("missing_concrete_action");
      expect(issues).toContain("missing_action_assignment");
    },
  );
});
