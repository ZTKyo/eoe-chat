import type {
  CandidateSelection,
  ConversationAnalysis,
  GrammaticalFit,
  OverlayDecision,
  Phrase,
  PhraseRealizationProfile,
  PhrasePosition,
  UserPhraseReuseOpportunity,
} from "@/domain/eoe";
import { EOE_SELECTOR_VERSION } from "./constants";

function toneFor(analysis: ConversationAnalysis): string {
  if (analysis.sensitivity === "emotional") return "warm";
  if (analysis.sensitivity === "high_stakes" || analysis.sensitivity === "technical") return "direct";
  return "neutral";
}

function structuralFit(phrase: Phrase, profile?: PhraseRealizationProfile): GrammaticalFit {
  if (profile) return profile.bilingualSafety === "low" ? "low" : "high";
  if (phrase.bilingualPatterns.length === 0 || phrase.bilingualCompatibility < 0.5) return "low";
  if (phrase.preferredPositions.includes("sentence_middle") && phrase.labelLikeRisk < 0.7) return "high";
  return "medium";
}

function responseLengthFit(phrase: Phrase, analysis: ConversationAnalysis): GrammaticalFit {
  if (analysis.responseLength === "short" && phrase.grammaticalRole !== "reaction") return "low";
  if (analysis.responseLength === "long" || phrase.grammaticalRole === "reaction") return "high";
  return "high";
}

function insertionPosition(phrase: Phrase, profile?: PhraseRealizationProfile): PhrasePosition {
  const positions = profile?.allowedPositions ?? phrase.preferredPositions;
  if (positions.includes("sentence_start")) return "sentence_start";
  if (positions.includes("sentence_middle")) return "sentence_middle";
  return positions[0];
}

export function selectCandidates(input: {
  registry: Phrase[];
  decision: OverlayDecision;
  analysis: ConversationAnalysis;
  userMessage: string;
  recentExposurePhraseIds: string[];
  realizationProfiles?: ReadonlyMap<string, PhraseRealizationProfile>;
  userPhraseReuseOpportunity?: UserPhraseReuseOpportunity;
}): CandidateSelection {
  if (input.decision.mode !== "preferred") {
    return { candidates: [], noFit: true, selectorVersion: EOE_SELECTOR_VERSION };
  }
  if (input.analysis.sensitivity === "high_stakes") {
    return { candidates: [], noFit: true, selectorVersion: EOE_SELECTOR_VERSION };
  }

  const text = input.userMessage.toLocaleLowerCase();
  const tone = toneFor(input.analysis);
  const recentIndex = new Map<string, number>();
  input.recentExposurePhraseIds.forEach((id, index) => {
    if (!recentIndex.has(id)) recentIndex.set(id, index);
  });

  const candidates = input.registry
    .filter((phrase) => phrase.status === "active")
    .filter((phrase) => phrase.level <= input.decision.effectiveLevel)
    .filter((phrase) =>
      phrase.id === input.userPhraseReuseOpportunity?.phraseId ||
      phrase.conversationFunctions.includes(input.analysis.primaryFunction) ||
      (input.analysis.secondaryFunction ? phrase.conversationFunctions.includes(input.analysis.secondaryFunction) : false),
    )
    .filter((phrase) => phrase.compatibleTones.includes(tone))
    .filter((phrase) => input.analysis.sensitivity !== "emotional" || phrase.grammaticalRole === "reaction")
    .filter((phrase) => {
      const index = recentIndex.get(phrase.id);
      const directEnglishReuse = phrase.id === input.userPhraseReuseOpportunity?.phraseId;
      return directEnglishReuse || index === undefined || index >= phrase.cooldownTurns;
    })
    .filter((phrase) => structuralFit(phrase, input.realizationProfiles?.get(phrase.id)) !== "low")
    .filter((phrase) => responseLengthFit(phrase, input.analysis) !== "low")
    .filter((phrase) => {
      const profile = input.realizationProfiles?.get(phrase.id);
      if (profile && !profile.betaFrame.autoLiveSafe) return false;
      const labelLikeRisk = profile?.labelLikeRisk ?? phrase.labelLikeRisk;
      const translationRisk = profile?.translationRisk ?? phrase.translationRisk;
      return labelLikeRisk < 0.7 && translationRisk < 0.7 && phrase.punctuationRisk < 0.7 &&
        (profile?.taskReplacementRisk ?? 0) < 0.7 &&
        !profile?.excludedFunctions.includes(input.analysis.primaryFunction);
    })
    .filter((phrase) => {
      const hintMatch = phrase.contextualHints.some((hint) => text.includes(hint.toLocaleLowerCase()));
      const directEnglishReuse = phrase.id === input.userPhraseReuseOpportunity?.phraseId;
      const cooledReuse = recentIndex.has(phrase.id);
      const preferredFunction = input.realizationProfiles?.get(phrase.id)?.preferredFunctions.includes(input.analysis.primaryFunction) ?? false;
      const strongFunctionFrame =
        (input.analysis.primaryFunction === "advise" && ["verb_phrase", "noun_phrase"].includes(phrase.grammaticalRole)) ||
        (input.analysis.primaryFunction === "react" && phrase.grammaticalRole === "reaction") ||
        (input.analysis.primaryFunction === "explain" && phrase.id === "p-for-example") ||
        (input.analysis.primaryFunction === "answer" && ["p-i-think", "p-it-depends", "p-at-the-same-time"].includes(phrase.id));
      return hintMatch || directEnglishReuse || cooledReuse || preferredFunction || strongFunctionFrame;
    })
    .map((phrase) => {
      const profile = input.realizationProfiles?.get(phrase.id);
      const grammaticalFit = structuralFit(phrase, profile);
      const lengthFit = responseLengthFit(phrase, input.analysis);
      const reasons: string[] = [
        "level_fit",
        "function_fit",
        "tone_fit",
        "bilingual_pattern_available",
        "sentence_boundary_eligible",
        "naturalness_eligible",
      ];
      const hintMatches = phrase.contextualHints.filter((hint) => text.includes(hint.toLocaleLowerCase())).length;
      const directEnglishReuse = phrase.id === input.userPhraseReuseOpportunity?.phraseId;
      const exposureIndex = recentIndex.get(phrase.id);
      const isReuse = directEnglishReuse || (exposureIndex !== undefined && exposureIndex >= phrase.cooldownTurns);
      if (hintMatches > 0) reasons.push("context_hint");
      if (isReuse) reasons.push("reuse_opportunity");
      const score =
        40 +
        phrase.reuseValue * 20 +
        phrase.bilingualCompatibility * 18 +
        Math.max(0, 15 - phrase.frequencyRank * 0.2) +
        (phrase.level === input.decision.effectiveLevel ? 4 : 2) +
        hintMatches * 7 +
        (isReuse ? 12 : 0) +
        (directEnglishReuse ? 100 : 0) -
        phrase.difficulty * 0.25 -
        phrase.labelLikeRisk * 8 -
        phrase.translationRisk * 6 -
        phrase.punctuationRisk * 5;
      return {
        phraseId: phrase.id,
        score: Number(score.toFixed(3)),
        reasons,
        isReuse,
        grammaticalFit,
        insertionPosition: insertionPosition(phrase, profile),
        allowedPositions: profile?.allowedPositions ?? phrase.preferredPositions,
        bilingualCompatibility: phrase.bilingualCompatibility,
        punctuationRisk: phrase.punctuationRisk,
        translationRisk: profile?.translationRisk ?? phrase.translationRisk,
        labelLikeRisk: profile?.labelLikeRisk ?? phrase.labelLikeRisk,
        responseLengthFit: lengthFit,
      };
    })
    .sort((left, right) => right.score - left.score || left.phraseId.localeCompare(right.phraseId))
    .slice(0, 5);

  return {
    candidates,
    selectedPhraseId: candidates[0]?.phraseId,
    noFit: candidates.length === 0,
    selectorVersion: EOE_SELECTOR_VERSION,
  };
}
