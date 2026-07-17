import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import { segmentsToPlainText } from "@/domain/chat";
import { ProviderGateway } from "@/lib/providers/gateway";
import { MockProvider } from "@/lib/providers/mock-provider";
import { runEoeEngine } from "./engine";
import { GOLDEN_CONVERSATION_CORPUS } from "./golden-corpus";

function gateway(): ProviderGateway {
  const mock = new MockProvider();
  return new ProviderGateway({ primary: mock, vision: mock, mock, forceMock: true });
}

describe("EOE Golden Conversation Corpus", () => {
  it.each(GOLDEN_CONVERSATION_CORPUS)("passes $category ($id)", async (scenario) => {
    const request: ChatRequest = {
      conversationId: `benchmark-${scenario.id}`,
      messages: [{ role: "user", content: scenario.userMessage }],
      attachments: scenario.hasImage
        ? [{ id: "image-1", name: "sample.png", mimeType: "image/png", size: 10, dataUrl: "data:image/png;base64,AAAA" }]
        : [],
      engineState: { recentExposurePhraseIds: scenario.recentExposurePhraseIds ?? [], mockScenario: scenario.mockScenario },
    };
    const result = await runEoeEngine({ request, gateway: gateway(), config: { enabled: true, fixedLevel: scenario.fixedLevel ?? 2, developerMode: false }, naturalnessMode: "benchmark" });
    const text = segmentsToPlainText(result.response.segments);
    const chunks = result.response.segments.filter((segment) => segment.type === "english_chunk");
    expect(result.diagnostics.analysis.primaryFunction).toBe(scenario.expectedFunction);
    expect(result.diagnostics.finalValidation.valid).toBe(!result.diagnostics.naturalFallbackUsed);
    expect(text.length).toBeGreaterThan(8);
    expect(text).toMatch(/[\u3400-\u9fff]/u);
    expect(text).not.toMatch(/今天我们来学习|翻译成英文是|意思是|发音是/u);
    expect(text).not.toMatch(/\bis[。！？]/iu);
    expect(text).not.toMatch(/(?:^|\s)[A-Za-z’' -]+[：:][\u3400-\u9fff]/u);
    expect(chunks.length).toBeLessThanOrEqual(result.diagnostics.decision.maxEnglishSegments);
    for (const chunk of chunks) {
      expect(chunk.phraseId).toBe(result.diagnostics.selection.selectedPhraseId);
    }
    if (result.response.noFit) expect(chunks).toHaveLength(0);
    if (scenario.mockScenario === "double_failure") {
      expect(result.diagnostics.naturalFallbackUsed).toBe(true);
      expect(text).toContain("没有通过质量检查");
    }
  });
});
