import type { ConversationFunction } from "@/domain/eoe";

export interface M24SingleTurnScenario {
  id: string;
  category: string;
  userMessage: string;
  expectedFunction: ConversationFunction;
  provider: "glm" | "glm-vision" | "deepseek";
  fixedLevel: number;
  imageFixture?: string;
}

export const M24_CORE_CORPUS_IDS = [
  "daily-weekend", "simple-opinion-remote", "complex-opinion-ai", "plan-study", "advice-choice",
  "emotional-pressure", "serious-medical", "serious-legal", "technical-api", "technical-cache",
  "technical-typescript", "technical-deploy", "finance-budget", "image-overview", "short-ok",
  "long-analysis", "user-english-opinion", "chinese-only-explain", "ask-phrase-clarify", "no-fit-minimal",
] as const;

export const NATURAL_OVERLAY_OPPORTUNITY_CORPUS: M24SingleTurnScenario[] = [
  { id: "opinion-simple", category: "简单观点", userMessage: "你觉得每天散步二十分钟值得坚持吗？", expectedFunction: "answer", provider: "glm", fixedLevel: 2 },
  { id: "advice-daily", category: "日常建议", userMessage: "周末只想真正放松一下，你建议怎么安排？", expectedFunction: "answer", provider: "deepseek", fixedLevel: 2 },
  { id: "reaction-agree", category: "同意回应", userMessage: "我先缩小范围再验证，这样合理吗？", expectedFunction: "answer", provider: "glm", fixedLevel: 2 },
  { id: "condition-choice", category: "条件判断", userMessage: "通勤近但房租高，值不值得选要看什么？", expectedFunction: "answer", provider: "deepseek", fixedLevel: 2 },
  { id: "example-request", category: "举例", userMessage: "解释一下机会成本，给一个日常例子。", expectedFunction: "explain", provider: "glm", fixedLevel: 2 },
  { id: "temporary-decision", category: "暂时决策", userMessage: "信息还不全，现在先用哪个临时方案？", expectedFunction: "answer", provider: "deepseek", fixedLevel: 2 },
  { id: "mild-degree", category: "轻微程度", userMessage: "进度比预期慢一点，该怎么调整？", expectedFunction: "advise", provider: "glm", fixedLevel: 2 },
  { id: "user-english", category: "用户主动英语", userMessage: "I think this approach is useful，你怎么看？", expectedFunction: "answer", provider: "deepseek", fixedLevel: 2 },
  { id: "phrase-reuse", category: "Phrase 复用", userMessage: "For now 我想先保留现有方案，你觉得可以吗？", expectedFunction: "answer", provider: "glm", fixedLevel: 2 },
  { id: "simple-comparison", category: "简单对比", userMessage: "纸质清单和手机清单怎么选？", expectedFunction: "answer", provider: "deepseek", fixedLevel: 2 },
  { id: "next-step", category: "下一步", userMessage: "目标已经确定，下一步先做什么？", expectedFunction: "advise", provider: "glm", fixedLevel: 2 },
  { id: "daily-plan", category: "日常计划", userMessage: "帮我安排一个不累的周末整理计划。", expectedFunction: "advise", provider: "deepseek", fixedLevel: 2 },
];

export interface M24MultiTurnScenario {
  id: string;
  purpose: string;
  turns: Array<{ role: "user" | "assistant"; content: string; phraseId?: string }>;
}

export const M24_MULTI_TURN_CORPUS: M24MultiTurnScenario[] = [
  { id: "meaning", purpose: "Vocabulary meaning", turns: [{ role: "user", content: "我们先定一个临时方案。" }, { role: "assistant", content: "For now，先保留低风险方案。", phraseId: "p-for-now" }, { role: "user", content: "什么意思？" }] },
  { id: "pronunciation", purpose: "Phrase pronunciation", turns: [{ role: "user", content: "你怎么看？" }, { role: "assistant", content: "I think，这个方向可以继续。", phraseId: "p-i-think" }, { role: "user", content: "怎么读？" }] },
  { id: "click", purpose: "Click association", turns: [{ role: "user", content: "先做什么？" }, { role: "assistant", content: "For now，先确认目标。", phraseId: "p-for-now" }] },
  { id: "reuse", purpose: "Natural user reuse", turns: [{ role: "user", content: "这个条件重要吗？" }, { role: "assistant", content: "It depends，先看预算。", phraseId: "p-it-depends" }, { role: "user", content: "It depends，我再补充时间限制。" }] },
  { id: "difficulty", purpose: "Temporary level reduction", turns: [{ role: "user", content: "继续说明。" }, { role: "assistant", content: "At the same time，也要看成本。", phraseId: "p-at-the-same-time" }, { role: "user", content: "英语有点难。" }] },
  { id: "chinese-scope", purpose: "Chinese-only scope", turns: [{ role: "user", content: "请只用中文。" }, { role: "assistant", content: "好的，之后先用中文。" }, { role: "user", content: "继续分析成本。" }] },
  { id: "resume-english", purpose: "User resumes English", turns: [{ role: "user", content: "请只用中文。" }, { role: "assistant", content: "好的。" }, { role: "user", content: "I think 现在可以继续，你怎么看？" }] },
  { id: "ambiguity", purpose: "Multiple Phrase ambiguity", turns: [{ role: "user", content: "比较一下。" }, { role: "assistant", content: "It depends，要看目标。", phraseId: "p-it-depends" }, { role: "assistant", content: "For now，先收集数据。", phraseId: "p-for-now" }, { role: "user", content: "刚才那个什么意思？" }] },
];
