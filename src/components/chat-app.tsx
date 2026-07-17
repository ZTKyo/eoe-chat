"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Plus } from "lucide-react";
import {
  chatResponseSchema,
  plainTextSegment,
  segmentsToPlainText,
  type ChatResponse,
  type ChatRequest,
  type Conversation,
  type MessageAttachment,
  type StoredMessage,
} from "@/domain/chat";
import type { EngineDiagnostics } from "@/domain/eoe";
import { createRepositories } from "@/lib/db/repositories";
import { createPersistenceRecords } from "@/lib/eoe/persistence-events";
import { PHRASE_REGISTRY } from "@/lib/eoe/registry/phrase-registry";
import {
  IMAGE_FEATURE_DEFERRED_MESSAGE,
  isImageInputEnabled,
} from "@/lib/features/image-input";
import { toWireAttachment } from "@/lib/files";
import { createId, makeConversationTitle } from "@/lib/ids";
import { Composer } from "./chat/composer";
import { MessageList } from "./chat/message-list";
import { Sidebar } from "./chat/sidebar";
import { DeveloperPanel } from "./developer-panel";

type Repositories = ReturnType<typeof createRepositories>;

let bootstrapPromise: Promise<Conversation[]> | undefined;

async function bootstrap(repositories: Repositories): Promise<Conversation[]> {
  bootstrapPromise ??= (async () => {
    await repositories.engine.syncRegistry(PHRASE_REGISTRY);
    const current = await repositories.conversations.list();
    if (current.length > 0) return current;
    const created = await repositories.conversations.create();
    return [created];
  })();
  return bootstrapPromise;
}

function createMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  status: StoredMessage["status"],
  attachments: MessageAttachment[] = [],
): StoredMessage {
  const now = Date.now();
  const segments = [plainTextSegment(content)];
  return {
    id: createId("message"),
    conversationId,
    role,
    segments,
    attachments,
    plainText: segmentsToPlainText(segments),
    status,
    policyVersion: "eoe.product.v1",
    schemaVersion: "eoe.data.v1",
    createdAt: now,
    updatedAt: now,
  };
}

function apiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return `请求失败（${status}）`;
}

export function ChatApp({ imageFeatureConfigured = false }: { imageFeatureConfigured?: boolean }) {
  const [repositories] = useState<Repositories>(() => createRepositories());

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const messagesRef = useRef<StoredMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [composerError, setComposerError] = useState<string>();
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [developerLevel, setDeveloperLevel] = useState<number>();
  const [lastDiagnostics, setLastDiagnostics] = useState<EngineDiagnostics>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const imageInputEnabled = isImageInputEnabled({
    configured: imageFeatureConfigured,
    developerMode,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const enabled = params.get("eoe-dev") === "1" || process.env.NEXT_PUBLIC_EOE_DEVELOPER_MODE === "true";
      const requestedLevel = Number(params.get("eoe-level"));
      setDeveloperMode(enabled);
      if (enabled && Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 7) {
        setDeveloperLevel(requestedLevel);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    void bootstrap(repositories).then((items) => {
      if (!alive) return;
      setConversations(items);
      setActiveId((current) => current ?? items[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [repositories]);

  useEffect(() => {
    activeIdRef.current = activeId;
    if (!activeId) return;
    let alive = true;
    void repositories.messages.listByConversation(activeId).then((items) => {
      if (!alive) return;
      messagesRef.current = items;
      setMessages(items);
      setReady(true);
      void repositories.engine.latestDiagnostics(activeId).then((diagnostics) => {
        if (alive) setLastDiagnostics(diagnostics);
      });
    });
    return () => {
      alive = false;
    };
  }, [activeId, repositories]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  async function refreshConversations(): Promise<void> {
    setConversations(await repositories.conversations.list());
  }

  function stopCurrentRequest(): void {
    abortControllerRef.current?.abort();
  }

  async function createConversation(): Promise<void> {
    stopCurrentRequest();
    const conversation = await repositories.conversations.create();
    await refreshConversations();
    setReady(false);
    setActiveId(conversation.id);
    setMobileSidebar(false);
    setDraft("");
    setAttachment(null);
    setComposerError(undefined);
  }

  function selectConversation(id: string): void {
    if (id === activeId) {
      setMobileSidebar(false);
      return;
    }
    stopCurrentRequest();
    setPendingMessageId(null);
    setReady(false);
    setActiveId(id);
    setMobileSidebar(false);
    setComposerError(undefined);
  }

  async function renameConversation(conversation: Conversation): Promise<void> {
    const nextTitle = window.prompt("重命名会话", conversation.title)?.trim();
    if (!nextTitle || nextTitle === conversation.title) return;
    await repositories.conversations.rename(conversation.id, nextTitle);
    await refreshConversations();
  }

  async function deleteConversation(conversation: Conversation): Promise<void> {
    if (!window.confirm(`删除“${conversation.title}”及其中的本地消息？`)) return;
    if (conversation.id === activeId) stopCurrentRequest();
    await repositories.conversations.delete(conversation.id);
    let remaining = await repositories.conversations.list();
    if (remaining.length === 0) {
      remaining = [await repositories.conversations.create()];
    }
    setConversations(remaining);
    if (conversation.id === activeId) {
      setReady(false);
      setActiveId(remaining[0].id);
    }
  }

  async function runAssistantRequest(
    conversationId: string,
    assistantMessage: StoredMessage,
    contextMessages: StoredMessage[],
    requestAttachments: MessageAttachment[],
    assistanceRequest?: NonNullable<NonNullable<ChatRequest["engineState"]>["assistanceRequest"]>,
  ): Promise<void> {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setPendingMessageId(assistantMessage.id);

    const pendingUpdate: Partial<StoredMessage> = {
      status: "pending",
      segments: [plainTextSegment("正在思考")],
      plainText: "正在思考",
      errorMessage: undefined,
    };
    await repositories.messages.update(assistantMessage.id, pendingUpdate);
    if (activeIdRef.current === conversationId) {
      setMessages((current) =>
        current.map((message) => (message.id === assistantMessage.id ? { ...message, ...pendingUpdate } : message)),
      );
    }

    try {
      if (requestAttachments.length > 0 && !imageInputEnabled) {
        throw new Error(IMAGE_FEATURE_DEFERRED_MESSAGE);
      }
      const wireAttachments = await Promise.all(requestAttachments.map(toWireAttachment));
      const recentExposurePhraseIds = await repositories.engine.recentExposurePhraseIds(conversationId);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          messages: contextMessages
            .filter((message) => message.status === "complete")
            .slice(-24)
            .map((message) => ({
              id: message.id,
              role: message.role,
              content: message.plainText,
              segments: message.segments,
            })),
          attachments: wireAttachments,
          engineState: {
            recentExposurePhraseIds,
            developerMode,
            fixedLevelOverride: developerLevel,
            assistanceRequest,
          },
        }),
        signal: controller.signal,
      });

      const body: unknown = await response.json();
      if (!response.ok) throw new Error(apiErrorMessage(body, response.status));
      const parsed: ChatResponse = chatResponseSchema.parse(body);
      const completed: Partial<StoredMessage> = {
        segments: parsed.response.segments,
        plainText: segmentsToPlainText(parsed.response.segments),
        status: "complete",
        providerId: parsed.provider.providerId,
        modelId: parsed.provider.modelId,
        generationAttemptId: parsed.response.generationAttemptId,
        policyVersion: parsed.response.policyVersion,
        errorMessage: undefined,
        engineDiagnostics: parsed.engine,
      };
      const { exposures, attempts, diagnostics, obligations, completeness, assistanceOutcome, providerObservation } = createPersistenceRecords({
        conversationId,
        messageId: assistantMessage.id,
        response: parsed,
      });
      await repositories.engine.recordAssistantResult({
        messageId: assistantMessage.id,
        messageChanges: completed,
        exposures,
        attempts,
        diagnostics,
        obligations,
        completeness,
        assistanceOutcome,
        providerObservation,
      });
      setLastDiagnostics(parsed.engine);
      if (parsed.engine.developerMode) setDeveloperMode(true);
      if (activeIdRef.current === conversationId) {
        const nextMessages = messagesRef.current.map((message) =>
          message.id === assistantMessage.id ? { ...message, ...completed } : message,
        );
        // Keep the request-history snapshot atomic with the rendered state. An
        // English chunk can be clicked as soon as it appears, before a passive
        // state-to-ref effect has run.
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
      }
    } catch (error) {
      const cancelled = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
      const failed: Partial<StoredMessage> = {
        status: cancelled ? "cancelled" : "error",
        segments: [plainTextSegment(cancelled ? "回复已取消" : "这次没有成功回复")],
        plainText: cancelled ? "回复已取消" : "这次没有成功回复",
        errorMessage: cancelled ? "回复已取消" : error instanceof Error ? error.message : "回复失败，请重试。",
      };
      await repositories.messages.update(assistantMessage.id, failed);
      if (activeIdRef.current === conversationId) {
        const nextMessages = messagesRef.current.map((message) =>
          message.id === assistantMessage.id ? { ...message, ...failed } : message,
        );
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      setPendingMessageId((current) => (current === assistantMessage.id ? null : current));
      await refreshConversations();
    }
  }

  async function sendMessage(): Promise<void> {
    const conversationId = activeId;
    const text = draft.trim() || (attachment ? "请看看这张图片。" : "");
    if (!conversationId || !text || pendingMessageId) return;

    setComposerError(undefined);
    const currentConversation = conversations.find((item) => item.id === conversationId);
    const userMessage = createMessage(conversationId, "user", text, "complete", attachment ? [attachment] : []);
    const assistantMessage = createMessage(conversationId, "assistant", "正在思考", "pending");
    if (assistantMessage.createdAt <= userMessage.createdAt) {
      assistantMessage.createdAt = userMessage.createdAt + 1;
      assistantMessage.updatedAt = assistantMessage.createdAt;
    }
    const nextMessages = [...messagesRef.current, userMessage, assistantMessage];

    await repositories.messages.add(userMessage);
    await repositories.messages.add(assistantMessage);
    await repositories.conversations.touch(conversationId, userMessage.createdAt);
    if (currentConversation?.title === "新对话" && messagesRef.current.length === 0) {
      await repositories.conversations.rename(conversationId, makeConversationTitle(draft.trim() || "图片讨论"));
    }

    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setDraft("");
    setAttachment(null);
    await refreshConversations();
    await runAssistantRequest(
      conversationId,
      assistantMessage,
      [...nextMessages.filter((message) => message.id !== assistantMessage.id)],
      userMessage.attachments,
    );
  }

  async function retryMessage(messageId: string): Promise<void> {
    if (!activeId || pendingMessageId) return;
    const index = messagesRef.current.findIndex((message) => message.id === messageId);
    if (index < 1) return;
    const assistant = messagesRef.current[index];
    const previousUser = [...messagesRef.current.slice(0, index)].reverse().find((message) => message.role === "user");
    if (!previousUser) return;
    await runAssistantRequest(activeId, assistant, messagesRef.current.slice(0, index), previousUser.attachments);
  }

  async function requestAssistance(
    messageId: string,
    phraseId: string,
    segmentIndex: number,
    trigger: "click" | "long_press",
  ): Promise<void> {
    if (!activeId || pendingMessageId) return;
    const conversationId = activeId;
    // IndexedDB is the committed source of truth for assistance context. The
    // visible chunk may be clicked before React's in-memory history snapshot
    // has observed the completed assistant transaction.
    const persistedMessages = await repositories.messages.listByConversation(conversationId);
    const sourceMessage = persistedMessages.find((message) => message.id === messageId);
    if (!sourceMessage || sourceMessage.role !== "assistant") return;
    await repositories.engine.addAssistanceRequest({
      id: createId("assistance"),
      phraseId,
      conversationId,
      messageId,
      timestamp: Date.now(),
      kind: trigger === "click" ? "phrase_click" : "phrase_long_press",
      sourceMessageId: messageId,
      segmentIndex,
    });

    const userMessage = createMessage(
      conversationId,
      "user",
      "请简短解释刚才的英文短语，然后继续原来的话题。",
      "complete",
    );
    const assistantMessage = createMessage(conversationId, "assistant", "正在思考", "pending");
    assistantMessage.createdAt = Math.max(assistantMessage.createdAt, userMessage.createdAt + 1);
    assistantMessage.updatedAt = assistantMessage.createdAt;
    const nextMessages = [...persistedMessages, userMessage, assistantMessage];
    await repositories.messages.add(userMessage);
    await repositories.messages.add(assistantMessage);
    await repositories.conversations.touch(conversationId, userMessage.createdAt);
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    await runAssistantRequest(
      conversationId,
      assistantMessage,
      nextMessages.filter((message) => message.id !== assistantMessage.id),
      [],
      { trigger, sourceMessageId: messageId, segmentIndex, phraseId },
    );
  }

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);

  return (
    <main className="flex h-[100dvh] w-full overflow-hidden bg-[var(--background)]">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        mobileOpen={mobileSidebar}
        onCloseMobile={() => setMobileSidebar(false)}
        onCreate={() => void createConversation()}
        onSelect={selectConversation}
        onRename={(conversation) => void renameConversation(conversation)}
        onDelete={(conversation) => void deleteConversation(conversation)}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--line)] bg-white/75 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="打开会话列表"
              className="grid size-9 place-items-center rounded-xl text-[#566166] hover:bg-[var(--surface-soft)] md:hidden"
              onClick={() => setMobileSidebar(true)}
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight">{activeConversation?.title ?? "EOE Chat"}</h2>
              <div className="text-[10px] text-[#949c9f]">自然对话优先</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="新对话"
            data-testid="mobile-new-conversation"
            onClick={() => void createConversation()}
            className="grid size-9 place-items-center rounded-xl text-[#566166] hover:bg-[var(--surface-soft)] md:hidden"
          >
            <Plus size={18} />
          </button>
        </header>

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
          <MessageList
            messages={messages}
            ready={ready}
            imageInputEnabled={imageInputEnabled}
            onRetry={(messageId) => void retryMessage(messageId)}
            onSuggestion={(suggestion) => setDraft(suggestion)}
            onAssistance={(messageId, phraseId, segmentIndex, trigger) =>
              void requestAssistance(messageId, phraseId, segmentIndex, trigger)
            }
          />
        </div>

        <Composer
          draft={draft}
          attachment={attachment}
          imageInputEnabled={imageInputEnabled}
          pending={Boolean(pendingMessageId)}
          error={composerError}
          onDraftChange={setDraft}
          onAttachmentChange={setAttachment}
          onError={setComposerError}
          onSend={() => void sendMessage()}
          onCancel={stopCurrentRequest}
        />
        {developerMode ? <DeveloperPanel diagnostics={lastDiagnostics} /> : null}
      </section>
    </main>
  );
}
