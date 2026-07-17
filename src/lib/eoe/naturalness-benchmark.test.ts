import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

function code(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

describe("M2.4 Structural Realization Benchmark", () => {
  it("runs 40+ scenarios and writes a structural-only evidence report", async () => {
    expect(GOLDEN_CONVERSATION_CORPUS.length).toBeGreaterThanOrEqual(40);
    const sections: string[] = [];
    let integrated = 0;
    let noFit = 0;
    let naturalFallback = 0;

    for (const [index, scenario] of GOLDEN_CONVERSATION_CORPUS.entries()) {
      const request: ChatRequest = {
        conversationId: `naturalness-${scenario.id}`,
        messages: [{ role: "user", content: scenario.userMessage }],
        attachments: scenario.hasImage
          ? [{ id: "image-1", name: "benchmark.png", mimeType: "image/png", size: 10, dataUrl: "data:image/png;base64,AAAA" }]
          : [],
        engineState: {
          recentExposurePhraseIds: scenario.recentExposurePhraseIds ?? [],
          mockScenario: scenario.mockScenario,
          benchmarkType: "structural",
        },
      };
      const result = await runEoeEngine({
        request,
        gateway: gateway(),
        config: { enabled: true, fixedLevel: scenario.fixedLevel ?? 2, developerMode: false },
        naturalnessMode: "benchmark",
      });
      const plainText = segmentsToPlainText(result.response.segments);
      const chunks = result.response.segments.filter((segment) => segment.type === "english_chunk");
      const labels = result.response.segments.some((segment, segmentIndex) =>
        segment.type === "english_chunk" && /^\s*[:：]/u.test(result.response.segments[segmentIndex + 1]?.content ?? ""),
      );
      const translations = /(?:意思是|也就是|中文是|翻译成英文是)/u.test(plainText);
      const phraseRepeated = new Set(chunks.map((chunk) => chunk.phraseId)).size < chunks.length;
      const violationCodes = result.diagnostics.attempts.flatMap((attempt) => attempt.validation.violations.map((item) => item.code));
      const flags = [
        labels ? "标签式插入" : undefined,
        translations ? "翻译式插入" : undefined,
        phraseRepeated ? "Phrase 重复" : undefined,
        violationCodes.includes("punctuation_boundary_error") ? "不合理标点" : undefined,
        violationCodes.includes("unnatural_segment_boundary") ? "句法断裂" : undefined,
        chunks.length > result.diagnostics.decision.maxEnglishSegments ? "英语过多" : undefined,
        result.response.noFit ? "英语未出现；noFit 路径" : undefined,
        result.response.conversationFunction !== scenario.expectedFunction ? "Conversation Function 偏移" : undefined,
        chunks.length > 0 && result.diagnostics.finalValidation.valid ? "结构化 Phrase 路径通过（非自然度证据）" : undefined,
      ].filter(Boolean);

      if (chunks.length > 0) integrated += 1;
      if (result.response.noFit) noFit += 1;
      if (result.diagnostics.naturalFallbackUsed) naturalFallback += 1;

      expect(result.diagnostics.analysis.primaryFunction).toBe(scenario.expectedFunction);
      expect(result.diagnostics.finalValidation.valid).toBe(!result.diagnostics.naturalFallbackUsed);
      expect(result.response.conversationFunction).toBe(scenario.expectedFunction);
      expect(plainText).toMatch(/[\u3400-\u9fff]/u);
      expect(labels).toBe(false);
      expect(translations).toBe(false);
      expect(chunks.length).toBeLessThanOrEqual(result.diagnostics.decision.maxEnglishSegments);

      sections.push([
        `## ${index + 1}. ${scenario.category} — ${scenario.id}`,
        "",
        `- 用户输入：${scenario.userMessage}`,
        `- Level：${scenario.fixedLevel ?? 2}`,
        `- Provider：${result.provider.providerId} / ${result.provider.modelId}`,
        `- Selected Phrase：${result.diagnostics.selection.selectedPhraseId ?? "none"}`,
        `- Attempts：${result.diagnostics.attempts.length}`,
        `- noFit：${result.response.noFit}`,
        `- 检查标记：${flags.join("；") || "无自动结构风险标记"}`,
        "",
        "### 实际生成文本",
        "",
        `> ${plainText.replaceAll("\n", "  \n> ")}`,
        "",
        "### Conversation Analysis",
        "",
        code(result.diagnostics.analysis),
        "",
        "### Scheduler Decision",
        "",
        code(result.diagnostics.decision),
        "",
        "### Candidate Pool",
        "",
        code(result.diagnostics.selection),
        "",
        "### Structured Response",
        "",
        code(result.response),
        "",
        "### Plain Text Projection",
        "",
        code(plainText),
        "",
        "### Validator Result",
        "",
        code(result.diagnostics.finalValidation),
        "",
        "### Deterministic Structural Risk Review",
        "",
        code(result.diagnostics.naturalness ?? null),
        "",
        "### Attempts",
        "",
        code(result.diagnostics.attempts),
      ].join("\n"));
    }

    const report = [
      "# Structural Realization Benchmark",
      "",
      "> 这是 MockProvider 的确定性结构基线，只验证 Schema、Parser、Template、Mapper、Segments、noFit、Retry、Validator、Exposure、Assistance 与回归。文本不是产品回复质量或自然度证据，不能用于 Phrase 激活、Comprehension、Progression 或独立人工审核结论。",
      "",
      "## 汇总",
      "",
      `- 场景数：${GOLDEN_CONVERSATION_CORPUS.length}`,
      `- 包含 English Chunk：${integrated}`,
      `- noFit：${noFit}`,
      `- Natural Fallback：${naturalFallback}`,
      `- Provider：MockProvider（确定性）`,
      `- Adaptive Progression：关闭`,
      "",
      ...sections,
      "",
    ].join("\n");
    const directory = join(process.cwd(), "artifacts", "benchmarks");
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "m2.5.1-structural-realization-report.md"), report, "utf8");
  });
});
