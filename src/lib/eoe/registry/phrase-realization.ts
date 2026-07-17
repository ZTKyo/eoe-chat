import {
  phraseRealizationProfileSchema,
  type BetaBilingualFrameProfile,
  type Phrase,
  type PhraseRealizationProfile,
  type RealizationPosition,
} from "@/domain/eoe";
import { PHRASE_REGISTRY } from "./phrase-registry";

const PLACEHOLDER = "{{EOE_PHRASE}}";

const profile = (value: PhraseRealizationProfile): PhraseRealizationProfile =>
  phraseRealizationProfileSchema.parse(value);

function betaFrame(
  phraseId: string,
  input: Omit<BetaBilingualFrameProfile, "phraseId">,
): BetaBilingualFrameProfile {
  return { phraseId, ...input };
}

const common = {
  forbiddenBeforePunctuation: [":", "：", "，", "("],
  forbiddenAfterPunctuation: [":", "："],
  forbiddenPatterns: [
    "chinese_internal_grammar_slot",
    "label_or_heading",
    "direct_translation",
    "isolated_placeholder",
  ],
  requiresChineseConnectorBefore: false,
  requiresChineseConnectorAfter: false,
  canBeWholeClause: false,
  requiresClauseSupport: false,
  requiresFollowUpContent: false,
  canBeStandaloneReaction: false,
  canStartChineseSentence: true,
  canAppearAfterChineseSubject: false,
  canAppearBeforeChinesePredicate: false,
  preferredFunctions: [],
  excludedFunctions: [],
  labelLikeRisk: 0.12,
  translationRisk: 0.12,
  taskReplacementRisk: 0.08,
  capitalizeAtSentenceStart: true,
  liveSafe: true,
  realizationVersion: "eoe.realization.text-beta-rc.v1",
};

const boundaryForbiddenFrames = [
  "中文名词 + English Chunk + 中文比较词",
  "中文程度副词 + English Chunk",
  "中文动词 + English Chunk + 中文宾语",
  "按 English Chunk 的节奏",
  "中文同义表达 + 重复 English Chunk",
];

export const PHRASE_REALIZATION_PROFILES: PhraseRealizationProfile[] = [
  profile({
    ...common,
    phraseId: "p-i-think",
    bilingualSafety: "high",
    grammaticalRole: "stance_marker",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresClauseSupport: true,
    preferredFunctions: ["answer", "advise"],
    betaFrame: betaFrame("p-i-think", {
      autoLiveSafe: true,
      allowedFrameTypes: ["english_clause_stem", "sentence_initial_connector", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}，这个方向值得继续。`, `前面的条件已经明确。${PLACEHOLDER}，下一步应先验证风险。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: true,
      capitalizationPolicy: "Capitalize I at every sentence boundary.",
      punctuationPolicy: "Start a new sentence and follow the Phrase with a comma plus a substantive Chinese judgment.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-it-depends",
    bilingualSafety: "high",
    grammaticalRole: "clause_frame",
    allowedPositions: ["sentence_start", "sentence_middle"],
    canBeWholeClause: true,
    preferredFunctions: ["answer", "advise"],
    betaFrame: betaFrame("p-it-depends", {
      autoLiveSafe: true,
      allowedFrameTypes: ["english_clause_stem", "sentence_initial_connector", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}，主要看目标和限制。`, `两种选择各有代价。${PLACEHOLDER}，关键是你更重视哪项条件。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: true,
      capitalizationPolicy: "Capitalize It at every sentence boundary.",
      punctuationPolicy: "Start a new sentence and follow with a Chinese condition or judgment.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-that-makes-sense",
    bilingualSafety: "high",
    grammaticalRole: "clause_frame",
    allowedPositions: ["sentence_start", "sentence_middle"],
    canBeWholeClause: true,
    canBeStandaloneReaction: true,
    preferredFunctions: ["react", "empathize"],
    betaFrame: betaFrame("p-that-makes-sense", {
      autoLiveSafe: true,
      allowedFrameTypes: ["standalone_reaction", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}。接下来可以先验证最关键的一步。`, `你先缩小范围再验证。${PLACEHOLDER}。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: false,
      capitalizationPolicy: "Capitalize That and use the Phrase as a complete reaction sentence.",
      punctuationPolicy: "Use a full stop after the complete English reaction; never splice it into a Chinese clause.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-for-example",
    bilingualSafety: "high",
    grammaticalRole: "discourse_marker",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresFollowUpContent: true,
    preferredFunctions: ["explain", "answer", "summarize"],
    betaFrame: betaFrame("p-for-example", {
      autoLiveSafe: true,
      allowedFrameTypes: ["sentence_initial_connector", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}，如果通勤每天多一小时，就要把时间成本算进去。`, `先把抽象概念落到实际情境。${PLACEHOLDER}，可以比较一次真实购买决定。`],
      forbiddenFrames: [...boundaryForbiddenFrames, "例如/比如/举例 + For example"],
      requiresFollowingClause: true,
      capitalizationPolicy: "Capitalize For at every sentence boundary.",
      punctuationPolicy: "Start a new example sentence; the following Chinese clause must contain a real example.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-for-now",
    bilingualSafety: "high",
    grammaticalRole: "adverbial",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresFollowUpContent: true,
    preferredFunctions: ["advise", "answer", "complete_task"],
    betaFrame: betaFrame("p-for-now", {
      autoLiveSafe: true,
      allowedFrameTypes: ["sentence_initial_connector", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}，先保留风险更低的方案。`, `信息还不完整。${PLACEHOLDER}，先验证最关键的假设。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: true,
      capitalizationPolicy: "Capitalize For at every sentence boundary.",
      punctuationPolicy: "Start a new sentence and follow with the temporary action.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-at-the-same-time",
    bilingualSafety: "high",
    grammaticalRole: "discourse_marker",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresFollowUpContent: true,
    preferredFunctions: ["answer", "explain", "summarize", "advise"],
    betaFrame: betaFrame("p-at-the-same-time", {
      autoLiveSafe: true,
      allowedFrameTypes: ["sentence_initial_connector", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}，也要考虑执行成本。`, `这个方案能节省时间。${PLACEHOLDER}，还要确认长期费用。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: true,
      capitalizationPolicy: "Capitalize At at every sentence boundary.",
      punctuationPolicy: "Start a new contrast or addition sentence and follow with a substantive Chinese clause.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-in-the-long-run",
    bilingualSafety: "high",
    grammaticalRole: "adverbial",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresFollowUpContent: true,
    preferredFunctions: ["answer", "advise"],
    betaFrame: betaFrame("p-in-the-long-run", {
      autoLiveSafe: true,
      allowedFrameTypes: ["sentence_initial_connector", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}，维护成本会比一次性交付更重要。`, `短期内可以先试用。${PLACEHOLDER}，仍要看持续维护的负担。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: true,
      capitalizationPolicy: "Capitalize In at every sentence boundary.",
      punctuationPolicy: "Start a new long-term consequence sentence and follow with a substantive Chinese clause.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-sounds-good",
    bilingualSafety: "high",
    grammaticalRole: "clause_frame",
    allowedPositions: ["sentence_start", "sentence_middle"],
    canBeWholeClause: true,
    canBeStandaloneReaction: true,
    preferredFunctions: ["react"],
    betaFrame: betaFrame("p-sounds-good", {
      autoLiveSafe: true,
      allowedFrameTypes: ["standalone_reaction", "user_phrase_reuse"],
      allowedFrames: [`${PLACEHOLDER}。那就先按这个步骤开始。`, `你准备先做小范围验证。${PLACEHOLDER}。`],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: false,
      capitalizationPolicy: "Capitalize Sounds and use the Phrase as a complete reaction sentence.",
      punctuationPolicy: "Use a full stop after the reaction; never splice it into a Chinese clause.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-a-little",
    bilingualSafety: "low",
    grammaticalRole: "adverbial",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresClauseSupport: true,
    liveSafe: false,
    betaFrame: betaFrame("p-a-little", {
      autoLiveSafe: false,
      allowedFrameTypes: ["user_phrase_reuse"],
      allowedFrames: [],
      forbiddenFrames: [...boundaryForbiddenFrames, "a little + 中文形容词/比较词/谓语"],
      requiresFollowingClause: true,
      capitalizationPolicy: "Preserve the user's surface when quoting or assisting.",
      punctuationPolicy: "Never select automatically; retain only for recognition, history, and assistance.",
    }),
  }),
  profile({
    ...common,
    phraseId: "p-kind-of",
    bilingualSafety: "low",
    grammaticalRole: "adverbial",
    allowedPositions: ["sentence_start", "sentence_middle"],
    requiresClauseSupport: true,
    liveSafe: false,
    betaFrame: betaFrame("p-kind-of", {
      autoLiveSafe: false,
      allowedFrameTypes: ["user_phrase_reuse"],
      allowedFrames: [],
      forbiddenFrames: [...boundaryForbiddenFrames, "kind of + 中文谓语/形容词"],
      requiresFollowingClause: true,
      capitalizationPolicy: "Preserve the user's surface when quoting or assisting.",
      punctuationPolicy: "Never select automatically; retain only for recognition, history, and assistance.",
    }),
  }),
];

export const PHRASE_REALIZATION_PROFILE_MAP = new Map(
  PHRASE_REALIZATION_PROFILES.map((item) => [item.phraseId, item]),
);

export const LIVE_SAFE_REALIZATION_PROFILES = PHRASE_REALIZATION_PROFILES.filter(
  (item) => item.betaFrame.autoLiveSafe,
);

export const LIVE_SAFE_REALIZATION_PROFILE_MAP = new Map(
  LIVE_SAFE_REALIZATION_PROFILES.map((item) => [item.phraseId, item]),
);

export const LIVE_SAFE_PHRASE_IDS = new Set(LIVE_SAFE_REALIZATION_PROFILE_MAP.keys());

export const LIVE_SAFE_PHRASES: Phrase[] = PHRASE_REGISTRY.filter(
  (phrase) => phrase.status === "active" && LIVE_SAFE_PHRASE_IDS.has(phrase.id),
);

export function getPhraseRealizationProfile(phraseId: string): PhraseRealizationProfile | undefined {
  return PHRASE_REALIZATION_PROFILE_MAP.get(phraseId);
}

export function getAssistanceRealizationProfile(phraseId: string): PhraseRealizationProfile {
  return getPhraseRealizationProfile(phraseId) ?? profile({
    ...common,
    phraseId,
    bilingualSafety: "medium",
    grammaticalRole: "other",
    allowedPositions: ["sentence_start", "sentence_middle", "sentence_end"],
    canBeWholeClause: true,
    requiresClauseSupport: false,
    requiresFollowUpContent: true,
    labelLikeRisk: 0.3,
    translationRisk: 0.3,
    taskReplacementRisk: 0.1,
    liveSafe: false,
    betaFrame: betaFrame(phraseId, {
      autoLiveSafe: false,
      allowedFrameTypes: ["user_phrase_reuse"],
      allowedFrames: [],
      forbiddenFrames: boundaryForbiddenFrames,
      requiresFollowingClause: false,
      capitalizationPolicy: "Preserve the historical Registry surface.",
      punctuationPolicy: "Available only for user-requested assistance.",
    }),
  });
}

export function realizePhraseSurface(phrase: Phrase, position?: RealizationPosition): string {
  const realization = getPhraseRealizationProfile(phrase.id);
  if (
    realization?.capitalizeAtSentenceStart &&
    (position === "sentence_start" || realization.betaFrame.autoLiveSafe)
  ) {
    const capitalized = `${phrase.canonical.charAt(0).toLocaleUpperCase()}${phrase.canonical.slice(1)}`;
    return phrase.variants.find((variant) => variant === capitalized) ?? capitalized;
  }
  return phrase.canonical;
}
