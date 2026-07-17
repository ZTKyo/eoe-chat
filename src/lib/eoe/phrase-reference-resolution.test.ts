import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import { resolvePhraseReference } from "./phrase-reference-resolution";

function request(latest: string, phrases: Array<{ id: string; surface: string }>): ChatRequest {
  return {
    conversationId: "phrase-reference",
    messages: [
      { id: "u1", role: "user", content: "比较一下。" },
      ...phrases.map((phrase, index) => ({
        id: `a${index + 1}`,
        role: "assistant" as const,
        content: `${phrase.surface}，继续当前判断。`,
        segments: [
          {
            type: "english_chunk" as const,
            content: phrase.surface,
            phraseId: phrase.id,
            isNew: false,
            assistanceAvailable: true,
          },
          { type: "text" as const, content: "，继续当前判断。", language: "zh" as const },
        ],
      })),
      { id: "u2", role: "user", content: latest },
    ],
    attachments: [],
  };
}

describe("PhraseReferenceResolutionV1", () => {
  it("resolves a single historical Phrase", () => {
    expect(resolvePhraseReference(
      request("什么意思？", [{ id: "p-for-now", surface: "For now" }]),
      "什么意思？",
    ).resolution).toMatchObject({
      status: "resolved",
      phraseId: "p-for-now",
      sourceMessageId: "a1",
      sourceSegmentIndex: 0,
    });
  });

  it("returns deterministic candidates for an ambiguous reference", () => {
    const result = resolvePhraseReference(
      request("刚才那个什么意思？", [
        { id: "p-it-depends", surface: "It depends" },
        { id: "p-for-now", surface: "For now" },
      ]),
      "刚才那个什么意思？",
    );
    expect(result.resolution).toMatchObject({
      status: "ambiguous",
      candidates: [
        { phraseId: "p-it-depends", canonical: "it depends", sourceMessageId: "a1" },
        { phraseId: "p-for-now", canonical: "for now", sourceMessageId: "a2" },
      ],
    });
  });

  it("returns not_found only when structured history has no Phrase", () => {
    const empty: ChatRequest = {
      conversationId: "empty",
      messages: [{ id: "u1", role: "user", content: "刚才那个什么意思？" }],
      attachments: [],
    };
    expect(resolvePhraseReference(empty, "刚才那个什么意思？").resolution).toEqual({
      status: "not_found",
    });
  });

  it("uses a named Phrase to resolve a prior ambiguity", () => {
    const value = request("我指 For now。", [
      { id: "p-it-depends", surface: "It depends" },
      { id: "p-for-now", surface: "For now" },
    ]);
    expect(resolvePhraseReference(value, "我指 For now。").resolution).toMatchObject({
      status: "resolved",
      phraseId: "p-for-now",
      sourceMessageId: "a2",
    });
  });
});
