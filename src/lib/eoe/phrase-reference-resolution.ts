import type { ChatRequest, MessageSegment } from "@/domain/chat";
import { PHRASE_REGISTRY, getPhraseById } from "./registry/phrase-registry";

export interface PhraseReferenceCandidateV1 {
  phraseId: string;
  canonical: string;
  sourceSentence: string;
  sourceMessageId: string;
  sourceSegmentIndex: number;
}

export type PhraseReferenceResolutionV1 =
  | {
      status: "resolved";
      phraseId: string;
      sourceMessageId: string;
      sourceSegmentIndex: number;
    }
  | {
      status: "ambiguous";
      candidates: PhraseReferenceCandidateV1[];
    }
  | {
      status: "not_found";
    };

interface PhraseReferenceTrace extends PhraseReferenceCandidateV1 {
  sourceTemplate: string;
  phraseSurface: string;
  messageIndex: number;
}

export interface PhraseReferenceResolutionResult {
  resolution: PhraseReferenceResolutionV1;
  selected?: PhraseReferenceTrace;
  traces: PhraseReferenceTrace[];
}

function sentenceTemplate(
  segments: MessageSegment[],
  segmentIndex: number,
): { sentence: string; template: string } {
  return {
    sentence: segments.map((segment) => segment.content).join(""),
    template: segments
      .map((segment, index) => index === segmentIndex ? "{{EOE_PHRASE}}" : segment.content)
      .join(""),
  };
}

function collectTraces(request: ChatRequest): PhraseReferenceTrace[] {
  return request.messages.flatMap((message, messageIndex) => {
    if (message.role !== "assistant" || !message.segments) return [];
    return message.segments.flatMap((segment, sourceSegmentIndex) => {
      if (segment.type !== "english_chunk") return [];
      const phrase = getPhraseById(segment.phraseId);
      if (!phrase) return [];
      const source = sentenceTemplate(message.segments ?? [], sourceSegmentIndex);
      return [{
        phraseId: phrase.id,
        canonical: phrase.canonical,
        sourceSentence: source.sentence,
        sourceMessageId: message.id ?? `history-assistant-${messageIndex}`,
        sourceSegmentIndex,
        sourceTemplate: source.template,
        phraseSurface: segment.content,
        messageIndex,
      }];
    });
  });
}

function uniqueLatestByPhrase(traces: PhraseReferenceTrace[]): PhraseReferenceTrace[] {
  const latest = new Map<string, PhraseReferenceTrace>();
  for (const trace of traces) latest.set(trace.phraseId, trace);
  return [...latest.values()].sort((left, right) => left.messageIndex - right.messageIndex);
}

export function resolvePhraseReference(
  request: ChatRequest,
  latestUser: string,
): PhraseReferenceResolutionResult {
  const explicit = request.engineState?.assistanceRequest;
  let traces = collectTraces(request);
  if (explicit?.sourceMessageId) {
    traces = traces.filter((item) => item.sourceMessageId === explicit.sourceMessageId);
  }
  if (explicit?.phraseId) {
    traces = traces.filter((item) => item.phraseId === explicit.phraseId);
  }
  if (explicit?.segmentIndex !== undefined) {
    traces = traces.filter((item) => item.sourceSegmentIndex === explicit.segmentIndex);
  }

  if (!explicit?.phraseId) {
    const mentionedIds = PHRASE_REGISTRY
      .filter((phrase) =>
        [phrase.canonical, ...phrase.variants].some((surface) =>
          latestUser.toLocaleLowerCase().includes(surface.toLocaleLowerCase())))
      .map((phrase) => phrase.id);
    if (mentionedIds.length > 0) {
      traces = traces.filter((item) => mentionedIds.includes(item.phraseId));
    }
  }

  const candidates = uniqueLatestByPhrase(traces);
  if (candidates.length === 0) {
    return { resolution: { status: "not_found" }, traces: [] };
  }
  if (candidates.length === 1) {
    const selected = candidates[0];
    return {
      resolution: {
        status: "resolved",
        phraseId: selected.phraseId,
        sourceMessageId: selected.sourceMessageId,
        sourceSegmentIndex: selected.sourceSegmentIndex,
      },
      selected,
      traces: candidates,
    };
  }
  return {
    resolution: {
      status: "ambiguous",
      candidates: candidates.map((item) => ({
        phraseId: item.phraseId,
        canonical: item.canonical,
        sourceSentence: item.sourceSentence,
        sourceMessageId: item.sourceMessageId,
        sourceSegmentIndex: item.sourceSegmentIndex,
      })),
    },
    traces: candidates,
  };
}
