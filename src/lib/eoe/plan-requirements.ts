import type { PlanRequirements } from "@/domain/eoe";

const weeklyPattern = /下周|一周|本周|每周|周计划|学习计划|工作计划/u;
const todayPattern = /今天|现在|眼下|先做什么|第一步/u;

export function analyzePlanRequirements(message: string): PlanRequirements {
  const weekly = weeklyPattern.test(message);
  const shortHorizon = todayPattern.test(message) && !weekly;
  return {
    needsTimeline: weekly || /时间|日程|每天|上午|下午|晚上/u.test(message),
    needsStages: !shortHorizon && (weekly || /阶段|步骤|先后|过程/u.test(message)),
    needsTasks: true,
    needsPriority: /优先|重点|最重要|先做/u.test(message) || shortHorizon || weekly,
    needsFeedbackLoop: weekly || /复盘|反馈|调整|检查|回顾/u.test(message),
  };
}

function countMatches(text: string, pattern: RegExp): number {
  return new Set(text.match(pattern) ?? []).size;
}

export function reviewPlanRequirements(text: string, requirements: PlanRequirements): string[] {
  const timelineCount = countMatches(
    text,
    /周[一二三四五六日天]|前两天|前半周|周中|后半周|周末|每天|上午|下午|晚上|第[一二三四五六七\d]+天|\d+\s*(?:分钟|小时)/gu,
  );
  const stageCount = countMatches(
    text,
    /先(?:完成|确定|安排|做|把)?|接下来|随后|然后|最后|前两天|前半周|周中|后半周|周末|第[一二三四五六七\d]+阶段/gu,
  );
  const taskCount = countMatches(
    text,
    /阅读|练习|复习|整理|完成|学习|写作|背诵|检查|列出|记录|测试|总结|制作|提交|解决/gu,
  );
  const issues = [
    requirements.needsTimeline && timelineCount < 2 ? "missing_timeline" : undefined,
    requirements.needsStages && stageCount < 2 ? "missing_stage_structure" : undefined,
    requirements.needsTasks && taskCount < (requirements.needsTimeline || requirements.needsStages ? 2 : 1)
      ? "missing_task_assignment"
      : undefined,
    requirements.needsPriority && !/优先|重点|核心|最重要|先(?:完成|做|把|确定)/u.test(text) ? "missing_priority" : undefined,
    requirements.needsFeedbackLoop && !/复盘|反馈|调整|检查|回顾|完成率|根据.{0,16}(?:改|调)/u.test(text)
      ? "missing_feedback_loop"
      : undefined,
  ];
  return issues.filter((item): item is string => Boolean(item));
}

export function planRequirementLabels(requirements: PlanRequirements): string[] {
  return [
    requirements.needsTimeline ? "at least two explicit time periods" : undefined,
    requirements.needsStages ? "at least two ordered stages" : undefined,
    requirements.needsTasks ? "concrete tasks assigned to the time periods or stages" : undefined,
    requirements.needsPriority ? "a clear priority" : undefined,
    requirements.needsFeedbackLoop ? "a review or adjustment loop" : undefined,
  ].filter((item): item is string => Boolean(item));
}
