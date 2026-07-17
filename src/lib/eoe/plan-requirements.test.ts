import { describe, expect, it } from "vitest";
import { analyzePlanRequirements, reviewPlanRequirements } from "./plan-requirements";

describe("PlanRequirements", () => {
  it("requires a weekly timeline, stages, tasks, priority, and feedback", () => {
    const requirements = analyzePlanRequirements("帮我制定一个下周学习计划，要有时间、任务、优先级和复盘。");
    expect(requirements).toEqual({
      needsTimeline: true,
      needsStages: true,
      needsTasks: true,
      needsPriority: true,
      needsFeedbackLoop: true,
    });
    expect(reviewPlanRequirements("先开始学习。", requirements)).toEqual(expect.arrayContaining([
      "missing_timeline",
      "missing_stage_structure",
      "missing_task_assignment",
      "missing_feedback_loop",
    ]));
    expect(reviewPlanRequirements(
      "前两天先优先阅读核心章节并记录问题；周中接下来练习题目；周末最后复习错题，并按完成率复盘调整下周计划。",
      requirements,
    )).toEqual([]);
  });

  it("does not force a weekly structure on a today-only question", () => {
    expect(analyzePlanRequirements("今天该先做什么？")).toEqual({
      needsTimeline: false,
      needsStages: false,
      needsTasks: true,
      needsPriority: true,
      needsFeedbackLoop: false,
    });
  });
});
