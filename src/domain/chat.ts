import { z } from "zod";
import {
  conversationFunctionSchema,
  engineDiagnosticsSchema,
  mockScenarioSchema,
} from "./eoe";

export { conversationFunctions, conversationFunctionSchema } from "./eoe";
export type { ConversationFunction } from "./eoe";

export const textSegmentSchema = z.object({
  type: z.literal("text"),
  content: z.string().refine((value) => value.trim().length > 0, "Text content cannot be blank"),
  language: z.enum(["zh", "other"]),
});

export const englishChunkSegmentSchema = z.object({
  type: z.literal("english_chunk"),
  content: z.string().trim().min(1),
  phraseId: z.string().trim().min(1),
  isNew: z.boolean(),
  assistanceAvailable: z.boolean(),
});

export const assistancePhraseSegmentSchema = z.object({
  type: z.literal("assistance_phrase"),
  content: z.string().trim().min(1),
  phraseId: z.string().trim().min(1),
  pronunciation: z.string().trim().min(1),
});

export const messageSegmentSchema = z.discriminatedUnion("type", [
  textSegmentSchema,
  englishChunkSegmentSchema,
  assistancePhraseSegmentSchema,
]);

export type MessageSegment = z.infer<typeof messageSegmentSchema>;

export const generatedResponseSchema = z
  .object({
    schemaVersion: z.literal("eoe.response.v2"),
    policyVersion: z.string().min(1),
    conversationFunction: conversationFunctionSchema,
    segments: z.array(messageSegmentSchema).min(1),
    usedPhraseIds: z.array(z.string().min(1)),
    noFit: z.boolean(),
    generationAttemptId: z.string().min(1).optional(),
    warnings: z.array(z.string()).optional(),
    naturalnessConfidence: z.number().min(0).max(1).optional(),
    intentPreserved: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const ids = [
      ...new Set(
        value.segments
          .filter((segment) => segment.type === "english_chunk")
          .map((segment) => segment.phraseId),
      ),
    ];

    if (ids.join("\u0000") !== value.usedPhraseIds.join("\u0000")) {
      context.addIssue({
        code: "custom",
        path: ["usedPhraseIds"],
        message: "usedPhraseIds must match english_chunk segments in first-use order",
      });
    }

    if (value.noFit && ids.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["noFit"],
        message: "noFit responses cannot contain English chunks",
      });
    }
  });

export type GeneratedResponse = z.infer<typeof generatedResponseSchema>;

export type MessageRole = "user" | "assistant";
export type MessageStatus = "pending" | "complete" | "error" | "cancelled";

export interface MessageAttachment {
  id: string;
  kind: "image";
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  width?: number;
  height?: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
  archivedAt?: number;
  activePolicyVersion: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  segments: MessageSegment[];
  attachments: MessageAttachment[];
  plainText: string;
  status: MessageStatus;
  providerId?: string;
  modelId?: string;
  generationAttemptId?: string;
  policyVersion: string;
  schemaVersion: "eoe.data.v1";
  errorMessage?: string;
  engineDiagnostics?: import("./eoe").EngineDiagnostics;
  createdAt: number;
  updatedAt: number;
}

export const wireAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size: z.number().int().positive().max(5 * 1024 * 1024),
  dataUrl: z.string().startsWith("data:image/").max(8_000_000),
});

export type WireAttachment = z.infer<typeof wireAttachmentSchema>;

export const chatRequestSchema = z.object({
  conversationId: z.string().min(1),
  messages: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(40_000),
        segments: z.array(messageSegmentSchema).optional(),
      }),
    )
    .min(1)
    .max(80),
  attachments: z.array(wireAttachmentSchema).max(1).default([]),
  engineState: z
    .object({
      recentExposurePhraseIds: z.array(z.string().min(1)).max(24).default([]),
      developerMode: z.boolean().optional(),
      fixedLevelOverride: z.number().int().min(1).max(7).optional(),
      mockScenario: mockScenarioSchema.optional(),
      benchmarkType: z.enum(["production", "structural", "live_evidence"]).optional(),
      assistanceRequest: z.object({
        trigger: z.enum(["click", "long_press", "meaning", "pronunciation", "clarification"]),
        sourceMessageId: z.string().min(1).optional(),
        segmentIndex: z.number().int().nonnegative().optional(),
        phraseId: z.string().min(1).optional(),
      }).optional(),
    })
    .optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export const providerMetaSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  fallbackUsed: z.boolean(),
  requestId: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  usage: z
    .object({
      promptTokens: z.number().nonnegative().optional(),
      completionTokens: z.number().nonnegative().optional(),
      totalTokens: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const chatResponseSchema = z.object({
  response: generatedResponseSchema,
  provider: providerMetaSchema,
  engine: engineDiagnosticsSchema,
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export function segmentsToPlainText(segments: MessageSegment[]): string {
  return segments.map((segment) => segment.content).join("");
}

export function plainTextSegment(content: string): MessageSegment {
  return {
    type: "text",
    content,
    language: /[\u3400-\u9fff]/u.test(content) ? "zh" : "other",
  };
}
