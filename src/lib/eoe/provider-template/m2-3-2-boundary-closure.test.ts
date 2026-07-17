import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import type { CandidateSelection, ConversationAnalysis, OverlayDecision } from "@/domain/eoe";
import { ProviderGateway } from "@/lib/providers/gateway";
import type { Provider, ProviderRequest } from "@/lib/providers/types";
import { buildDirective } from "../directive-builder";
import { runEoeEngine } from "../engine";
import { getPhraseById } from "../registry/phrase-registry";
import { getPhraseRealizationProfile } from "../registry/phrase-realization";
import { validateStructuredResponse } from "../validator";
import { liveAttemptCaptureSchema } from "./live-capture";
import { mapProviderTemplateToDomain } from "./mapper";
import { replayLiveAttempt } from "./live-replay";
import { EOE_PHRASE_PLACEHOLDER, type ProviderResponseTemplateV1 } from "./schema";
import { validateProviderResponseTemplate } from "./validator";

const phrase = getPhraseById("p-in-the-long-run")!;
const realizationProfile = getPhraseRealizationProfile(phrase.id)!;
const analysis: ConversationAnalysis = {
  primaryFunction: "answer",
  sensitivity: "normal",
  responseLength: "long",
  overlaySuitability: "high",
  confidence: 0.78,
};
const decision: OverlayDecision = {
  mode: "preferred",
  fixedLevel: 3,
  effectiveLevel: 3,
  maxNewFocus: 1,
  maxEnglishSegments: 1,
  reusePreferred: true,
  candidateCount: 1,
  reasonCodes: ["ordinary_substantive_turn"],
  policyVersion: "eoe.scheduler.v1.1",
};
const candidate = {
  phraseId: phrase.id,
  score: 85.65,
  reasons: ["naturalness_eligible"],
  isReuse: false,
  grammaticalFit: "high" as const,
  insertionPosition: "sentence_middle" as const,
  allowedPositions: ["sentence_start", "sentence_middle"] as const,
  bilingualCompatibility: 0.9,
  punctuationRisk: 0.15,
  translationRisk: 0.2,
  labelLikeRisk: 0.2,
  responseLengthFit: "high" as const,
};
const selection: CandidateSelection = {
  candidates: [{ ...candidate, allowedPositions: [...candidate.allowedPositions] }],
  selectedPhraseId: phrase.id,
  noFit: false,
  selectorVersion: "eoe.selector.v1.2",
};
const validationContext = { selectedPhrase: phrase, realizationProfile, effectiveLevel: 3 };
const domainContext = { analysis, decision, selection };

function template(responseTemplate: string): ProviderResponseTemplateV1 {
  return {
    schemaVersion: "eoe.provider-template.v1",
    usePhrase: true,
    responseTemplate,
  };
}

function templateCodes(value: ProviderResponseTemplateV1): string[] {
  return validateProviderResponseTemplate(value, validationContext).result.violations.map((item) => item.code);
}

const invalidBoundary = template(`先比较当前成本，${EOE_PHRASE_PLACEHOLDER}还要评估维护影响。`);
const safeBoundary = template(`先比较当前成本。${EOE_PHRASE_PLACEHOLDER}，还要评估维护影响。`);
const providerNoFit: ProviderResponseTemplateV1 = {
  schemaVersion: "eoe.provider-template.v1",
  usePhrase: false,
  responseTemplate: "先比较当前成本、交付风险和后续维护影响，再决定是否继续投入。",
  noFitReason: "grammar_mismatch",
};

class SequenceProvider implements Provider {
  readonly id = "deepseek";
  readonly modelId = "deepseek-v4-flash";
  readonly capabilities = {
    text: true,
    vision: false,
    streaming: false,
    jsonMode: true,
    jsonSchema: true,
    toolCalling: false,
  };
  readonly directives: string[] = [];
  private index = 0;

  constructor(private readonly outputs: ProviderResponseTemplateV1[]) {}

  async generate(request: ProviderRequest) {
    this.directives.push(request.messages.find((message) => message.role === "system")?.content ?? "");
    const output = this.outputs[Math.min(this.index, this.outputs.length - 1)];
    this.index += 1;
    return {
      content: JSON.stringify(output),
      providerId: this.id,
      modelId: this.modelId,
      requestId: request.requestId,
      latencyMs: 1,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    };
  }
}

function engineRequest(): ChatRequest {
  return {
    conversationId: "boundary-regression",
    messages: [{
      role: "user",
      content: "请详细分析一个新产品从用户问题、竞争环境、交付成本到长期维护之间的关系，并指出最容易被忽略的约束。",
    }],
    attachments: [],
    engineState: { recentExposurePhraseIds: [] },
  };
}

async function runSequence(outputs: ProviderResponseTemplateV1[]) {
  const provider = new SequenceProvider(outputs);
  const gateway = new ProviderGateway({
    primary: provider,
    vision: provider,
    fallback: undefined,
    mock: provider,
    forceMock: false,
  });
  const result = await runEoeEngine({
    request: engineRequest(),
    gateway,
    config: { enabled: true, fixedLevel: 3, developerMode: true },
  });
  expect(result.diagnostics.selection.selectedPhraseId).toBe("p-in-the-long-run");
  return { provider, result };
}

describe("M2.3.2 generic Phrase boundary closure", () => {
  it("1 rejects an English Phrase directly joined to Chinese characters", () => {
    expect(templateCodes(invalidBoundary)).toContain("template_boundary_invalid");
  });

  it("2 accepts a Phrase with legal punctuation and a grammatical connection", () => {
    expect(validateProviderResponseTemplate(safeBoundary, validationContext).result.valid).toBe(true);
  });

  it("3 accepts every Text Beta Registry-defined safe bilingual frame for the Phrase", () => {
    expect(realizationProfile.betaFrame.allowedFrames).toHaveLength(2);
    for (const frame of realizationProfile.betaFrame.allowedFrames) {
      const value = template(frame);
      expect(validateProviderResponseTemplate(value, validationContext).result.valid).toBe(true);
    }
  });

  it("4 rejects a Phrase followed by its complete Chinese translation", () => {
    expect(templateCodes(template(`${EOE_PHRASE_PLACEHOLDER}（意思是“从长远来看”），还要继续评估。`)))
      .toContain("template_translation_duplication");
  });

  it("5 rejects a Phrase used as a colon label", () => {
    expect(templateCodes(template(`英文短语：${EOE_PHRASE_PLACEHOLDER}，再继续分析。`)))
      .toContain("template_label_like_overlay");
  });

  it("6 rejects an isolated Phrase", () => {
    expect(templateCodes(template(EOE_PHRASE_PLACEHOLDER))).toContain("template_isolated_placeholder");
  });

  it("7 retries an illegal boundary and accepts a regenerated safe boundary", async () => {
    const { provider, result } = await runSequence([invalidBoundary, safeBoundary]);
    expect(result.diagnostics.attempts.map((attempt) => attempt.outcome)).toEqual(["invalid", "valid"]);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(provider.directives[1]).toContain("preserve the punctuation or whitespace immediately adjacent");
  });

  it("8 retries an illegal boundary and accepts a Provider-authored noFit", async () => {
    const { result } = await runSequence([invalidBoundary, providerNoFit]);
    expect(result.diagnostics.attempts.map((attempt) => attempt.outcome)).toEqual(["invalid", "valid"]);
    expect(result.response.noFit).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("9 enters Natural Fallback after two illegal boundaries", async () => {
    const { result } = await runSequence([invalidBoundary, invalidBoundary]);
    expect(result.diagnostics.attempts.map((attempt) => attempt.outcome)).toEqual(["invalid", "invalid"]);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
  });

  it("10 never counts Natural Fallback as Structured Response success", async () => {
    const { result } = await runSequence([invalidBoundary, invalidBoundary]);
    expect(result.diagnostics.attempts.some((attempt) => attempt.outcome === "valid")).toBe(false);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
  });

  it("11 counts a valid Provider noFit as a Structured Response success", async () => {
    const { result } = await runSequence([providerNoFit]);
    expect(result.diagnostics.attempts.map((attempt) => attempt.outcome)).toEqual(["valid", "valid"]);
    expect(result.response.noFit).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
    expect(result.diagnostics.displayedWithSoftQualityWarning).toBe(true);
  });

  it("12 does not force a candidate into a disallowed current position", () => {
    const disallowedPositionSelection: CandidateSelection = {
      ...selection,
      candidates: [{ ...selection.candidates[0], insertionPosition: "sentence_end" }],
    };
    const directive = buildDirective({
      analysis,
      decision,
      selection: disallowedPositionSelection,
      candidates: [phrase],
      selectedPhrase: phrase,
      realizationProfile,
      recentExposurePhraseIds: [],
      attemptNumber: 1,
    });
    expect(directive).toContain('"allowedPositions":["sentence_start","sentence_middle"]');
    expect(directive).not.toContain('"allowedPositions":["sentence_end"]');
    expect(directive).toContain("Do not force an overlay");
  });

  it("13 keeps Mapper boundaries exact and adds no punctuation, whitespace, or connector", () => {
    const mapped = mapProviderTemplateToDomain(invalidBoundary, {
      analysis,
      policyVersion: decision.policyVersion,
      selectedPhraseId: phrase.id,
      selectedPhrase: phrase.canonical,
      selectedPhraseIsNew: true,
    });
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      expect(mapped.response.segments[0]).toMatchObject({ type: "text", content: "先比较当前成本，" });
      expect(mapped.response.segments[2]).toMatchObject({ type: "text", content: "还要评估维护影响。" });
    }
  });

  it("14 keeps the Domain Validator strict after mapping a joined boundary", () => {
    const mapped = mapProviderTemplateToDomain(invalidBoundary, {
      analysis,
      policyVersion: decision.policyVersion,
      selectedPhraseId: phrase.id,
      selectedPhrase: phrase.canonical,
      selectedPhraseIsNew: true,
    });
    expect(mapped.success).toBe(true);
    if (mapped.success) {
      const validated = validateStructuredResponse(mapped.response, domainContext);
      expect(validated.result.valid).toBe(false);
      expect(validated.result.violations.map((item) => item.code)).toContain("punctuation_boundary_error");
    }
  });

  const historicalFixtureDirectory = join(
    process.cwd(),
    "artifacts",
    "regressions",
    "m2.3-live-captures",
  );
  const historicalFixtureNames = [1, 2].map(
    (attempt) =>
      `m2-3-1-2026-07-16T22-59-28-579Z--corpus-long-analysis--attempt-${attempt}.json`,
  );

  it.skipIf(
    !historicalFixtureNames.every((name) => existsSync(join(historicalFixtureDirectory, name))),
  )("15 stably replays both historical long-analysis fixtures without rewriting evidence", () => {
    for (const attempt of [1, 2]) {
      const name = `m2-3-1-2026-07-16T22-59-28-579Z--corpus-long-analysis--attempt-${attempt}.json`;
      const fixture = liveAttemptCaptureSchema.parse(
        JSON.parse(readFileSync(join(historicalFixtureDirectory, name), "utf8")),
      );
      const replay = replayLiveAttempt(fixture);
      expect(replay.rawHashMatches).toBe(true);
      expect(replay.outcome).toBe("invalid");
      expect(replay.pipelineStage).toBe("template_validator");
      expect(replay.violationCodes).toContain("template_boundary_invalid");
    }
  });
});
