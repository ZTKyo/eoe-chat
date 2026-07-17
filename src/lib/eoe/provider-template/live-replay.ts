import type {
  GenerationPipeline,
  PipelineDiagnostic,
  PhraseRealizationProfile,
  ProviderPipelineStage,
  ValidationResult,
} from "@/domain/eoe";
import { EOE_POLICY_VERSION } from "../constants";
import { getPhraseById } from "../registry/phrase-registry";
import { reviewNaturalness } from "../soft-naturalness-validator";
import { validateStructuredResponse } from "../validator";
import { mapProviderTemplateToDomain } from "./mapper";
import { parseProviderResponseTemplate } from "./parser";
import { liveAttemptCaptureSchema, sha256Text, type LiveAttemptCapture } from "./live-capture";
import { validateProviderResponseTemplate } from "./validator";

export interface LiveAttemptReplayResult {
  rawHashMatches: boolean;
  outcome: "valid" | "invalid";
  pipelineStage: ProviderPipelineStage;
  pipeline: GenerationPipeline;
  violationCodes: string[];
  pipelineCodes: string[];
}

function emptyPipeline(): GenerationPipeline {
  return {
    templateParse: "not_reached",
    templateSemantics: "not_reached",
    templateValidator: "not_reached",
    mapper: "not_reached",
    domainSchema: "not_reached",
    domainValidator: "not_reached",
  };
}

function codes(diagnostics: PipelineDiagnostic[]): string[] {
  return diagnostics.map((item) => item.code);
}

function historicalProfile(fixture: LiveAttemptCapture): PhraseRealizationProfile | undefined {
  const phraseId = fixture.engineContext.selectedPhraseId;
  if (!phraseId) return undefined;
  const candidate = fixture.engineContext.selection.candidates.find((item) => item.phraseId === phraseId);
  const allowed = candidate?.allowedPositions.filter(
    (position): position is "sentence_start" | "sentence_middle" | "sentence_end" => position !== "standalone",
  ) ?? ["sentence_start", "sentence_middle"];
  return {
    phraseId,
    bilingualSafety: "high",
    grammaticalRole: "other",
    allowedPositions: allowed.length > 0 ? allowed : ["sentence_start", "sentence_middle"],
    forbiddenPatterns: [],
    forbiddenBeforePunctuation: [":", "：", "（", "("],
    forbiddenAfterPunctuation: [":", "："],
    requiresChineseConnectorBefore: false,
    requiresChineseConnectorAfter: false,
    canBeWholeClause: false,
    requiresClauseSupport: false,
    requiresFollowUpContent: false,
    canBeStandaloneReaction: false,
    canStartChineseSentence: true,
    canAppearAfterChineseSubject: true,
    canAppearBeforeChinesePredicate: true,
    preferredFunctions: [],
    excludedFunctions: [],
    labelLikeRisk: candidate?.labelLikeRisk ?? 0.2,
    translationRisk: candidate?.translationRisk ?? 0.2,
    taskReplacementRisk: 0,
    capitalizeAtSentenceStart: false,
    liveSafe: true,
    betaFrame: {
      phraseId,
      autoLiveSafe: true,
      allowedFrameTypes: ["user_phrase_reuse"],
      allowedFrames: [],
      forbiddenFrames: [],
      requiresFollowingClause: false,
      capitalizationPolicy: "Historical replay preserves captured capitalization.",
      punctuationPolicy: "Historical replay preserves captured boundaries.",
    },
    realizationVersion: "eoe.realization.v1-historical-replay",
  };
}

function invalid(
  pipelineStage: ProviderPipelineStage,
  pipeline: GenerationPipeline,
  violationCodes: string[],
  pipelineCodes = violationCodes,
  rawHashMatches = true,
): LiveAttemptReplayResult {
  return { rawHashMatches, outcome: "invalid", pipelineStage, pipeline, violationCodes, pipelineCodes };
}

export function replayLiveAttempt(rawFixture: unknown): LiveAttemptReplayResult {
  const fixture: LiveAttemptCapture = liveAttemptCaptureSchema.parse(rawFixture);
  const rawHashMatches = sha256Text(fixture.rawProviderText) === fixture.rawSha256;
  const pipeline = emptyPipeline();
  const parsed = parseProviderResponseTemplate(fixture.rawProviderText);
  if (!parsed.success) {
    pipeline.templateParse = "failed";
    return invalid(
      parsed.diagnostics.at(-1)?.stage ?? "provider_template_parse",
      pipeline,
      codes(parsed.diagnostics),
      codes(parsed.diagnostics),
      rawHashMatches,
    );
  }

  pipeline.templateParse = "passed";
  const selectedPhrase = fixture.engineContext.selectedPhraseId
    ? getPhraseById(fixture.engineContext.selectedPhraseId)
    : undefined;
  const realizationProfile = selectedPhrase ? historicalProfile(fixture) : undefined;
  const templateValidation = validateProviderResponseTemplate(parsed.template, {
    selectedPhrase,
    realizationProfile,
    effectiveLevel: fixture.engineContext.decision.effectiveLevel,
    historicalReplay: true,
  });
  pipeline.templateSemantics = templateValidation.result.valid ? "passed" : "failed";
  pipeline.templateValidator = templateValidation.result.valid ? "passed" : "failed";
  if (!templateValidation.result.valid) {
    const violationCodes = templateValidation.result.violations.map((item) => item.code);
    return invalid("template_validator", pipeline, violationCodes, violationCodes, rawHashMatches);
  }

  const mapping = mapProviderTemplateToDomain(parsed.template, {
    analysis: fixture.engineContext.analysis,
    policyVersion: EOE_POLICY_VERSION,
    selectedPhraseId: fixture.engineContext.selectedPhraseId,
    selectedPhrase: selectedPhrase?.canonical,
    selectedPhraseIsNew: fixture.engineContext.selectedPhraseIsNew,
  });
  if (!mapping.success) {
    const domainSchemaFailure = mapping.diagnostics.some((item) => item.stage === "domain_schema");
    pipeline.mapper = domainSchemaFailure ? "passed" : "failed";
    pipeline.domainSchema = domainSchemaFailure ? "failed" : "not_reached";
    return invalid(
      mapping.diagnostics.at(-1)?.stage ?? "template_mapper",
      pipeline,
      codes(mapping.diagnostics),
      codes(mapping.diagnostics),
      rawHashMatches,
    );
  }

  pipeline.mapper = "passed";
  pipeline.domainSchema = "passed";
  const context = {
    analysis: fixture.engineContext.analysis,
    decision: fixture.engineContext.decision,
    selection: fixture.engineContext.selection,
    historicalReplay: true,
  };
  const hardValidation = validateStructuredResponse(mapping.response, context);
  pipeline.domainValidator = hardValidation.result.valid ? "passed" : "failed";
  if (!hardValidation.result.valid || !hardValidation.response) {
    const hardCodes = hardValidation.result.violations.map((item) => item.code);
    return invalid(
      "domain_validator",
      pipeline,
      ["domain_validator_failed", ...hardCodes],
      ["domain_validator_failed", ...hardCodes],
      rawHashMatches,
    );
  }

  const naturalness = reviewNaturalness({
    response: hardValidation.response,
    context,
    attemptNumber: fixture.attemptNumber as 1 | 2,
    mode: "live",
  });
  if (naturalness && naturalness.suggestedAction !== "accept") {
    return invalid(
      "naturalness_validator",
      pipeline,
      ["soft_naturalness_rejected"],
      ["soft_naturalness_rejected"],
      rawHashMatches,
    );
  }

  return {
    rawHashMatches,
    outcome: "valid",
    pipelineStage: "naturalness_validator",
    pipeline,
    violationCodes: [],
    pipelineCodes: [],
  };
}

export function sameCodeMultiset(left: string[], right: string[]): boolean {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

export function validationCodes(result: ValidationResult): string[] {
  return result.violations.map((item) => item.code);
}
