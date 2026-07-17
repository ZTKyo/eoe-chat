import type { Phrase } from "@/domain/eoe";

export function phrasePronunciation(phrase: Phrase): string {
  return phrase.pronunciation;
}
