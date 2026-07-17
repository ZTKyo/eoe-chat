import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import { MockProvider } from "@/lib/providers/mock-provider";
import { ProviderGateway } from "@/lib/providers/gateway";
import type { Provider } from "@/lib/providers/types";
import { runEoeEngine } from "./engine";
import { resolveConversationContext } from "./conversation-context";
import { findUnsupportedQuantitativeClaims } from "./quantitative-claim";
import { analyzeResponseDepth, reviewResponseDepth } from "./response-depth";
import {
  analyzeComparisonDecisionRequirements,
  reviewComparisonDecisionRequirements,
} from "./comparison-requirements";
import { getPhraseById, PHRASE_REGISTRY } from "./registry/phrase-registry";
import {
  LIVE_SAFE_PHRASES,
  getPhraseRealizationProfile,
} from "./registry/phrase-realization";
import { detectUserPhraseReuse } from "./user-phrase-reuse";
import { validateProviderResponseTemplate } from "./provider-template/validator";
import { reviewTechnicalDistinction } from "./technical-segment-classification";

function gateway(provider?: Provider): ProviderGateway {
  const mock = new MockProvider();
  const selected = provider ?? mock;
  return new ProviderGateway({
    primary: selected,
    vision: mock,
    mock,
    forceMock: provider === undefined,
  });
}

function request(messages: ChatRequest["messages"]): ChatRequest {
  return {
    conversationId: "text-beta-rc",
    messages,
    attachments: [],
    engineState: { recentExposurePhraseIds: [], benchmarkType: "structural" },
  };
}

describe("Text Beta RC focused quality calibration", () => {
  it("removes a little from automatic Live-Safe while preserving user recognition", () => {
    expect(LIVE_SAFE_PHRASES.map((phrase) => phrase.id)).not.toContain("p-a-little");
    expect(getPhraseById("p-a-little")?.status).toBe("active");
    expect(detectUserPhraseReuse(
      "The progress is a little slow，我该怎么调整？",
      PHRASE_REGISTRY,
    )).toMatchObject({ phraseId: "p-a-little" });
  });

  it("allows a sentence-boundary frame and blocks a Chinese internal grammar slot", () => {
    const phrase = getPhraseById("p-for-now")!;
    const realizationProfile = getPhraseRealizationProfile(phrase.id)!;
    const context = { selectedPhrase: phrase, realizationProfile, effectiveLevel: 2 };
    expect(validateProviderResponseTemplate({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: true,
      responseTemplate: "信息还不完整。{{EOE_PHRASE}}，先验证关键假设。",
    }, context).result.valid).toBe(true);
    expect(validateProviderResponseTemplate({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: true,
      responseTemplate: "这个方案{{EOE_PHRASE}}更稳妥。",
    }, context).result.violations.map((item) => item.code)).toContain(
      "beta_frame_chinese_internal_slot",
    );
  });

  it("blocks duplicated Chinese and English example markers", () => {
    const phrase = getPhraseById("p-for-example")!;
    const realizationProfile = getPhraseRealizationProfile(phrase.id)!;
    const result = validateProviderResponseTemplate({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: true,
      responseTemplate: "例如，{{EOE_PHRASE}}，可以先比较一次真实购买决定。",
    }, { selectedPhrase: phrase, realizationProfile, effectiveLevel: 2 });
    expect(result.result.violations.map((item) => item.code)).toContain(
      "beta_frame_duplicate_example_marker",
    );
  });

  it.each([
    "`any` 绕过类型检查并允许直接调用；`unknown` 要先用类型守卫收窄后才能使用，因此更安全，通常建议优先选 `unknown`。",
    "`unknown` 通常应优先使用，因为它更安全，访问前需要验证或断言；`any` 则会跳过类型检查并允许直接操作。",
    "建议默认选 `unknown`：先用 `typeof` 验证再访问会更安全。相比之下，`any` 可直接访问属性，因为它放弃了类型检查。",
    "`any` 允许直接调用并使类型检查失效。若改用 `unknown`，必须先收窄或断言；这样更安全，所以实际开发应优先使用 `unknown`。",
    "安全性更高的是 `unknown`，使用前要经过类型守卫；默认建议用它。`any` 的差别是绕过检查，可以直接读写属性。",
    "any 完全禁用了类型检查，允许对值进行任何操作。unknown 使用前必须收窄，并比 any 保留更多的类型安全性，因此建议优先使用 unknown。",
  ])("accepts semantic TypeScript coverage in any valid order", (text) => {
    expect(reviewTechnicalDistinction(text, ["TypeScript", "unknown", "any"])).toEqual([]);
  });

  it.each(["好", "哦"])("keeps context for the short acknowledgement %s", async (acknowledgement) => {
    const result = await runEoeEngine({
      request: request([
        { role: "user", content: "我准备先整理家庭预算，下一步列出固定支出。" },
        { role: "assistant", content: "可以先按月整理固定支出。" },
        { role: "user", content: acknowledgement },
      ]),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const text = result.response.segments.map((segment) => segment.content).join("");
    expect(result.diagnostics.contextualAcknowledgement?.active).toBe(true);
    expect(result.diagnostics.decision.mode).toBe("skip");
    expect(result.diagnostics.attempts).toHaveLength(0);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.response.segments.some((segment) => segment.type === "english_chunk")).toBe(false);
    expect(text).toContain("家庭预算");
    expect(text).not.toMatch(/你好|有什么可以帮/u);
  });

  it("recognizes a conditional time-versus-rent trade-off without fixed wording", () => {
    const requirements = analyzeComparisonDecisionRequirements(
      "一个方案租金更高，但每天能省一小时通勤，我该怎么权衡？",
    );
    expect(reviewComparisonDecisionRequirements(
      "如果省下的一小时能用于高价值工作，那么租金差额值得考虑。",
      requirements,
    )).toEqual([]);
  });

  it("keeps an ordinary greeting unchanged when history is empty", async () => {
    const result = await runEoeEngine({
      request: request([{ role: "user", content: "你好" }]),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: false },
    });
    expect(result.response.segments.map((segment) => segment.content).join("")).toContain("你好");
    expect(result.diagnostics.contextualAcknowledgement?.active).toBe(false);
  });

  it("reduces Overlay for difficulty, continues the topic, and resumes after user English", async () => {
    const difficult = request([
      { role: "user", content: "我想继续完善下周学习计划。" },
      {
        role: "assistant",
        content: "For now，先确定每天的时间。",
        segments: [
          { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: true, assistanceAvailable: true },
          { type: "text", content: "，先确定每天的时间。", language: "zh" },
        ],
      },
      { role: "user", content: "英语有点难" },
    ]);
    const difficultResult = await runEoeEngine({
      request: difficult,
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const text = difficultResult.response.segments.map((segment) => segment.content).join("");
    expect(difficultResult.diagnostics.temporaryOverlayPreference).toMatchObject({
      mode: "reduced",
      reason: "user_difficulty",
    });
    expect(difficultResult.diagnostics.decision.mode).toBe("skip");
    expect(difficultResult.response.segments.some((segment) => segment.type === "english_chunk")).toBe(false);
    expect(text).toContain("学习计划");

    const resumed = resolveConversationContext(request([
      ...difficult.messages,
      { role: "assistant", content: text },
      { role: "user", content: "I think 现在可以继续，你怎么看？" },
    ]));
    expect(resumed.temporaryOverlayPreference).toMatchObject({
      mode: "normal",
      reason: "user_resume",
    });
  });

  it("detects unsupported percentages but allows user-provided and hypothetical numbers", () => {
    expect(findUnsupportedQuantitativeClaims({
      responseText: "原材料占 55%，人工占 25%。",
      sourceTexts: ["请分析成本因素。"],
    })).toEqual(["55%", "25%"]);
    expect(findUnsupportedQuantitativeClaims({
      responseText: "你提供的原材料占 55%，可以先核对口径。",
      sourceTexts: ["原材料占55%。"],
    })).toEqual([]);
    expect(findUnsupportedQuantitativeClaims({
      responseText: "例如，假设原材料占 55%，这里只用于演示计算。",
      sourceTexts: ["请举例。"],
    })).toEqual([]);
  });

  it("retries an unsupported quantitative claim and preserves the real task", async () => {
    const mock = new MockProvider();
    const quantitativeProvider: Provider = {
      id: "quantitative",
      modelId: "quantitative-v1",
      capabilities: mock.capabilities,
      async generate(input) {
        const responseTemplate = input.generationAttempt === 1
          ? "这个产品的成本中，原材料占 55%，人工占 25%。"
          : "这个产品的实际成本比例无法确定；应先核对原材料、人工、交付复杂度和长期维护数据。";
        return {
          content: JSON.stringify({
            schemaVersion: "eoe.provider-template.v1",
            usePhrase: false,
            responseTemplate,
            noFitReason: input.eoeContext?.allowedNoFitReasons?.[0] ?? "no_safe_candidate",
          }),
          providerId: this.id,
          modelId: this.modelId,
          requestId: input.requestId,
          latencyMs: 1,
        };
      },
    };
    const result = await runEoeEngine({
      request: request([{ role: "user", content: "请分析这个产品的成本主要受哪些因素影响。" }]),
      gateway: gateway(quantitativeProvider),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.attempts[0]?.validation.violations.map((item) => item.code)).toContain(
      "unsupported_quantitative_claim",
    );
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.response.segments.map((segment) => segment.content).join("")).toContain("无法确定");
  });

  it("checks detailed analysis by named-factor coverage, interactions, trade-off, and synthesis", () => {
    const profile = analyzeResponseDepth(
      "详细分析一个新产品从用户问题、竞争环境、交付成本到长期维护之间的关系。",
    );
    expect(profile).toMatchObject({
      level: "detailed",
      namedFactors: ["用户问题", "竞争环境", "交付成本", "长期维护"],
      minimumInteractionCount: 2,
    });
    const shallow = reviewResponseDepth("用户问题很重要，竞争环境也重要。", profile);
    expect(shallow.warnings).toEqual(expect.arrayContaining([
      "detailed_analysis_named_factors_incomplete",
      "detailed_analysis_interactions_insufficient",
    ]));
    const complete = reviewResponseDepth(
      "用户问题决定产品必须解决什么，也会影响竞争环境中的差异化。竞争压力会抬高交付成本，而过度压缩交付成本又会增加长期维护负担。短期上线速度和长期维护之间需要权衡。综合来看，应先验证核心问题，再控制交付边界并预留维护能力。",
      profile,
    );
    expect(complete.warnings).toEqual([]);
  });

  it("keeps pronunciation Assistance lightweight and topic-specific", async () => {
    const result = await runEoeEngine({
      request: request([
        { id: "u1", role: "user", content: "我们先怎么安排家庭预算？" },
        {
          id: "a1",
          role: "assistant",
          content: "For now，先整理固定支出。",
          segments: [
            { type: "english_chunk", content: "For now", phraseId: "p-for-now", isNew: true, assistanceAvailable: true },
            { type: "text", content: "，先整理固定支出。", language: "zh" },
          ],
        },
        { id: "u2", role: "user", content: "怎么读？" },
      ]),
      gateway: gateway(),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const text = result.response.segments.map((segment) => segment.content).join("");
    expect(text).toContain("/fɔːr naʊ/");
    expect(text).toContain("家庭预算");
    expect(text).not.toMatch(/例句|例如：|Let's wait for now/u);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });
});
