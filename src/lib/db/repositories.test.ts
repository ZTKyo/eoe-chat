import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { plainTextSegment, type StoredMessage } from "@/domain/chat";
import type { ChatRequest } from "@/domain/chat";
import { runEoeEngine } from "@/lib/eoe/engine";
import { createPersistenceRecords } from "@/lib/eoe/persistence-events";
import { ProviderGateway } from "@/lib/providers/gateway";
import { MockProvider } from "@/lib/providers/mock-provider";
import { EoeDatabase } from "./database";
import { createRepositories } from "./repositories";

const openedNames: string[] = [];

afterEach(async () => {
  await Promise.all(openedNames.splice(0).map((name) => Dexie.delete(name)));
});

describe("IndexedDB repositories", () => {
  it("persists conversations and semantic messages", async () => {
    const name = `eoe-test-${crypto.randomUUID()}`;
    openedNames.push(name);
    const db = new EoeDatabase(name);
    const repositories = createRepositories(db);
    const conversation = await repositories.conversations.create("测试会话");
    const now = Date.now();
    const message: StoredMessage = {
      id: "message-1",
      conversationId: conversation.id,
      role: "user",
      segments: [plainTextSegment("你好")],
      attachments: [],
      plainText: "你好",
      status: "complete",
      policyVersion: "eoe.product.v1",
      schemaVersion: "eoe.data.v1",
      createdAt: now,
      updatedAt: now,
    };
    await repositories.messages.add(message);
    expect(await repositories.messages.listByConversation(conversation.id)).toEqual([message]);
    db.close();
  });

  it("keeps user then assistant order when legacy timestamps are equal", async () => {
    const name = `eoe-order-${crypto.randomUUID()}`;
    openedNames.push(name);
    const db = new EoeDatabase(name);
    const repositories = createRepositories(db);
    const conversation = await repositories.conversations.create("顺序");
    const shared = Date.now();
    const makeMessage = (id: string, role: "user" | "assistant"): StoredMessage => ({
      id,
      conversationId: conversation.id,
      role,
      segments: [plainTextSegment(role)],
      attachments: [],
      plainText: role,
      status: "complete",
      policyVersion: "eoe.product.v1",
      schemaVersion: "eoe.data.v1",
      createdAt: shared,
      updatedAt: shared,
    });
    await repositories.messages.add(makeMessage("assistant-same-time", "assistant"));
    await repositories.messages.add(makeMessage("user-same-time", "user"));
    expect((await repositories.messages.listByConversation(conversation.id)).map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    db.close();
  });

  it("migrates legacy v1 records to the current store schema", async () => {
    const name = `eoe-migration-${crypto.randomUUID()}`;
    openedNames.push(name);
    const legacy = new Dexie(name);
    legacy.version(1).stores({ conversations: "id, updatedAt", messages: "id, conversationId, createdAt" });
    await legacy.open();
    await legacy.table("conversations").add({ id: "legacy-conversation", title: "旧会话", createdAt: 1, updatedAt: 1 });
    await legacy.table("messages").add({
      id: "legacy-message",
      conversationId: "legacy-conversation",
      role: "user",
      segments: [plainTextSegment("旧消息")],
      plainText: "旧消息",
      createdAt: 1,
    });
    legacy.close();

    const current = new EoeDatabase(name);
    await current.open();
    const migrated = await current.messages.get("legacy-message");
    expect(migrated?.schemaVersion).toBe("eoe.data.v1");
    expect(migrated?.policyVersion).toBe("eoe.product.v1");
    expect(migrated?.attachments).toEqual([]);
    expect((await current.conversations.get("legacy-conversation"))?.activePolicyVersion).toBe("eoe.product.v1");
    current.close();
  });

  it("atomically persists M2 attempts, final exposure, diagnostics, and assistance", async () => {
    const name = `eoe-engine-${crypto.randomUUID()}`;
    openedNames.push(name);
    const db = new EoeDatabase(name);
    const repositories = createRepositories(db);
    const conversation = await repositories.conversations.create("M2");
    const now = Date.now();
    const assistant: StoredMessage = {
      id: "assistant-1",
      conversationId: conversation.id,
      role: "assistant",
      segments: [plainTextSegment("正在思考")],
      attachments: [],
      plainText: "正在思考",
      status: "pending",
      policyVersion: "eoe.product.v1",
      schemaVersion: "eoe.data.v1",
      createdAt: now,
      updatedAt: now,
    };
    await repositories.messages.add(assistant);
    const mock = new MockProvider();
    const gateway = new ProviderGateway({ primary: mock, vision: mock, mock, forceMock: true });
    const request: ChatRequest = {
      conversationId: conversation.id,
      messages: [{ role: "user", content: "下一步该怎么做？" }],
      attachments: [],
      engineState: { recentExposurePhraseIds: [], mockScenario: "valid_english_chunk" },
    };
    const result = await runEoeEngine({ request, gateway, config: { enabled: true, fixedLevel: 2, developerMode: true } });
    const response = { response: result.response, provider: result.provider, engine: result.diagnostics };
    const records = createPersistenceRecords({ conversationId: conversation.id, messageId: assistant.id, response, timestamp: now });
    await repositories.engine.recordAssistantResult({
      messageId: assistant.id,
      messageChanges: { segments: result.response.segments, plainText: result.response.segments.map((segment) => segment.content).join(""), status: "complete", engineDiagnostics: result.diagnostics },
      ...records,
    });
    await repositories.engine.addAssistanceRequest({ id: "assist-1", phraseId: result.response.usedPhraseIds[0]!, conversationId: conversation.id, messageId: assistant.id, timestamp: now + 1, kind: "phrase_click" });
    expect(await repositories.engine.recentExposurePhraseIds(conversation.id)).toEqual(result.response.usedPhraseIds);
    const persistedDiagnostics = await repositories.engine.latestDiagnostics(conversation.id);
    expect(persistedDiagnostics?.attempts).toHaveLength(1);
    expect(persistedDiagnostics?.attempts[0]?.pipeline).toMatchObject({
      templateParse: "passed",
      templateSemantics: "passed",
      templateValidator: "passed",
      mapper: "passed",
      domainSchema: "passed",
      domainValidator: "passed",
    });
    expect((await repositories.messages.get(assistant.id))?.segments).toEqual(result.response.segments);
    expect(await db.generationAttempts.count()).toBe(1);
    expect(await db.responseObligations.count()).toBeGreaterThan(0);
    expect(await db.taskCompletenessReviews.count()).toBe(1);
    expect((await db.generationAttempts.toArray())[0]?.pipelineStage).toBe("naturalness_validator");
    expect(await db.assistanceRequests.count()).toBe(1);
    db.close();
  });

  it("persists a valid Vision Observation without changing the IndexedDB v4 schema", async () => {
    const name = `eoe-vision-${crypto.randomUUID()}`;
    openedNames.push(name);
    const db = new EoeDatabase(name);
    const repositories = createRepositories(db);
    const conversation = await repositories.conversations.create("Vision");
    const now = Date.now();
    const assistant: StoredMessage = {
      id: "assistant-vision",
      conversationId: conversation.id,
      role: "assistant",
      segments: [plainTextSegment("正在分析")],
      attachments: [],
      plainText: "正在分析",
      status: "pending",
      policyVersion: "eoe.product.v1",
      schemaVersion: "eoe.data.v1",
      createdAt: now,
      updatedAt: now,
    };
    await repositories.messages.add(assistant);
    const mock = new MockProvider();
    const gateway = new ProviderGateway({ primary: mock, vision: mock, mock, forceMock: true });
    const request: ChatRequest = {
      conversationId: conversation.id,
      messages: [{ role: "user", content: "请分析图片中的形状。" }],
      attachments: [{ id: "image-1", name: "geometry-fixture.png", mimeType: "image/png", size: 12, dataUrl: "data:image/png;base64,iVBORw0KGgo=" }],
      engineState: { recentExposurePhraseIds: [] },
    };
    const result = await runEoeEngine({ request, gateway, config: { enabled: true, fixedLevel: 2, developerMode: true } });
    const response = { response: result.response, provider: result.provider, engine: result.diagnostics };
    const records = createPersistenceRecords({ conversationId: conversation.id, messageId: assistant.id, response, timestamp: now });
    expect(records.providerObservation).toMatchObject({ valid: true, schemaVersion: "eoe.vision-observation.v1" });
    await repositories.engine.recordAssistantResult({
      messageId: assistant.id,
      messageChanges: { segments: result.response.segments, plainText: result.response.segments.map((segment) => segment.content).join(""), status: "complete", engineDiagnostics: result.diagnostics },
      ...records,
    });
    expect(db.verno).toBe(4);
    const stored = await db.providerObservations.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.envelope?.observations.length).toBeGreaterThan(0);
    expect(await db.exposureEvents.count()).toBe(0);
    db.close();
  });
});
