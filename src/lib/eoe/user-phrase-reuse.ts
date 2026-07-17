import type { Phrase, UserPhraseReuseOpportunity } from "@/domain/eoe";

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/gu, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function detectUserPhraseReuse(
  message: string,
  phrases: readonly Phrase[],
): UserPhraseReuseOpportunity | undefined {
  const normalizedMessage = normalize(message);
  const matches = phrases
    .filter((phrase) => phrase.status === "active")
    .flatMap((phrase) => [phrase.canonical, ...phrase.variants].map((surface) => ({ phrase, surface })))
    .map(({ phrase, surface }) => {
      const normalizedSurface = normalize(surface);
      const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escape(normalizedSurface)})(?=$|[^\\p{L}\\p{N}])`, "iu");
      const match = normalizedMessage.match(pattern);
      if (!match?.[1]) return undefined;
      const exactPattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])(${escape(surface)})(?=$|[^\\p{L}\\p{N}])`, "u");
      const exactMatch = message.normalize("NFKC").match(exactPattern)?.[1];
      return {
        phraseId: phrase.id,
        matchedText: exactMatch ?? match[1],
        confidence: exactMatch ? 1 : 0.98,
        source: exactMatch ? "exact" as const : "normalized_variant" as const,
        rank: phrase.frequencyRank,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((left, right) => left.rank - right.rank || left.phraseId.localeCompare(right.phraseId));

  const best = matches[0];
  return best ? {
    phraseId: best.phraseId,
    matchedText: best.matchedText,
    confidence: best.confidence,
    source: best.source,
  } : undefined;
}
