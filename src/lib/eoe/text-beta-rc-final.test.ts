import { describe, expect, it, vi } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import { ProviderGateway } from "@/lib/providers/gateway";
import { MockProvider } from "@/lib/providers/mock-provider";
import type { Provider } from "@/lib/providers/types";
import { runEoeEngine } from "./engine";
import {
  extractExplicitUserPremises,
  reviewPremisePreservation,
} from "./explicit-user-premise";
import { reviewExecutionAccounting } from "./execution-accounting";
import {
  analyzeTechnicalConceptComparisonRequirements,
  reviewTechnicalConceptComparison,
} from "./technical-comparison";

function request(messages: ChatRequest["messages"]): ChatRequest {
  return {
    conversationId: "text-beta-rc-final",
    messages,
    attachments: [],
    engineState: {
      recentExposurePhraseIds: [],
      developerMode: true,
      benchmarkType: "structural",
    },
  };
}

function gateway(provider: Provider): ProviderGateway {
  const mock = new MockProvider();
  return new ProviderGateway({
    primary: provider,
    vision: mock,
    mock,
    forceMock: false,
  });
}

function scriptedProvider(
  realize: (input: Parameters<Provider["generate"]>[0]) => string,
): Provider {
  const mock = new MockProvider();
  return {
    id: "scripted",
    modelId: "scripted-v1",
    capabilities: mock.capabilities,
    async generate(input) {
      return {
        content: JSON.stringify({
          schemaVersion: "eoe.provider-template.v1",
          usePhrase: false,
          responseTemplate: realize(input),
          noFitReason: input.eoeContext?.allowedNoFitReasons?.[0] ?? "phrase_not_natural",
        }),
        providerId: this.id,
        modelId: this.modelId,
        requestId: input.requestId,
        latencyMs: 1,
      };
    },
  };
}

const tradeoffMessage = "一个方案租金更高，但每天能省一小时通勤，我该怎么权衡？";

describe("Text Beta RC final three-blocker closure", () => {
  it("extracts cost and daily time premises without treating the question as a fact", () => {
    const premises = extractExplicitUserPremises(tradeoffMessage);
    expect(premises).toHaveLength(2);
    expect(premises).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "cost", sourceText: "一个方案租金更高", mustPreserve: true }),
      expect.objectContaining({
        kind: "time",
        sourceText: "每天能省一小时通勤",
        normalizedValue: "per-day:1小时",
        mustPreserve: true,
      }),
    ]));
  });

  it("extracts numeric, condition, constraint, and deadline premises", () => {
    const premises = extractExplicitUserPremises(
      "预算只有5000元，已经使用旧方案，只能选择一个，下周需要完成。",
    );
    expect(premises.map((item) => item.kind)).toEqual([
      "cost",
      "condition",
      "constraint",
      "time",
    ]);
    expect(premises[0]).toMatchObject({ normalizedValue: "5000元" });
  });

  it("does not treat requested analysis subjects as user-supplied premises", () => {
    expect(
      extractExplicitUserPremises(
        "请详细分析一个新产品从用户问题、竞争环境、交付成本到长期维护之间的关系，并指出最容易被忽略的约束。",
      ),
    ).toEqual([]);
  });

  it("preserves numeric and time premises with equivalent Arabic or Chinese numbers", () => {
    const premises = extractExplicitUserPremises("预算只有5000元，每天能省一小时通勤。");
    const review = reviewPremisePreservation({
      responseText: "预算仍按5000元控制，这个方案每天能节省1小时通勤。",
      premises,
    });
    expect(review).toMatchObject({ valid: true });
    expect(review.preservedPremiseIds).toHaveLength(2);
  });

  it("detects premise omission, contradiction, and replacement separately", () => {
    const premises = extractExplicitUserPremises(tradeoffMessage);
    expect(reviewPremisePreservation({
      responseText: "可以先比较工作和生活灵活性。",
      premises,
    }).omittedPremiseIds).toHaveLength(2);
    expect(reviewPremisePreservation({
      responseText: "这个方案租金更低，但每天仍能省一小时通勤。",
      premises,
    }).contradictedPremiseIds).toHaveLength(1);
    expect(reviewPremisePreservation({
      responseText: "高租金方案每月能省22小时，假设时薪50元就更划算。",
      premises,
    }).replacedPremiseIds).toHaveLength(1);
  });

  it("rejects extra exact durations even when the original time premise is repeated", () => {
    const premises = extractExplicitUserPremises(tradeoffMessage);
    const review = reviewPremisePreservation({
      responseText:
        "这个方案租金更高，也确实每天省一小时通勤；按每周5小时、每月22小时计算即可。",
      premises,
    });
    expect(review.preservedPremiseIds).toContain("premise-cost-1");
    expect(review.replacedPremiseIds).toContain("premise-time-2");
    expect(review.valid).toBe(false);
  });

  it("retries a replacement assumption and keeps the original user premises", async () => {
    const provider = scriptedProvider((input) => {
      expect(input.messages[0]?.content).toContain("EXPLICIT USER PREMISES");
      return input.generationAttempt === 1
        ? "高租金方案每月能省22小时，假设时薪50元就更划算。"
        : "这个方案的租金更高，但每天能节省一小时通勤。核心权衡是用更高租金换取这一小时的通勤节省；可以结合租金差额、通勤压力、工作生活灵活性和预算承受能力来判断，再记录一周的真实感受。";
    });
    const result = await runEoeEngine({
      request: request([{ role: "user", content: tradeoffMessage }]),
      gateway: gateway(provider),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.attempts[0]?.validation.violations.map((item) => item.code)).toContain(
      "premise_replaced",
    );
    expect(result.diagnostics.premisePreservationReview).toMatchObject({ valid: true });
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.response.segments.map((segment) => segment.content).join("")).toContain(
      "每天能节省一小时通勤",
    );
  });

  const requirements = analyzeTechnicalConceptComparisonRequirements(
    "解释 TypeScript 里 unknown 和 any 的区别",
    ["TypeScript", "unknown", "any"],
  )!;

  it("builds a general Technical Concept Comparison contract", () => {
    expect(requirements).toEqual({
      concepts: ["unknown", "any"],
      needsCoreDifference: true,
      needsSafetyDifference: true,
      needsUsagePrecondition: true,
      needsPracticalRecommendation: true,
      needsExample: false,
    });
  });

  it.each([
    "`any` 会关闭有效类型检查并允许直接操作；`unknown` 不能直接使用，要先进行类型收窄。`unknown` 通常比 `any` 更安全。外部数据类型不确定时优先用 `unknown`，只在明确接受失去类型安全时才考虑 `any`。",
    "类型不确定的外部数据建议优先用 `unknown`，因为它更安全；使用前通过 `typeof` 检查。`any` 会绕过类型检查，仅在临时迁移且接受失去类型安全时使用。",
    "`unknown` 使用前必须经过 type guard，再访问会保留类型安全，所以比 `any` 更安全。`any` 允许直接调用并禁用检查；默认选择 `unknown`，只在原型阶段临时考虑 `any`。",
    "只有明确接受失去类型安全时才使用 `any`，它会跳过检查。通常建议 `unknown`：先做 assertion 才能使用，并且它比 `any` 更安全。",
    "`any` 可以任意操作，因为类型检查被禁用。相比之下，`unknown` 不可直接使用，必须先验证再使用，安全性更高。类型不确定时优先选 `unknown`，`any` 只用于不得已的兼容。",
  ])("accepts valid technical comparison wording without fixed order or distance", (text) => {
    expect(reviewTechnicalConceptComparison({ text, requirements })).toEqual({
      hardIssues: [],
      softWarnings: [],
    });
  });

  it("keeps a Hard-valid technical answer even when Soft guidance is incomplete", async () => {
    const provider = scriptedProvider((input) => {
      expect(input.messages[0]?.content).toContain("MANDATORY TECHNICAL CONCEPT COMPARISON");
      return "`any` 会关闭类型检查并允许直接使用；`unknown` 不能直接使用，使用前要先验证类型。因为两者的检查行为不同，所以风险也不同。";
    });
    const result = await runEoeEngine({
      request: request([{ role: "user", content: "解释 TypeScript 里 unknown 和 any 的区别" }]),
      gateway: gateway(provider),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.finalValidation.valid).toBe(true);
    expect(result.diagnostics.softQualityReview?.warnings).toEqual(expect.arrayContaining([
      "technical_unknown_safety_missing",
      "technical_usage_advice_missing",
    ]));
    expect(result.diagnostics.displayedWithSoftQualityWarning).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("accepts a complete TypeScript comparison with no Soft warning", async () => {
    const provider = scriptedProvider(() =>
      "`any` 会让 TypeScript 基本停止对该值的有效类型检查并允许直接操作。`unknown` 不能直接使用，使用前需要通过 `typeof` 类型守卫来收窄或进行明确断言，因此 `unknown` 通常比 `any` 更安全。处理类型不确定的外部数据时应优先用 `unknown`；只有明确接受失去类型安全时才考虑 `any`，因为这样能把风险边界说清楚。",
    );
    const result = await runEoeEngine({
      request: request([{ role: "user", content: "解释 TypeScript 里 unknown 和 any 的区别" }]),
      gateway: gateway(provider),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(1);
    expect(result.diagnostics.softQualityReview?.warnings).toEqual([]);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("accepts the first live TypeScript wording without redundant generic warnings", async () => {
    const provider = scriptedProvider(() =>
      "在TypeScript中，`any`表示完全放弃类型检查，允许任意操作，而`unknown`则代表类型不确定但必须经过收窄才能使用。`unknown`保留了类型安全，强制你验证数据结构，防止运行时错误；除非明确接受关闭检查，否则应优先使用`unknown`，仅将`any`作为临时妥协。",
    );
    const result = await runEoeEngine({
      request: request([{ role: "user", content: "解释 TypeScript 里 unknown 和 any 的区别" }]),
      gateway: gateway(provider),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(result.diagnostics.attempts).toHaveLength(1);
    expect(result.diagnostics.softQualityReview?.warnings).toEqual([]);
    expect(result.diagnostics.taskCompleteness.complete).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it.each(["好", "哦"])("uses zero Provider requests for Engine-owned acknowledgement %s", async (ack) => {
    const generate = vi.fn<Provider["generate"]>();
    const mock = new MockProvider();
    const provider: Provider = {
      id: "must-not-run",
      modelId: "must-not-run-v1",
      capabilities: mock.capabilities,
      generate,
    };
    const result = await runEoeEngine({
      request: request([
        { role: "user", content: "我想先比较两个通勤方案的时间和成本。" },
        { role: "assistant", content: "可以先记录一周的实际通勤时间和费用。" },
        { role: "user", content: ack },
      ]),
      gateway: gateway(provider),
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    expect(generate).not.toHaveBeenCalled();
    expect(result.diagnostics.responseExecutionSource).toBe("engine_owned_acknowledgement");
    expect(result.diagnostics.attempts).toHaveLength(0);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.response.segments.map((segment) => segment.content).join("")).toContain("通勤");
    expect(result.response.segments.some((segment) => segment.type === "english_chunk")).toBe(false);
  });

  it("validates attempt accounting by execution source", () => {
    expect(reviewExecutionAccounting({
      source: "provider_generated",
      attemptCount: 1,
      providerRequestCount: 1,
    }).valid).toBe(true);
    expect(reviewExecutionAccounting({
      source: "engine_owned_acknowledgement",
      attemptCount: 0,
      providerRequestCount: 0,
    }).valid).toBe(true);
    expect(reviewExecutionAccounting({
      source: "engine_owned_resolution",
      attemptCount: 0,
      providerRequestCount: 0,
    }).valid).toBe(true);
    expect(reviewExecutionAccounting({
      source: "natural_fallback",
      attemptCount: 2,
      providerRequestCount: 2,
    })).toMatchObject({
      valid: false,
      violations: ["natural_fallback_not_standard_pass"],
    });
  });
});
