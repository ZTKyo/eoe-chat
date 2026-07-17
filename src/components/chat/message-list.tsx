"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ImageIcon, RefreshCw } from "lucide-react";
import type { MessageAttachment, MessageSegment, StoredMessage } from "@/domain/chat";

interface MessageListProps {
  messages: StoredMessage[];
  ready: boolean;
  imageInputEnabled?: boolean;
  onRetry: (messageId: string) => void;
  onSuggestion: (suggestion: string) => void;
  onAssistance: (
    messageId: string,
    phraseId: string,
    segmentIndex: number,
    trigger: "click" | "long_press",
  ) => void;
}

export function BlobImage({ attachment, className = "" }: { attachment: MessageAttachment; className?: string }) {
  const [url] = useState<string | undefined>(() => {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return undefined;
    return URL.createObjectURL(attachment.blob);
  });
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (!url) {
    return <div className={`grid place-items-center bg-[#edf0f1] text-[#899297] ${className}`}><ImageIcon size={22} /></div>;
  }
  // Blob URLs are generated from user-selected local images.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={attachment.name} className={className} />;
}

function SegmentView({
  segment,
  onAssistance,
}: {
  segment: MessageSegment;
  onAssistance: (phraseId: string, trigger: "click" | "long_press") => void;
}) {
  if (segment.type === "english_chunk") {
    return (
      <button
        type="button"
        aria-label={segment.content}
        title={segment.assistanceAvailable ? "简短查看这个短语" : undefined}
        data-testid="english-chunk"
        className="inline cursor-pointer appearance-none border-0 bg-transparent p-0 align-baseline font-[inherit] leading-[inherit] text-inherit underline decoration-[#aab2b5] decoration-dotted decoration-1 underline-offset-3 transition-colors hover:text-[#365d56] hover:decoration-[#68857f] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#66827d]"
        onClick={() => {
          if (segment.assistanceAvailable) onAssistance(segment.phraseId, "click");
        }}
        onContextMenu={(event) => {
          if (!segment.assistanceAvailable) return;
          event.preventDefault();
          onAssistance(segment.phraseId, "long_press");
        }}
      >
        {segment.content}
      </button>
    );
  }
  return segment.content;
}

function EmptyState({ onSuggestion }: { onSuggestion: (suggestion: string) => void }) {
  const suggestions = ["帮我理清今天最重要的三件事", "我有件事拿不定主意", "解释一个我没想明白的问题"];
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-6 pb-16 text-center fade-up">
      <div className="grid size-14 place-items-center rounded-2xl bg-[var(--brand)] text-sm font-bold tracking-[-0.06em] text-white shadow-[0_10px_30px_rgba(23,37,42,0.16)]">
        EO
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-[#202628]">想聊点什么？</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
        正常聊天、问问题、做分析。这里首先是一位自然的对话助手。
      </p>
      <div className="mt-7 grid w-full gap-2 sm:grid-cols-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className="rounded-xl border border-[var(--line)] bg-white px-3.5 py-3 text-left text-xs leading-5 text-[#4b5458] shadow-[0_2px_8px_rgba(25,35,40,0.025)] transition hover:-translate-y-0.5 hover:border-[#cbd2d4]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  ready,
  imageInputEnabled = false,
  onRetry,
  onSuggestion,
  onAssistance,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: messages.length > 2 ? "smooth" : "auto" });
  }, [messages]);

  if (!ready) {
    return (
      <div className="grid h-full place-items-center" aria-label="正在加载会话">
        <div className="size-5 animate-spin rounded-full border-2 border-[#cdd3d5] border-t-[var(--accent)]" />
      </div>
    );
  }
  if (messages.length === 0) return <EmptyState onSuggestion={onSuggestion} />;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-7" aria-live="polite">
      {messages.map((message) => {
        const user = message.role === "user";
        return (
          <article
            key={message.id}
            data-testid={`message-${message.role}`}
            className={`fade-up mb-5 flex ${user ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[88%] sm:max-w-[82%] ${user ? "rounded-2xl rounded-br-md bg-[#e8ebed] px-4 py-3" : "px-1 py-1"}`}>
              {message.attachments.length > 0 ? (
                <div>
                  <div className={`mb-2 flex gap-2 ${user ? "justify-end" : "justify-start"}`}>
                    {message.attachments.map((attachment) => (
                      <BlobImage
                        key={attachment.id}
                        attachment={attachment}
                        className="max-h-64 max-w-full rounded-xl border border-black/5 object-cover shadow-sm"
                      />
                    ))}
                  </div>
                  {!imageInputEnabled ? (
                    <div
                      data-testid="historical-image-status"
                      className="mb-2 text-[10px] text-[var(--muted)]"
                    >
                      图片功能暂未开放；历史图片仅供查看。
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className={`message-prose text-[14px] sm:text-[15px] ${message.status === "pending" ? "text-[#7e878b]" : "text-[#252b2e]"}`}>
                {message.segments.map((segment, index) => (
                  <SegmentView
                    key={`${message.id}-${index}`}
                    segment={segment}
                    onAssistance={(phraseId, trigger) => onAssistance(message.id, phraseId, index, trigger)}
                  />
                ))}
                {message.status === "pending" ? (
                  <span className="ml-2 inline-flex gap-1 align-middle" aria-label="正在回复">
                    <span className="size-1 animate-pulse rounded-full bg-[#8b9599]" />
                    <span className="size-1 animate-pulse rounded-full bg-[#8b9599] [animation-delay:120ms]" />
                    <span className="size-1 animate-pulse rounded-full bg-[#8b9599] [animation-delay:240ms]" />
                  </span>
                ) : null}
              </div>
              {!user && (message.status === "error" || message.status === "cancelled") ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#fff4f2] px-3 py-2 text-xs text-[#8e4b44]">
                  <AlertCircle size={14} />
                  <span>{message.errorMessage ?? (message.status === "cancelled" ? "回复已取消" : "回复失败")}</span>
                  <button
                    type="button"
                    onClick={() => onRetry(message.id)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-white/70"
                  >
                    <RefreshCw size={12} /> 重试
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
