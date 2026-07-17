import { phraseSchema, type Phrase } from "@/domain/eoe";
import { CORE_PHRASES_V1, REGISTRY_VERSION } from "../phrases/core-v1";

export const PHRASE_REGISTRY: Phrase[] = CORE_PHRASES_V1.map((phrase) => phraseSchema.parse(phrase));

const phraseMap = new Map(PHRASE_REGISTRY.map((phrase) => [phrase.id, phrase]));

export function getPhraseById(id: string): Phrase | undefined {
  return phraseMap.get(id);
}

export function isRegistryPhrase(id: string): boolean {
  return phraseMap.has(id);
}

export { REGISTRY_VERSION };
