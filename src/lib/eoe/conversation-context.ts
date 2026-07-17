import type { ChatRequest } from "@/domain/chat";
import type {
  Phrase,
  TemporaryOverlayPreference,
  UserPhraseReuseOpportunity,
} from "@/domain/eoe";
import type { VocabularyAssistanceContextV2 } from "./assistance-v2";
import type { PhraseReferenceResolutionV1 } from "./phrase-reference-resolution";
import { resolvePhraseReference } from "./phrase-reference-resolution";
import { getPhraseById, PHRASE_REGISTRY } from "./registry/phrase-registry";
import { detectUserPhraseReuse } from "./user-phrase-reuse";

export interface ResolvedAssistanceContext {
  active: true;
  trigger: "click" | "long_press" | "meaning" | "pronunciation" | "clarification";
  resolved: boolean;
  sourceMessageId?: string;
  segmentIndex?: number;
  phraseId?: string;
  phrase?: Phrase;
  sourceSentence?: string;
  sourceTemplate?: string;
  sourcePhraseSurface?: string;
  previousUserMessage?: string;
  topic?: string;
  ambiguousPhraseIds: string[];
  referenceResolution: PhraseReferenceResolutionV1;
  contextV2?: VocabularyAssistanceContextV2;
}

export interface ConversationContext {
  chineseOnlyScope: boolean;
  difficultySignal: boolean;
  temporaryOverlayPreference?: TemporaryOverlayPreference;
  contextualAcknowledgement?: {
    active: boolean;
    priorTopic?: string;
  };
  userEnglishPresent: boolean;
  userEnglishReuseOpportunity: boolean;
  userPhraseReuseOpportunity?: UserPhraseReuseOpportunity;
  assistance?: ResolvedAssistanceContext;
}

const chineseOnlyPattern = /只用中文|请用中文|不要英文|全中文|多用中文|先用中文(?:吧)?/u;
const difficultyPattern = /英语(?:有点|太|比较)?难|英文(?:有点|太|比较)?难|刚才那句没看懂|英文少一点|没看懂英文|看不懂英语/u;
const resumePattern = /(?:可以|请|想)?继续(?:用)?英文|恢复英文|英文可以多一点/u;
const acknowledgementPattern = /^(?:好|好的|嗯|哦|明白了|可以)[。！!.]?$/u;
const meaningPattern = /什么意思|怎么理解|解释(?:一下)?(?:这个|刚才)?(?:英文|短语)|没看懂(?:你)?刚才的英文/u;
const pronunciationPattern = /怎么读|怎么发音|读音/u;
const clarificationPattern = /刚才(?:那句|那个|的)?英文(?:是什么|短语)?|英文短语.*澄清/u;

function previousUserMessage(request: ChatRequest, beforeIndex: number): string | undefined {
  return request.messages.slice(0, beforeIndex).reverse().find((message) => message.role === "user")?.content;
}

function resolveAssistance(request: ChatRequest, latestUser: string): ResolvedAssistanceContext | undefined {
  const explicit = request.engineState?.assistanceRequest;
  const previousUserAskedAboutPhrase = request.messages
    .slice(0, -1)
    .filter((message) => message.role === "user")
    .at(-1)?.content.match(/什么意思|怎么读|刚才.*(?:那个|那句|英文)/u);
  const selectsNamedPhrase = /我指|我是指|就是|是前面|是刚才/u.test(latestUser) &&
    /[A-Za-z]{2,}/u.test(latestUser);
  const trigger = explicit?.trigger ?? (pronunciationPattern.test(latestUser)
    ? "pronunciation"
    : meaningPattern.test(latestUser)
      ? "meaning"
      : clarificationPattern.test(latestUser)
        ? "clarification"
        : selectsNamedPhrase && previousUserAskedAboutPhrase
          ? "clarification"
        : undefined);
  if (!trigger) return undefined;

  const reference = resolvePhraseReference(request, latestUser);
  const selected = reference.selected;
  const phrase = selected ? getPhraseById(selected.phraseId) : explicit?.phraseId ? getPhraseById(explicit.phraseId) : undefined;
  const previous = selected ? previousUserMessage(request, selected.messageIndex) : undefined;
  const topic = previous ?? request.messages.filter((message) => message.role === "user").slice(-3, -1).at(-1)?.content;
  const assistanceType = trigger === "meaning" || trigger === "pronunciation" || trigger === "clarification"
    ? trigger
    : "general";
  const contextV2 = selected && phrase && previous && topic ? {
    sourceMessageId: selected.sourceMessageId,
    sourceSegmentIndex: selected.sourceSegmentIndex,
    phraseId: phrase.id,
    phraseCanonical: phrase.canonical,
    sourceSentence: selected.sourceSentence,
    pronunciation: phrase.pronunciation,
    previousUserMessage: previous,
    topicSummary: topic.replace(/\s+/gu, " ").trim().slice(0, 240),
    assistanceType,
  } satisfies VocabularyAssistanceContextV2 : undefined;
  return {
    active: true,
    trigger,
    resolved: Boolean(selected && phrase),
    sourceMessageId: selected?.sourceMessageId,
    segmentIndex: selected?.sourceSegmentIndex,
    phraseId: phrase?.id,
    phrase,
    sourceSentence: selected?.sourceSentence,
    sourceTemplate: selected?.sourceTemplate,
    sourcePhraseSurface: selected?.phraseSurface,
    previousUserMessage: previous,
    topic,
    ambiguousPhraseIds: reference.resolution.status === "ambiguous"
      ? reference.resolution.candidates.map((candidate) => candidate.phraseId)
      : [],
    referenceResolution: reference.resolution,
    contextV2,
  };
}

export function resolveConversationContext(request: ChatRequest): ConversationContext {
  const latestUser = [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const userMessages = request.messages.filter((message) => message.role === "user");
  const activeRegistry = PHRASE_REGISTRY.filter((phrase) => phrase.status === "active");
  let temporaryOverlayPreference: TemporaryOverlayPreference = {
    mode: "normal",
    reason: "user_resume",
  };
  for (const message of userMessages) {
    if (chineseOnlyPattern.test(message.content)) {
      temporaryOverlayPreference = { mode: "chinese_only", reason: "explicit_chinese" };
    } else if (difficultyPattern.test(message.content)) {
      temporaryOverlayPreference = { mode: "reduced", reason: "user_difficulty" };
    } else if (
      resumePattern.test(message.content) ||
      detectUserPhraseReuse(message.content, activeRegistry)
    ) {
      temporaryOverlayPreference = { mode: "normal", reason: "user_resume" };
    }
  }
  const userPhraseReuseOpportunity = detectUserPhraseReuse(latestUser, activeRegistry);
  const userEnglishPresent = Boolean(userPhraseReuseOpportunity);
  const latestUserIndex = request.messages.map((message) => message.role).lastIndexOf("user");
  const priorTopic = request.messages
    .slice(0, latestUserIndex)
    .reverse()
    .find((message) => message.role === "user" && !acknowledgementPattern.test(message.content.trim()))
    ?.content;
  const contextualAcknowledgement = {
    active: latestUserIndex > 0 && acknowledgementPattern.test(latestUser.trim()),
    priorTopic,
  };
  return {
    chineseOnlyScope: temporaryOverlayPreference.mode === "chinese_only",
    difficultySignal: difficultyPattern.test(latestUser),
    temporaryOverlayPreference,
    contextualAcknowledgement,
    userEnglishPresent,
    userEnglishReuseOpportunity: userEnglishPresent,
    userPhraseReuseOpportunity,
    assistance: resolveAssistance(request, latestUser),
  };
}
