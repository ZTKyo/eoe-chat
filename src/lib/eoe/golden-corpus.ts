import type { ConversationFunction, MockScenario } from "@/domain/eoe";

export interface GoldenScenario {
  id: string;
  category: string;
  userMessage: string;
  expectedFunction: ConversationFunction;
  hasImage?: boolean;
  mockScenario?: MockScenario;
  fixedLevel?: number;
  recentExposurePhraseIds?: string[];
}

export const GOLDEN_CONVERSATION_CORPUS: GoldenScenario[] = [
  { id: "daily-hello", category: "普通日常聊天", userMessage: "你好，今天想随便聊聊近况", expectedFunction: "answer", fixedLevel: 1 },
  { id: "daily-weekend", category: "普通日常聊天", userMessage: "周末终于有空了，你觉得做点什么比较放松？", expectedFunction: "answer", fixedLevel: 2 },
  { id: "simple-opinion-books", category: "简单观点", userMessage: "你觉得每天读二十分钟书有用吗？", expectedFunction: "answer", fixedLevel: 1 },
  { id: "simple-opinion-remote", category: "简单观点", userMessage: "你觉得远程办公最大的优点是什么？", expectedFunction: "answer", fixedLevel: 2 },
  { id: "complex-opinion-ai", category: "复杂观点", userMessage: "如何看待生成式 AI 同时提高效率又可能削弱初级岗位训练机会？", expectedFunction: "answer", fixedLevel: 3 },
  { id: "complex-opinion-city", category: "复杂观点", userMessage: "城市更新应该优先提高密度，还是保护原有社区关系？请分析两边的代价。", expectedFunction: "answer", fixedLevel: 3 },
  { id: "plan-study", category: "计划", userMessage: "我该怎么安排下周的学习计划？", expectedFunction: "advise", fixedLevel: 2 },
  { id: "plan-trip", category: "计划", userMessage: "怎么做一个三天短途旅行计划，既不赶又能控制预算？", expectedFunction: "advise", fixedLevel: 2 },
  { id: "plan-project", category: "计划", userMessage: "这个小项目该怎么做计划，才能尽早发现方向错了？", expectedFunction: "advise", fixedLevel: 3 },
  { id: "advice-choice", category: "建议", userMessage: "两个方案拿不定主意，我该怎么做选择？", expectedFunction: "advise", fixedLevel: 2 },
  { id: "advice-habit", category: "建议", userMessage: "我总是拖到最后一天，怎么办？", expectedFunction: "advise", fixedLevel: 1 },
  { id: "emotional-pressure", category: "情绪支持", userMessage: "我最近压力很大，也很焦虑", expectedFunction: "empathize", fixedLevel: 2 },
  { id: "emotional-setback", category: "情绪支持", userMessage: "准备了很久还是失败，我现在很失落", expectedFunction: "empathize", fixedLevel: 3 },
  { id: "serious-medical", category: "严肃话题", userMessage: "医生提到可能要调整用药，我应该关注哪些信息？", expectedFunction: "answer", fixedLevel: 3 },
  { id: "serious-legal", category: "严肃话题", userMessage: "合同里出现责任限制条款，我签字前应该核对什么？", expectedFunction: "answer", fixedLevel: 2 },
  { id: "technical-api", category: "技术解释", userMessage: "解释一下为什么这个 API 会返回 500 报错", expectedFunction: "explain", fixedLevel: 2, mockScenario: "double_failure" },
  { id: "technical-cache", category: "技术解释", userMessage: "为什么缓存失效后数据库负载会突然升高？", expectedFunction: "explain", fixedLevel: 3 },
  { id: "technical-typescript", category: "技术解释", userMessage: "解释 TypeScript 里 unknown 和 any 的区别", expectedFunction: "explain", fixedLevel: 2 },
  { id: "technical-deploy", category: "技术解释", userMessage: "部署后页面能开但接口超时，怎么回事？", expectedFunction: "explain", fixedLevel: 3 },
  { id: "finance-budget", category: "财务信息", userMessage: "我想先做家庭预算，应该整理哪些数据？", expectedFunction: "answer", fixedLevel: 2 },
  { id: "finance-risk", category: "财务信息", userMessage: "投资前怎样区分自己能承受的波动和真正的风险？", expectedFunction: "answer", fixedLevel: 3 },
  { id: "image-overview", category: "图片分析", userMessage: "请分析这张图片中的主要内容", expectedFunction: "analyze_image", hasImage: true, fixedLevel: 2 },
  { id: "image-detail", category: "图片分析", userMessage: "仔细看这张图片，区分能确认的细节和不确定部分", expectedFunction: "analyze_image", hasImage: true, fixedLevel: 3 },
  { id: "short-ok", category: "极短回应", userMessage: "好", expectedFunction: "react", fixedLevel: 2 },
  { id: "short-hm", category: "极短回应", userMessage: "嗯", expectedFunction: "react", fixedLevel: 1 },
  { id: "long-analysis", category: "长篇分析", userMessage: "请详细分析一个新产品从用户问题、竞争环境、交付成本到长期维护之间的关系，并指出最容易被忽略的约束。", expectedFunction: "answer", fixedLevel: 3 },
  { id: "long-comparison", category: "长篇分析", userMessage: "请完整深入地比较自建服务与托管服务在安全、成本、可维护性和退出难度上的差异。", expectedFunction: "answer", fixedLevel: 2 },
  { id: "user-english-opinion", category: "用户主动使用英文", userMessage: "I think this plan is useful，你怎么看？", expectedFunction: "answer", fixedLevel: 2 },
  { id: "user-english-advice", category: "用户主动使用英文", userMessage: "Can you help me decide，下一步怎么做？", expectedFunction: "advise", fixedLevel: 3 },
  { id: "chinese-only-explain", category: "用户要求全中文", userMessage: "请只用中文解释这个选择", expectedFunction: "explain", fixedLevel: 2 },
  { id: "chinese-only-detail", category: "用户要求全中文", userMessage: "不要英文，请用中文详细说明风险", expectedFunction: "answer", fixedLevel: 3 },
  { id: "ask-phrase-meaning", category: "用户询问 Phrase", userMessage: "你刚才用的 step by step 是什么意思？", expectedFunction: "clarify", fixedLevel: 2 },
  { id: "ask-phrase-clarify", category: "用户询问 Phrase", userMessage: "我没看懂你刚才的英文短语，请澄清", expectedFunction: "clarify", fixedLevel: 2 },
  { id: "no-fit-minimal", category: "没有自然候选", userMessage: "哦", expectedFunction: "react", fixedLevel: 2 },
  { id: "no-fit-chinese", category: "没有自然候选", userMessage: "只用中文", expectedFunction: "react", fixedLevel: 3 },
  { id: "reuse-step", category: "同一 Phrase 的复用", userMessage: "还是按 step by step 来吧，下一步怎么做？", expectedFunction: "advise", fixedLevel: 2, recentExposurePhraseIds: ["p-for-now", "p-makes-sense", "p-step-by-step"] },
  { id: "reuse-good-place", category: "同一 Phrase 的复用", userMessage: "继续找一个成本低的开始方式，我该怎么做？", expectedFunction: "advise", fixedLevel: 2, recentExposurePhraseIds: ["p-for-now", "p-maybe", "p-good-place-to-start"] },
  { id: "cooldown-step", category: "冷却期", userMessage: "把计划拆小一点，我该怎么安排？", expectedFunction: "advise", fixedLevel: 2, recentExposurePhraseIds: ["p-step-by-step"] },
  { id: "cooldown-reaction", category: "冷却期", userMessage: "这个判断确实合理", expectedFunction: "react", fixedLevel: 2, recentExposurePhraseIds: ["p-makes-sense"] },
  { id: "function-summary", category: "不同 Conversation Function", userMessage: "请总结我们刚才讨论的三个重点", expectedFunction: "summarize", fixedLevel: 2 },
  { id: "function-complete", category: "不同 Conversation Function", userMessage: "帮我整理一份明天要做的简短清单", expectedFunction: "complete_task", fixedLevel: 2 },
  { id: "function-clarify", category: "不同 Conversation Function", userMessage: "这个结论是什么意思？请澄清", expectedFunction: "clarify", fixedLevel: 1 },
  { id: "function-followup", category: "不同 Conversation Function", userMessage: "为了继续分析，你还需要什么信息？", expectedFunction: "ask_follow_up", fixedLevel: 3 },
  { id: "level-one", category: "Level 1、Level 2 和 Level 3", userMessage: "这个想法可行吗？", expectedFunction: "answer", fixedLevel: 1 },
  { id: "level-three", category: "Level 1、Level 2 和 Level 3", userMessage: "从长期维护角度分析这个架构选择", expectedFunction: "answer", fixedLevel: 3 },
];
