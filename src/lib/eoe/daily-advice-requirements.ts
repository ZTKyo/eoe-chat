import type { DailyAdviceRequirements } from "@/domain/eoe";

const dailyContextPattern =
  /周末|今天|今晚|早上|晚上|下班|休息|放松|日常|空闲|闲下来|散步|吃饭|睡觉|娱乐|约会|家务/u;
const structuredPlanPattern =
  /计划|下周|每天|日程|阶段|任务安排/u;

export function isDailyAdviceRequest(message: string): boolean {
  return dailyContextPattern.test(message) && !structuredPlanPattern.test(message);
}

export function analyzeDailyAdviceRequirements(message: string): DailyAdviceRequirements {
  const asksArrangement = /怎么安排|如何安排|建议|怎么做|做什么/u.test(message);
  return {
    needsConcreteAction: true,
    minimumActionCount: asksArrangement ? 2 : 1,
    needsSequence: /先后|顺序|流程/u.test(message),
    needsTimeAnchor: /周末|今天|今晚|早上|上午|中午|下午|晚上|下班|怎么安排|何时/u.test(message),
    needsAdjustmentOption: /放松|轻松|不累|看状态|随意|灵活/u.test(message),
  };
}

function actionCount(text: string): number {
  return new Set(text.match(
    /散步|慢走|晒太阳|去公园|看电影|看剧|阅读|看书|听音乐|泡澡|洗澡|午睡|补觉|睡到自然醒|做饭|吃顿|喝咖啡|喝茶|运动|拉伸|瑜伽|骑车|游泳|逛街|逛展|和朋友|聊天|关掉通知|关闭通知|放下手机|离开屏幕|发呆|留白|玩游戏|做手工|画画|整理房间|收拾|按摩|冥想|深呼吸|出门|待在家/gu,
  ) ?? []).size;
}

export function reviewDailyAdviceRequirements(
  text: string,
  requirements: DailyAdviceRequirements,
): string[] {
  const actions = actionCount(text);
  const hasAssignment =
    /先.{0,30}(?:再|然后|接着)|上午|中午|下午|晚上|起床后|吃完|回家后|留出.{0,8}(?:分钟|小时)|安排.{0,16}(?:散步|休息|电影|阅读|音乐|午睡|公园)/u.test(text);
  const hasSequence = /先.{0,30}(?:再|然后|接着)|第一|第二|随后|最后/u.test(text);
  const hasStart = /周六|周日|周末|今天|今晚|早上|上午|中午|下午|晚上|起床后|吃完|回家后|先从|开始时/u.test(text);
  const hasAdjustment =
    /如果|要是|不想|累了|状态|可以改成|换成|或者|也可以|任选|二选一|不必|随时调整/u.test(text);

  return [
    requirements.needsConcreteAction && actions === 0
      ? "missing_concrete_action"
      : undefined,
    requirements.needsConcreteAction &&
      (actions < requirements.minimumActionCount || (requirements.minimumActionCount > 1 && !hasAssignment))
      ? "missing_action_assignment"
      : undefined,
    requirements.needsSequence && !hasSequence
      ? "missing_action_assignment"
      : undefined,
    requirements.needsTimeAnchor && !hasStart
      ? "missing_start_condition"
      : undefined,
    requirements.needsAdjustmentOption && !hasAdjustment
      ? "missing_adjustment_option"
      : undefined,
  ].filter((item): item is string => Boolean(item));
}

export function dailyAdviceRequirementLabels(
  requirements: DailyAdviceRequirements,
): string[] {
  return [
    requirements.needsConcreteAction
      ? `at least ${requirements.minimumActionCount} concrete daily-life actions`
      : undefined,
    requirements.needsSequence ? "a lightweight action sequence" : undefined,
    requirements.needsTimeAnchor ? "a natural start condition or time anchor" : undefined,
    requirements.needsAdjustmentOption ? "a lightweight alternative or adjustment option" : undefined,
  ].filter((item): item is string => Boolean(item));
}
