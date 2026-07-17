import Dexie from "dexie";
import type { Conversation, StoredMessage } from "@/domain/chat";
import type { EngineDiagnostics, Phrase } from "@/domain/eoe";
import type {
  AssistanceOutcome,
  AssistanceRequest,
  ExposureEvent,
  GenerationAttempt,
  ResponseObligationRecord,
  StoredEngineDiagnostics,
  TaskCompletenessReviewRecord,
  ProviderObservation,
} from "@/domain/persistence";
import { createId } from "@/lib/ids";
import { type EoeDatabase, getDatabase } from "./database";

export interface ConversationRepository {
  list(): Promise<Conversation[]>;
  get(id: string): Promise<Conversation | undefined>;
  create(title?: string): Promise<Conversation>;
  rename(id: string, title: string): Promise<void>;
  touch(id: string, timestamp: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MessageRepository {
  listByConversation(conversationId: string): Promise<StoredMessage[]>;
  get(id: string): Promise<StoredMessage | undefined>;
  add(message: StoredMessage): Promise<void>;
  update(id: string, changes: Partial<StoredMessage>): Promise<void>;
}

export interface EngineRepository {
  syncRegistry(phrases: Phrase[]): Promise<void>;
  recentExposurePhraseIds(conversationId: string, limit?: number): Promise<string[]>;
  recordAssistantResult(input: {
    messageId: string;
    messageChanges: Partial<StoredMessage>;
    exposures: ExposureEvent[];
    attempts: GenerationAttempt[];
    diagnostics: StoredEngineDiagnostics;
    obligations: ResponseObligationRecord[];
    completeness: TaskCompletenessReviewRecord;
    assistanceOutcome?: AssistanceOutcome;
    providerObservation?: ProviderObservation;
  }): Promise<void>;
  addAssistanceRequest(request: AssistanceRequest): Promise<void>;
  latestDiagnostics(conversationId: string): Promise<EngineDiagnostics | undefined>;
}

export class IndexedDbConversationRepository implements ConversationRepository {
  constructor(private readonly db: EoeDatabase = getDatabase()) {}

  async list(): Promise<Conversation[]> {
    return this.db.conversations.orderBy("updatedAt").reverse().toArray();
  }

  async get(id: string): Promise<Conversation | undefined> {
    return this.db.conversations.get(id);
  }

  async create(title = "新对话"): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id: createId("conversation"),
      title,
      createdAt: now,
      updatedAt: now,
      activePolicyVersion: "eoe.product.v1",
    };
    await this.db.conversations.add(conversation);
    return conversation;
  }

  async rename(id: string, title: string): Promise<void> {
    await this.db.conversations.update(id, { title: title.trim() || "新对话", updatedAt: Date.now() });
  }

  async touch(id: string, timestamp: number): Promise<void> {
    await this.db.conversations.update(id, { updatedAt: timestamp, lastMessageAt: timestamp });
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction(
      "rw",
      [
        this.db.conversations,
        this.db.messages,
        this.db.exposureEvents,
        this.db.generationAttempts,
        this.db.assistanceRequests,
        this.db.engineDiagnostics,
        this.db.responseObligations,
        this.db.taskCompletenessReviews,
        this.db.assistanceOutcomes,
      ],
      async () => {
        await this.db.messages.where("conversationId").equals(id).delete();
        await this.db.exposureEvents.where("conversationId").equals(id).delete();
        await this.db.generationAttempts.where("conversationId").equals(id).delete();
        await this.db.assistanceRequests.where("conversationId").equals(id).delete();
        await this.db.engineDiagnostics.where("conversationId").equals(id).delete();
        await this.db.responseObligations.where("conversationId").equals(id).delete();
        await this.db.taskCompletenessReviews.where("conversationId").equals(id).delete();
        await this.db.assistanceOutcomes.where("conversationId").equals(id).delete();
        await this.db.conversations.delete(id);
      },
    );
  }
}

export class IndexedDbEngineRepository implements EngineRepository {
  constructor(private readonly db: EoeDatabase = getDatabase()) {}

  async syncRegistry(phrases: Phrase[]): Promise<void> {
    await this.db.transaction("rw", this.db.phrases, async () => {
      await this.db.phrases.bulkPut(phrases);
      const activeIds = new Set(phrases.map((phrase) => phrase.id));
      await this.db.phrases.toCollection().modify((phrase) => {
        if (!activeIds.has(phrase.id)) phrase.status = "disabled";
      });
    });
  }

  async recentExposurePhraseIds(conversationId: string, limit = 24): Promise<string[]> {
    const events = await this.db.exposureEvents.where("conversationId").equals(conversationId).sortBy("timestamp");
    return events.slice(-limit).reverse().map((event) => event.phraseId);
  }

  async recordAssistantResult(input: {
    messageId: string;
    messageChanges: Partial<StoredMessage>;
    exposures: ExposureEvent[];
    attempts: GenerationAttempt[];
    diagnostics: StoredEngineDiagnostics;
    obligations: ResponseObligationRecord[];
    completeness: TaskCompletenessReviewRecord;
    assistanceOutcome?: AssistanceOutcome;
    providerObservation?: ProviderObservation;
  }): Promise<void> {
    await this.db.transaction(
      "rw",
      [
        this.db.messages,
        this.db.exposureEvents,
        this.db.generationAttempts,
        this.db.engineDiagnostics,
        this.db.responseObligations,
        this.db.taskCompletenessReviews,
        this.db.assistanceOutcomes,
        this.db.providerObservations,
      ],
      async () => {
        await this.db.messages.update(input.messageId, { ...input.messageChanges, updatedAt: Date.now() });
        if (input.exposures.length > 0) await this.db.exposureEvents.bulkAdd(input.exposures);
        if (input.attempts.length > 0) await this.db.generationAttempts.bulkPut(input.attempts);
        await this.db.engineDiagnostics.put(input.diagnostics);
        if (input.obligations.length > 0) await this.db.responseObligations.bulkPut(input.obligations);
        await this.db.taskCompletenessReviews.put(input.completeness);
        if (input.assistanceOutcome) await this.db.assistanceOutcomes.put(input.assistanceOutcome);
        if (input.providerObservation) await this.db.providerObservations.put(input.providerObservation);
      },
    );
  }

  async addAssistanceRequest(request: AssistanceRequest): Promise<void> {
    await this.db.assistanceRequests.add(request);
  }

  async latestDiagnostics(conversationId: string): Promise<EngineDiagnostics | undefined> {
    const rows = await this.db.engineDiagnostics.where("conversationId").equals(conversationId).sortBy("timestamp");
    return rows.at(-1)?.diagnostics;
  }
}

export class IndexedDbMessageRepository implements MessageRepository {
  constructor(private readonly db: EoeDatabase = getDatabase()) {}

  async listByConversation(conversationId: string): Promise<StoredMessage[]> {
    const messages = await this.db.messages
      .where("[conversationId+createdAt]")
      .between([conversationId, DexieMinKey], [conversationId, DexieMaxKey])
      .toArray();
    return messages.sort(
      (left, right) =>
        left.createdAt - right.createdAt ||
        (left.role === right.role ? left.id.localeCompare(right.id) : left.role === "user" ? -1 : 1),
    );
  }

  async get(id: string): Promise<StoredMessage | undefined> {
    return this.db.messages.get(id);
  }

  async add(message: StoredMessage): Promise<void> {
    await this.db.messages.add(message);
  }

  async update(id: string, changes: Partial<StoredMessage>): Promise<void> {
    await this.db.messages.update(id, { ...changes, updatedAt: Date.now() });
  }
}

const DexieMinKey = -Infinity;
const DexieMaxKey = Dexie.maxKey;

export function createRepositories(db = getDatabase()): {
  conversations: ConversationRepository;
  messages: MessageRepository;
  engine: EngineRepository;
} {
  return {
    conversations: new IndexedDbConversationRepository(db),
    messages: new IndexedDbMessageRepository(db),
    engine: new IndexedDbEngineRepository(db),
  };
}
