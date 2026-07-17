import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import { resolveConversationContext } from "./conversation-context";

describe("M2.4 multi-turn context", () => {
  it("resolves Vocabulary Assistance from actual structured history", () => {
    const request: ChatRequest = {
      conversationId: "c1",
      messages: [
        { id: "u1", role: "user", content: "我们先怎么安排？" },
        {
          id: "a1",
          role: "assistant",
          content: "For now，先确定今天的目标。",
          segments: [
            { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: true, assistanceAvailable: true },
            { type: "text", content: "，先确定今天的目标。", language: "zh" },
          ],
        },
        { id: "u2", role: "user", content: "什么意思？" },
      ],
      attachments: [],
    };
    const context = resolveConversationContext(request);
    expect(context.assistance).toMatchObject({
      resolved: true,
      sourceMessageId: "a1",
      phraseId: "p-for-now",
      sourceSentence: "For now，先确定今天的目标。",
    });
  });

  it("keeps Chinese-only scope until the user actively resumes English", () => {
    const scoped = resolveConversationContext({
      conversationId: "c1",
      messages: [
        { role: "user", content: "请只用中文" },
        { role: "assistant", content: "好的。" },
        { role: "user", content: "继续说一下" },
      ],
      attachments: [],
    });
    expect(scoped.chineseOnlyScope).toBe(true);

    const resumed = resolveConversationContext({
      conversationId: "c1",
      messages: [
        { role: "user", content: "请只用中文" },
        { role: "assistant", content: "好的。" },
        { role: "user", content: "I think this works，你怎么看？" },
      ],
      attachments: [],
    });
    expect(resumed.chineseOnlyScope).toBe(false);
    expect(resumed.userEnglishReuseOpportunity).toBe(true);
  });
});
