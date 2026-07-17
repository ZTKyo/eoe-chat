import Dexie, { type EntityTable, type Transaction } from "dexie";
import type { Conversation, StoredMessage } from "@/domain/chat";
import type { Phrase } from "@/domain/eoe";
import type {
  AssistanceRequest,
  AssistanceOutcome,
  ComprehensionEvidence,
  EnginePolicy,
  ExposureEvent,
  GenerationAttempt,
  ProgressionState,
  ProviderObservation,
  StoredEngineDiagnostics,
  ResponseObligationRecord,
  TaskCompletenessReviewRecord,
} from "@/domain/persistence";

interface MetaRecord {
  key: string;
  value: unknown;
}

const v1Stores = {
  conversations: "id, updatedAt, lastMessageAt",
  messages: "id, conversationId, createdAt",
};

const v2Stores = {
  conversations: "id, updatedAt, lastMessageAt, archivedAt",
  messages: "id, conversationId, [conversationId+createdAt], generationAttemptId",
  phrases: "id, level, catalogueVersion, *conversationFunctions",
  exposureEvents: "id, phraseId, messageId, createdAt",
  comprehensionEvidence: "id, phraseId, createdAt, strength",
  progressionStates: "id, policyVersion",
  generationAttempts: "id, messageId, providerId, startedAt",
  enginePolicies: "version, effectiveAt",
  providerObservations: "id, providerId, createdAt, errorCategory",
  meta: "key",
};

const v3Stores = {
  ...v2Stores,
  phrases: "id, level, registryVersion, status, *conversationFunctions",
  exposureEvents: "id, phraseId, messageId, conversationId, timestamp",
  generationAttempts: "id, messageId, conversationId, timestamp, providerId",
  assistanceRequests: "id, phraseId, conversationId, messageId, timestamp",
  engineDiagnostics: "id, conversationId, messageId, timestamp",
};

const v4Stores = {
  ...v3Stores,
  responseObligations: "recordId, conversationId, messageId, [messageId+id], kind, timestamp",
  taskCompletenessReviews: "id, conversationId, messageId, timestamp, complete",
  assistanceOutcomes: "id, conversationId, messageId, sourceMessageId, phraseId, timestamp",
};

async function upgradeV1ToV2(transaction: Transaction): Promise<void> {
  const now = Date.now();
  await transaction
    .table<Conversation>("conversations")
    .toCollection()
    .modify((conversation) => {
      conversation.activePolicyVersion ||= "eoe.product.v1";
    });
  await transaction
    .table<StoredMessage>("messages")
    .toCollection()
    .modify((message) => {
      message.schemaVersion ||= "eoe.data.v1";
      message.policyVersion ||= "eoe.product.v1";
      message.updatedAt ||= message.createdAt || now;
      message.attachments ||= [];
      message.segments ||= [];
      message.status ||= "complete";
    });
  await transaction.table<MetaRecord>("meta").put({ key: "schemaVersion", value: "eoe.data.v1" });
}

async function upgradeV2ToV3(transaction: Transaction): Promise<void> {
  await transaction
    .table<ExposureEvent & { createdAt?: number }>("exposureEvents")
    .toCollection()
    .modify((event) => {
      event.timestamp ||= event.createdAt ?? Date.now();
    });
  await transaction.table<MetaRecord>("meta").put({ key: "schemaVersion", value: "eoe.data.v2" });
}

async function upgradeV3ToV4(transaction: Transaction): Promise<void> {
  await transaction.table<MetaRecord>("meta").put({ key: "schemaVersion", value: "eoe.data.v3" });
}

export class EoeDatabase extends Dexie {
  conversations!: EntityTable<Conversation, "id">;
  messages!: EntityTable<StoredMessage, "id">;
  phrases!: EntityTable<Phrase, "id">;
  exposureEvents!: EntityTable<ExposureEvent, "id">;
  comprehensionEvidence!: EntityTable<ComprehensionEvidence, "id">;
  progressionStates!: EntityTable<ProgressionState, "id">;
  generationAttempts!: EntityTable<GenerationAttempt, "id">;
  enginePolicies!: EntityTable<EnginePolicy, "version">;
  providerObservations!: EntityTable<ProviderObservation, "id">;
  assistanceRequests!: EntityTable<AssistanceRequest, "id">;
  assistanceOutcomes!: EntityTable<AssistanceOutcome, "id">;
  responseObligations!: EntityTable<ResponseObligationRecord, "recordId">;
  taskCompletenessReviews!: EntityTable<TaskCompletenessReviewRecord, "id">;
  engineDiagnostics!: EntityTable<StoredEngineDiagnostics, "id">;
  meta!: EntityTable<MetaRecord, "key">;

  constructor(name = "eoe") {
    super(name);
    this.version(1).stores(v1Stores);
    this.version(2).stores(v2Stores).upgrade(upgradeV1ToV2);
    this.version(3).stores(v3Stores).upgrade(upgradeV2ToV3);
    this.version(4).stores(v4Stores).upgrade(upgradeV3ToV4);
  }
}

let singleton: EoeDatabase | undefined;

export function getDatabase(): EoeDatabase {
  if (!singleton) singleton = new EoeDatabase();
  return singleton;
}

export async function closeDatabase(): Promise<void> {
  singleton?.close();
  singleton = undefined;
}
