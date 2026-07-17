import type { ConversationFunction, GrammaticalRole, Phrase } from "@/domain/eoe";

export const REGISTRY_VERSION = "eoe.phrases.v2.0";

type PhraseInput = Pick<
  Phrase,
  "id" | "canonical" | "level" | "frequencyRank" | "conversationFunctions" | "semanticTags" | "contextualHints"
> &
  Partial<Pick<Phrase, "variants" | "difficulty" | "reuseValue" | "compatibleTones" | "cooldownTurns">>;

const BILINGUAL_PATTERNS: Record<string, string[]> = {
  "p-i-think": [
    "{phrase}，这个判断基本成立，但还需要结合具体条件。",
    "{phrase}，这个方向可以继续，但要先核对主要限制。",
  ],
  "p-a-little": [
    "现在的进度比预期 {phrase} 慢，可以先缩小本周目标。",
    "这个变化有 {phrase} 明显，值得再核对一次数据。",
  ],
  "p-kind-of": [
    "这个方案 {phrase} 介于临时修补和长期方案之间。",
    "现在的状态 {phrase} 像是方向对了，但范围还要收紧。",
  ],
  "p-for-now": [
    "这个方案，{phrase}，可以先保留；有新证据再调整。",
    "{phrase}，先处理已经确认的部分，剩下的等信息完整后再决定。",
  ],
  "p-for-example": [
    "可以先看一个具体例子，{phrase}，比较时间、成本和风险。",
    "先选一个最小场景验证，{phrase}，只测试最关键的假设。",
  ],
  "p-makes-sense": ["这个判断 {phrase}，接下来可以继续验证最关键的假设。"],
  "p-sounds-good": [
    "{phrase}，接下来把第一步和完成标准定清楚就可以开始。",
    "这个安排 {phrase}；先确认时间和责任人，再开始执行。",
  ],
  "p-of-course": ["这个部分 {phrase} 也要保留，但不必抢在核心问题之前。"],
  "p-maybe": ["这里 {phrase} 还缺一个前提，确认后再决定会更稳妥。"],
  "p-no-problem": ["这个调整 {phrase}，我会先保留现有行为再处理它。"],
  "p-right-now": ["真正值得优先处理的是 {phrase} 最影响结果的阻塞点。"],
  "p-in-general": ["如果不考虑特殊限制，{phrase} 这个方向是可行的。"],
  "p-thats-okay": ["现在还没完全想清楚 {phrase}，可以先做最确定的一步。"],
  "p-in-this-case": ["{phrase}，先做低成本验证更合适。"],
  "p-at-the-same-time": [
    "我们要压缩范围；{phrase}，也要保留后续扩展空间。",
    "可以先解决眼前问题；{phrase}，别忽略长期维护成本。",
  ],
  "p-step-by-step": ["这个计划适合按 {phrase} 的节奏推进，先完成最小的一步。"],
  "p-give-it-a-try": ["这一步可以先 {phrase}，再根据实际结果调整后续安排。"],
  "p-keep-in-mind": ["这里要 {phrase} 的是，信息不足时需要保留调整空间。"],
  "p-on-the-other-hand": ["这个方案成本较低，{phrase} 它需要更多人工确认。"],
  "p-in-the-long-run": [
    "{phrase}，还要继续评估持续成本和后续影响。",
    "眼前可以先这样处理；{phrase}，仍要关注持续成本和后续影响。",
  ],
  "p-for-the-moment": ["这个做法 {phrase} 可以保留，等新证据出现后再复核。"],
  "p-one-thing-at-a-time": ["这件事适合按 {phrase} 的方式推进，避免同时改变太多变量。"],
  "p-take-a-closer-look": ["我们可以先 {phrase}，再区分确定信息和推测部分。"],
  "p-good-place-to-start": ["我觉得先确认最重要的目标，是 {phrase}；之后再决定具体动作。"],
  "p-that-makes-sense": [
    "{phrase}，接下来可以核对这个判断依赖的前提。",
    "你这样考虑 {phrase}；下一步只需要确认最关键的限制。",
  ],
  "p-it-depends": [
    "{phrase}，先看时间、成本和风险中哪一项最重要。",
    "{phrase}，如果目标不同，合适的选择也会不同。",
  ],
  "p-from-my-perspective": ["如果把风险放在第一位，{phrase} 先验证再扩展更稳妥。"],
  "p-to-be-honest": ["如果只看当前证据，{phrase} 还不足以直接下结论。"],
  "p-as-a-result": ["前两个条件都还没满足，{phrase} 现在不适合直接扩大范围。"],
  "p-in-practice": ["这个原则本身没问题，{phrase} 还要为异常情况留出空间。"],
  "p-in-the-meantime": ["主方案还在验证，{phrase} 可以先准备低风险的替代步骤。"],
};

const REACTION_IDS = new Set([
  "p-makes-sense",
  "p-sounds-good",
  "p-of-course",
  "p-no-problem",
  "p-thats-okay",
  "p-that-makes-sense",
]);
const VERB_PHRASE_IDS = new Set(["p-give-it-a-try", "p-keep-in-mind", "p-take-a-closer-look"]);
const NOUN_PHRASE_IDS = new Set(["p-step-by-step", "p-one-thing-at-a-time", "p-good-place-to-start", "p-a-little", "p-kind-of"]);
const CLAUSE_STEM_IDS = new Set([
  "p-i-think",
  "p-i-dont-think",
  "p-it-looks-like",
  "p-it-sounds-like",
  "p-main-reason",
  "p-good-thing",
  "p-problem-is",
  "p-next-step",
  "p-key-is",
  "p-comes-down-to",
  "p-what-matters-most",
  "p-trade-off",
  "p-good-chance",
  "p-one-possible-reason",
  "p-simple-way",
]);

const ASSISTANCE_METADATA: Record<string, {
  pronunciation: string;
  baseMeaningZh: string;
  optionalShortExample?: string;
}> = {
  "p-i-think": { pronunciation: "/aɪ θɪŋk/", baseMeaningZh: "在当前语境里表示“我认为”或“我的判断是”。", optionalShortExample: "I think this plan can work." },
  "p-it-depends": { pronunciation: "/ɪt dɪˈpendz/", baseMeaningZh: "表示答案取决于具体条件。", optionalShortExample: "It depends on the budget." },
  "p-that-makes-sense": { pronunciation: "/ðæt meɪks sens/", baseMeaningZh: "表示对方的说法合理、能够理解。", optionalShortExample: "That makes sense to me." },
  "p-for-example": { pronunciation: "/fɔːr ɪɡˈzæmpəl/", baseMeaningZh: "用于引出一个具体例子。", optionalShortExample: "For example, start with one small task." },
  "p-for-now": { pronunciation: "/fɔːr naʊ/", baseMeaningZh: "表示目前先这样处理，之后仍可调整。", optionalShortExample: "For now, keep the safer option." },
  "p-a-little": { pronunciation: "/ə ˈlɪtəl/", baseMeaningZh: "表示程度不大，即“一点、稍微”。", optionalShortExample: "The pace is a little slow." },
  "p-kind-of": { pronunciation: "/kaɪnd əv/", baseMeaningZh: "表示不完全确定或“有点、某种程度上”。", optionalShortExample: "It is kind of useful." },
  "p-at-the-same-time": { pronunciation: "/æt ðə seɪm taɪm/", baseMeaningZh: "用于补充同时需要考虑的另一面。", optionalShortExample: "At the same time, keep the risk low." },
  "p-in-the-long-run": { pronunciation: "/ɪn ðə lɔːŋ rʌn/", baseMeaningZh: "表示从长期结果来看。", optionalShortExample: "In the long run, consistency matters." },
  "p-sounds-good": { pronunciation: "/saʊndz ɡʊd/", baseMeaningZh: "表示认可某个提议或安排。", optionalShortExample: "Sounds good, let us start." },
};

function grammaticalRole(id: string): GrammaticalRole {
  if (REACTION_IDS.has(id)) return "reaction";
  if (VERB_PHRASE_IDS.has(id)) return "verb_phrase";
  if (NOUN_PHRASE_IDS.has(id)) return "noun_phrase";
  if (CLAUSE_STEM_IDS.has(id)) return "clause_stem";
  return "discourse_marker";
}

function phrase(input: PhraseInput): Phrase {
  const bilingualPatterns = BILINGUAL_PATTERNS[input.id] ?? [];
  const active = bilingualPatterns.length > 0;
  const role = grammaticalRole(input.id);
  const highTranslationRisk = ["p-in-other-words", "p-for-example"].includes(input.id);
  const highLabelRisk = role === "clause_stem" || ["p-thats-the-point", "p-it-depends", "p-as-far-as-i-can-tell"].includes(input.id);
  const assistance = ASSISTANCE_METADATA[input.id];
  return {
    ...input,
    variants: input.variants ?? [],
    difficulty: input.difficulty ?? Math.min(10, input.level * 2),
    reuseValue: input.reuseValue ?? 0.8,
    compatibleTones: input.compatibleTones ?? ["neutral", "warm", "direct"],
    cooldownTurns: input.cooldownTurns ?? 2,
    pronunciation: assistance?.pronunciation ?? `/${input.canonical.toLocaleLowerCase()}/`,
    baseMeaningZh: assistance?.baseMeaningZh ?? "该表达需要结合出现时的完整原句理解。",
    optionalShortExample: assistance?.optionalShortExample,
    grammaticalRole: role,
    preferredPositions: active ? ["sentence_middle"] : role === "clause_stem" ? ["sentence_start"] : ["sentence_middle"],
    requiresSubject: ["p-i-think", "p-i-dont-think", "p-it-looks-like", "p-it-sounds-like", "p-good-chance"].includes(input.id),
    requiresCopula: ["p-good-place-to-start"].includes(input.id),
    canStandAlone: REACTION_IDS.has(input.id),
    punctuationCompatibility: active
      ? ["whitespace_before", "whitespace_after", "comma_before", "comma_after", "semicolon_after"]
      : ["requires_full_english_syntax"],
    bilingualPatterns,
    unsafePatterns: [
      "{phrase}：{chinese_explanation}",
      "{phrase}: {chinese_explanation}",
      "standalone_heading_or_learning_card",
      ...(role === "clause_stem" ? ["clause_stem_without_english_complement"] : []),
    ],
    bilingualCompatibility: active ? 0.9 : 0.25,
    punctuationRisk: active ? 0.15 : 0.75,
    translationRisk: highTranslationRisk ? 0.95 : active ? 0.2 : 0.65,
    labelLikeRisk: highLabelRisk ? 0.95 : active ? 0.2 : 0.7,
    status: active ? "active" : "disabled",
    registryVersion: REGISTRY_VERSION,
  };
}

const A: ConversationFunction[] = ["answer", "react", "clarify"];
const E: ConversationFunction[] = ["explain", "answer", "summarize"];
const V: ConversationFunction[] = ["advise", "complete_task", "answer"];
const R: ConversationFunction[] = ["react", "empathize", "answer"];

export const CORE_PHRASES_V1: Phrase[] = [
  phrase({ id: "p-i-think", canonical: "I think", level: 1, frequencyRank: 1, conversationFunctions: A, semanticTags: ["opinion"], contextualHints: ["认为", "观点", "可能"] }),
  phrase({ id: "p-i-dont-think", canonical: "I don’t think", variants: ["I don't think"], level: 1, frequencyRank: 2, conversationFunctions: A, semanticTags: ["disagreement", "uncertainty"], contextualHints: ["不太", "不是", "未必"] }),
  phrase({ id: "p-a-little", canonical: "a little", level: 1, frequencyRank: 3, conversationFunctions: A, semanticTags: ["degree"], contextualHints: ["一点", "稍微", "有些"] }),
  phrase({ id: "p-kind-of", canonical: "kind of", level: 1, frequencyRank: 4, conversationFunctions: A, semanticTags: ["degree", "uncertainty"], contextualHints: ["有点", "某种", "不完全"] }),
  phrase({ id: "p-for-now", canonical: "for now", level: 1, frequencyRank: 5, conversationFunctions: [...V, ...A], semanticTags: ["time", "temporary"], contextualHints: ["现在", "暂时", "目前"] }),
  phrase({ id: "p-makes-sense", canonical: "makes sense", level: 1, frequencyRank: 6, conversationFunctions: R, semanticTags: ["agreement", "reaction"], contextualHints: ["合理", "理解", "说得通"] }),
  phrase({ id: "p-sounds-good", canonical: "sounds good", variants: ["Sounds good"], level: 1, frequencyRank: 7, conversationFunctions: R, semanticTags: ["agreement", "reaction"], contextualHints: ["可以", "不错", "同意"] }),
  phrase({ id: "p-of-course", canonical: "of course", level: 1, frequencyRank: 8, conversationFunctions: [...R, ...A], semanticTags: ["confirmation"], contextualHints: ["当然", "可以", "没问题"] }),
  phrase({ id: "p-maybe", canonical: "maybe", level: 1, frequencyRank: 9, conversationFunctions: [...A, ...V], semanticTags: ["uncertainty"], contextualHints: ["也许", "可能", "或者"] }),
  phrase({ id: "p-no-problem", canonical: "no problem", level: 1, frequencyRank: 10, conversationFunctions: ["react", "complete_task"], semanticTags: ["reassurance"], contextualHints: ["没问题", "可以", "好的"] }),
  phrase({ id: "p-right-now", canonical: "right now", level: 1, frequencyRank: 11, conversationFunctions: [...V, ...A], semanticTags: ["time"], contextualHints: ["立刻", "当前", "现在"] }),
  phrase({ id: "p-at-first", canonical: "at first", level: 1, frequencyRank: 12, conversationFunctions: [...E, "summarize"], semanticTags: ["sequence"], contextualHints: ["开始", "最初", "起初"] }),
  phrase({ id: "p-for-example", canonical: "for example", variants: ["For example"], level: 1, frequencyRank: 13, conversationFunctions: E, semanticTags: ["example"], contextualHints: ["例如", "比如", "例子"] }),
  phrase({ id: "p-in-general", canonical: "in general", level: 1, frequencyRank: 14, conversationFunctions: [...E, ...A], semanticTags: ["summary"], contextualHints: ["一般", "总体", "通常"] }),
  phrase({ id: "p-thats-okay", canonical: "that’s okay", variants: ["that's okay"], level: 1, frequencyRank: 15, conversationFunctions: R, semanticTags: ["reassurance", "empathy"], contextualHints: ["没关系", "不用担心", "正常"] }),
  phrase({ id: "p-it-looks-like", canonical: "it looks like", level: 2, frequencyRank: 16, conversationFunctions: [...A, "analyze_image"], semanticTags: ["observation", "inference"], contextualHints: ["看起来", "图片", "似乎"] }),
  phrase({ id: "p-it-sounds-like", canonical: "it sounds like", level: 2, frequencyRank: 17, conversationFunctions: [...A, ...R], semanticTags: ["inference", "empathy"], contextualHints: ["听起来", "感觉", "似乎"] }),
  phrase({ id: "p-in-this-case", canonical: "in this case", level: 2, frequencyRank: 18, conversationFunctions: [...E, ...V], semanticTags: ["context", "condition"], contextualHints: ["这种情况", "这里", "如果"] }),
  phrase({ id: "p-at-the-same-time", canonical: "at the same time", variants: ["At the same time"], level: 2, frequencyRank: 19, conversationFunctions: [...E, ...A, "advise"], semanticTags: ["contrast", "parallel"], contextualHints: ["同时", "另一方面", "也要"] }),
  phrase({ id: "p-thats-the-point", canonical: "that’s the point", variants: ["that's the point"], level: 2, frequencyRank: 20, conversationFunctions: [...R, ...E], semanticTags: ["emphasis"], contextualHints: ["关键", "重点", "正是"] }),
  phrase({ id: "p-main-reason", canonical: "the main reason is", level: 2, frequencyRank: 21, conversationFunctions: E, semanticTags: ["cause", "explanation"], contextualHints: ["原因", "因为", "导致"] }),
  phrase({ id: "p-it-depends", canonical: "it depends", variants: ["It depends"], level: 2, frequencyRank: 22, conversationFunctions: [...A, ...V], semanticTags: ["condition", "qualification"], contextualHints: ["取决于", "要看", "情况", "选择"] }),
  phrase({ id: "p-step-by-step", canonical: "step by step", level: 2, frequencyRank: 23, conversationFunctions: V, semanticTags: ["sequence", "action"], contextualHints: ["步骤", "逐步", "开始"] }),
  phrase({ id: "p-give-it-a-try", canonical: "give it a try", level: 2, frequencyRank: 24, conversationFunctions: V, semanticTags: ["encouragement", "action"], contextualHints: ["尝试", "试试", "行动"] }),
  phrase({ id: "p-keep-in-mind", canonical: "keep in mind", level: 2, frequencyRank: 25, conversationFunctions: [...V, ...E], semanticTags: ["caution", "reminder"], contextualHints: ["注意", "记住", "考虑"] }),
  phrase({ id: "p-good-thing", canonical: "the good thing is", level: 2, frequencyRank: 26, conversationFunctions: [...R, ...A], semanticTags: ["positive", "reframe"], contextualHints: ["好处", "优点", "积极"] }),
  phrase({ id: "p-problem-is", canonical: "the problem is", level: 2, frequencyRank: 27, conversationFunctions: [...E, ...A], semanticTags: ["problem", "constraint"], contextualHints: ["问题", "困难", "限制"] }),
  phrase({ id: "p-as-far-as-i-can-tell", canonical: "as far as I can tell", level: 2, frequencyRank: 28, conversationFunctions: [...A, "analyze_image"], semanticTags: ["uncertainty", "observation"], contextualHints: ["目前看", "判断", "似乎"] }),
  phrase({ id: "p-on-the-other-hand", canonical: "on the other hand", level: 2, frequencyRank: 29, conversationFunctions: [...E, ...A], semanticTags: ["contrast"], contextualHints: ["另一方面", "但是", "相反"] }),
  phrase({ id: "p-in-the-long-run", canonical: "in the long run", level: 2, frequencyRank: 30, conversationFunctions: [...V, ...A], semanticTags: ["time", "planning"], contextualHints: ["长期", "以后", "持续"] }),
  phrase({ id: "p-for-the-moment", canonical: "for the moment", level: 2, frequencyRank: 31, conversationFunctions: [...V, ...A], semanticTags: ["time", "temporary"], contextualHints: ["暂时", "眼下", "目前"] }),
  phrase({ id: "p-one-thing-at-a-time", canonical: "one thing at a time", level: 2, frequencyRank: 32, conversationFunctions: V, semanticTags: ["sequence", "focus"], contextualHints: ["一次", "逐个", "别急"] }),
  phrase({ id: "p-take-a-closer-look", canonical: "take a closer look", level: 2, frequencyRank: 33, conversationFunctions: ["analyze_image", "explain", "advise"], semanticTags: ["inspection", "action"], contextualHints: ["仔细看", "检查", "图片"] }),
  phrase({ id: "p-good-place-to-start", canonical: "a good place to start", level: 2, frequencyRank: 34, conversationFunctions: V, semanticTags: ["planning", "action"], contextualHints: ["开始", "第一步", "建议"] }),
  phrase({ id: "p-next-step", canonical: "the next step is", level: 2, frequencyRank: 35, conversationFunctions: V, semanticTags: ["sequence", "action"], contextualHints: ["下一步", "然后", "计划"] }),
  phrase({ id: "p-that-makes-sense", canonical: "that makes sense", variants: ["That makes sense"], level: 2, frequencyRank: 36, conversationFunctions: R, semanticTags: ["agreement", "empathy"], contextualHints: ["能理解", "合理", "确实"] }),
  phrase({ id: "p-key-is", canonical: "the key is", level: 2, frequencyRank: 37, conversationFunctions: [...E, ...V], semanticTags: ["emphasis", "focus"], contextualHints: ["关键", "核心", "重点"] }),
  phrase({ id: "p-in-other-words", canonical: "in other words", level: 2, frequencyRank: 38, conversationFunctions: ["explain", "summarize", "clarify"], semanticTags: ["rephrase", "clarity"], contextualHints: ["换句话说", "也就是", "总结"] }),
  phrase({ id: "p-based-on-what-you-said", canonical: "based on what you said", level: 2, frequencyRank: 39, conversationFunctions: ["advise", "empathize", "answer"], semanticTags: ["context", "empathy"], contextualHints: ["根据", "你说", "情况"] }),
  phrase({ id: "p-from-my-perspective", canonical: "from my perspective", level: 2, frequencyRank: 40, conversationFunctions: A, semanticTags: ["opinion"], contextualHints: ["看法", "观点", "认为"] }),
  phrase({ id: "p-to-be-honest", canonical: "to be honest", level: 2, frequencyRank: 41, conversationFunctions: [...A, ...R], semanticTags: ["stance", "candor"], contextualHints: ["坦白", "说实话", "直接"] }),
  phrase({ id: "p-as-a-result", canonical: "as a result", level: 3, frequencyRank: 42, conversationFunctions: E, semanticTags: ["result", "cause"], contextualHints: ["因此", "结果", "导致"] }),
  phrase({ id: "p-in-practice", canonical: "in practice", level: 3, frequencyRank: 43, conversationFunctions: [...E, ...V], semanticTags: ["practical", "application"], contextualHints: ["实际", "实践", "操作"] }),
  phrase({ id: "p-comes-down-to", canonical: "it comes down to", level: 3, frequencyRank: 44, conversationFunctions: [...E, ...A], semanticTags: ["summary", "cause"], contextualHints: ["归根结底", "关键", "本质"] }),
  phrase({ id: "p-what-matters-most", canonical: "what matters most is", level: 3, frequencyRank: 45, conversationFunctions: [...V, ...E], semanticTags: ["priority", "focus"], contextualHints: ["最重要", "优先", "关键"] }),
  phrase({ id: "p-trade-off", canonical: "the trade-off is", level: 3, frequencyRank: 46, conversationFunctions: [...A, ...E], semanticTags: ["tradeoff", "comparison"], contextualHints: ["权衡", "取舍", "代价"] }),
  phrase({ id: "p-good-chance", canonical: "there’s a good chance", variants: ["there's a good chance"], level: 3, frequencyRank: 47, conversationFunctions: A, semanticTags: ["probability"], contextualHints: ["很可能", "概率", "机会"] }),
  phrase({ id: "p-one-possible-reason", canonical: "one possible reason is", level: 3, frequencyRank: 48, conversationFunctions: E, semanticTags: ["cause", "uncertainty"], contextualHints: ["可能原因", "原因", "因为"] }),
  phrase({ id: "p-in-the-meantime", canonical: "in the meantime", level: 3, frequencyRank: 49, conversationFunctions: V, semanticTags: ["time", "parallel"], contextualHints: ["与此同时", "期间", "暂时"] }),
  phrase({ id: "p-simple-way", canonical: "a simple way to", level: 3, frequencyRank: 50, conversationFunctions: V, semanticTags: ["action", "simplify"], contextualHints: ["简单方法", "做法", "步骤"] }),
];
