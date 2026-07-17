import type { ComparisonDecisionRequirements } from "@/domain/eoe";

const decisionPattern = /拿不定主意|怎么选|如何选|如何选择|怎么选择|选哪个|二选一/u;
const trialPattern = /试用|试验|测试|体验|先用|小范围|可逆|退出|低风险/u;

export function analyzeComparisonDecisionRequirements(
  message: string,
): ComparisonDecisionRequirements {
  const decision = decisionPattern.test(message);
  return {
    needsComparisonDimensions: true,
    minimumDimensionCount: decision ? 2 : 1,
    needsUserPriority: decision,
    needsTradeOff: decision || /权衡|取舍|优缺点|利弊/u.test(message),
    needsRecordingMethod: decision || /记录|打分|评分|表格|比较/u.test(message),
    needsReversibleTest: trialPattern.test(message),
    needsNextAction: decision,
  };
}

function evidenceCount(text: string, pattern: RegExp): number {
  return new Set(text.match(pattern) ?? []).size;
}

export function reviewComparisonDecisionRequirements(
  text: string,
  requirements: ComparisonDecisionRequirements,
): string[] {
  const dimensionCount = evidenceCount(
    text,
    /时间|通勤|金钱|价格|租金|费用|成本|风险|收益|效果|质量|维护|精力|难度|速度|稳定性|灵活性|安全|隐私|便利|长期|退出难度|适配度/gu,
  );
  const hasUserPriority =
    /最(?:重视|看重|在意|重要)|优先(?:级|考虑)?|权重|更重要|核心条件|底线|不能妥协|对你.{0,8}重要/u.test(text);
  const hasTradeOff =
    /权衡|取舍|主要矛盾|代价|得失|优缺点|利弊|如果.{0,60}(?:那么|就|则)|一方面.{0,40}另一方面|(?:方案|选项)[A甲一1]?.{0,28}(?:但|而|却).{0,28}(?:方案|选项)[B乙二2]?/u.test(text);
  const hasRecording =
    /记录|表格|清单|打分|评分|计分|列出|写下|矩阵|按.{0,8}[1一]至?[5五]分|加权/u.test(text);
  const hasTrial = /试用|试验|测试|体验|小范围|先用.{0,12}(?:天|周)|可逆|保留退出|随时(?:停|换)/u.test(text);
  const hasNextAction =
    /下一步|今天|现在|马上|接下来|先(?:把|写|列|确定|选|做|试|问|收集|记录)/u.test(text);

  return [
    requirements.needsComparisonDimensions &&
      dimensionCount < requirements.minimumDimensionCount
      ? "missing_comparison_dimensions"
      : undefined,
    requirements.needsUserPriority && !hasUserPriority
      ? "missing_user_priority"
      : undefined,
    requirements.needsTradeOff && !hasTradeOff
      ? "missing_trade_off"
      : undefined,
    requirements.needsRecordingMethod && !hasRecording
      ? "missing_recording_method"
      : undefined,
    requirements.needsReversibleTest && !hasTrial
      ? "missing_reversible_test"
      : undefined,
    requirements.needsNextAction && !hasNextAction
      ? "missing_next_action"
      : undefined,
  ].filter((item): item is string => Boolean(item));
}

export function comparisonRequirementLabels(
  requirements: ComparisonDecisionRequirements,
): string[] {
  return [
    requirements.needsComparisonDimensions
      ? `at least ${requirements.minimumDimensionCount} concrete comparison dimensions`
      : undefined,
    requirements.needsUserPriority
      ? "the condition the user values most, or a prompt to assign that priority"
      : undefined,
    requirements.needsTradeOff ? "the main trade-off between the options" : undefined,
    requirements.needsRecordingMethod ? "a lightweight recording or scoring method" : undefined,
    requirements.needsReversibleTest ? "a reversible test appropriate to the decision" : undefined,
    requirements.needsNextAction ? "one executable next action" : undefined,
  ].filter((item): item is string => Boolean(item));
}
