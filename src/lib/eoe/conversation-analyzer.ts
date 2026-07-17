import type { ConversationAnalysis, ConversationFunction } from "@/domain/eoe";

const emotional = /难过|焦虑|害怕|孤独|崩溃|压力|失落|生气|痛苦|不开心|委屈|沮丧/u;
const highStakes = /医生|用药|剂量|症状|诊断|法律|律师|合同|诉讼|投资|股票|基金|贷款|税务|保险|急救/u;
const technical = /代码|编程|接口|API|数据库|报错|错误|部署|服务器|算法|架构|配置|TypeScript|Python|JavaScript/iu;
const asksChinese = /只用中文|请用中文|不要英文|全中文/u;

function classifyFunction(text: string, hasImage: boolean): ConversationFunction {
  if (hasImage) return "analyze_image";
  if (emotional.test(text)) return "empathize";
  if (/总结|概括|归纳|摘要/u.test(text)) return "summarize";
  if (/帮我(写|改|整理|生成|完成)|请(写|改|整理|生成|完成)|执行|创建|制作/u.test(text)) return "complete_task";
  if (/怎么办|建议|计划|如何选择|该不该|怎么做|权衡|取舍/u.test(text)) return "advise";
  if (/为什么|解释|原理|原因|怎么回事|报错|区别/u.test(text)) return "explain";
  if (/什么意思|请澄清|没听懂|没看懂|不理解/u.test(text)) return "clarify";
  if (/还需要什么|要补充什么|你想问什么/u.test(text)) return "ask_follow_up";
  if (text.length <= 10 && !/[？?]/u.test(text)) return "react";
  return "answer";
}

export function analyzeConversation(input: {
  userMessage: string;
  hasImage: boolean;
  chineseOnlyScope?: boolean;
  difficultySignal?: boolean;
}): ConversationAnalysis {
  const text = input.userMessage.trim();
  const primaryFunction = classifyFunction(text, input.hasImage);
  const sensitivity: ConversationAnalysis["sensitivity"] = highStakes.test(text)
    ? "high_stakes"
    : emotional.test(text)
      ? "emotional"
      : technical.test(text)
        ? "technical"
        : "normal";
  const responseLength: ConversationAnalysis["responseLength"] =
    /一句话|简短|简要|只要结论/u.test(text) || text.length <= 3
      ? "short"
      : /详细|完整|深入|逐步分析/u.test(text) || text.length > 220
        ? "long"
        : "medium";

  let overlaySuitability: ConversationAnalysis["overlaySuitability"] = "high";
  if (asksChinese.test(text) || input.chineseOnlyScope || text.length <= 2) overlaySuitability = "none";
  else if (input.difficultySignal) overlaySuitability = "low";
  else if (sensitivity === "high_stakes" || sensitivity === "emotional") overlaySuitability = "low";
  else if (sensitivity === "technical" || input.hasImage || responseLength === "short") overlaySuitability = "medium";

  return {
    primaryFunction,
    secondaryFunction:
      primaryFunction === "empathize"
        ? "advise"
        : primaryFunction === "analyze_image"
          ? "explain"
          : undefined,
    sensitivity,
    responseLength,
    overlaySuitability,
    confidence: input.hasImage || primaryFunction !== "answer" ? 0.94 : 0.78,
  };
}
