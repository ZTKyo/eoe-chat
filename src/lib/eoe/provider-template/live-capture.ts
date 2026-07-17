import { createHash } from "node:crypto";
import { z } from "zod";
import {
  candidateSelectionSchema,
  conversationAnalysisSchema,
  generationPipelineSchema,
  overlayDecisionSchema,
  providerPipelineStageSchema,
} from "@/domain/eoe";

export const LIVE_CAPTURE_FIXTURE_VERSION = "m2.3-live-capture.v1" as const;

const usageSchema = z.strictObject({
  promptTokens: z.number().nonnegative().optional(),
  completionTokens: z.number().nonnegative().optional(),
  totalTokens: z.number().nonnegative().optional(),
});

export const liveAttemptCaptureSchema = z.strictObject({
  fixtureVersion: z.literal(LIVE_CAPTURE_FIXTURE_VERSION),
  runId: z.string().min(1),
  caseId: z.string().min(1),
  caseKind: z.enum(["capability_probe", "fallback_probe", "corpus"]),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  attemptNumber: z.number().int().min(1).max(2),
  rawProviderText: z.string(),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  engineContext: z.strictObject({
    analysis: conversationAnalysisSchema,
    decision: overlayDecisionSchema,
    selection: candidateSelectionSchema,
    selectedPhraseId: z.string().min(1).optional(),
    selectedPhraseIsNew: z.boolean(),
  }),
  observed: z.strictObject({
    outcome: z.enum(["valid", "invalid", "provider_error"]),
    pipelineStage: providerPipelineStageSchema.optional(),
    pipeline: generationPipelineSchema,
    violationCodes: z.array(z.string()),
    pipelineCodes: z.array(z.string()),
    latencyMs: z.number().nonnegative(),
    usage: usageSchema.optional(),
    providerFallbackUsed: z.boolean(),
    naturalFallbackUsed: z.boolean(),
  }),
});

export type LiveAttemptCapture = z.infer<typeof liveAttemptCaptureSchema>;

export function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function assertSafeSyntheticCapture(capture: LiveAttemptCapture): void {
  const serialized = JSON.stringify(capture);
  const forbidden = [
    /authorization\s*:/iu,
    /bearer\s+[a-z0-9._-]{8,}/iu,
    /api[_-]?key\s*[:=]/iu,
    /<EOE_TEMPLATE_STATE>/u,
    /data:image\//u,
  ];
  if (forbidden.some((pattern) => pattern.test(serialized))) {
    throw new Error(`unsafe live capture rejected for ${capture.caseId} attempt ${capture.attemptNumber}`);
  }
}
