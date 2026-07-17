"use client";

import { useRef } from "react";
import { ArrowUp, ImagePlus, Square, X } from "lucide-react";
import type { MessageAttachment } from "@/domain/chat";
import { createId } from "@/lib/ids";
import { validateImageFile } from "@/lib/files";
import { BlobImage } from "./message-list";

interface ComposerProps {
  draft: string;
  attachment: MessageAttachment | null;
  imageInputEnabled?: boolean;
  pending: boolean;
  error?: string;
  onDraftChange: (value: string) => void;
  onAttachmentChange: (attachment: MessageAttachment | null) => void;
  onError: (message?: string) => void;
  onSend: () => void;
  onCancel: () => void;
}

export function Composer({
  draft,
  attachment,
  imageInputEnabled = false,
  pending,
  error,
  onDraftChange,
  onAttachmentChange,
  onError,
  onSend,
  onCancel,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = Boolean(draft.trim() || attachment) && !pending;

  return (
    <div className="safe-bottom bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent px-3 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {attachment ? (
          <div data-testid="image-preview" className="mb-2 inline-flex items-start gap-2 rounded-xl border border-[var(--line)] bg-white p-2 shadow-sm">
            <BlobImage key={attachment.id} attachment={attachment} className="size-16 rounded-lg object-cover" />
            <div className="max-w-40 pt-1">
              <div className="truncate text-xs font-medium">{attachment.name}</div>
              <div className="mt-1 text-[10px] text-[var(--muted)]">{(attachment.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button
              type="button"
              aria-label="移除图片"
              data-testid="remove-image"
              className="grid size-7 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-soft)]"
              onClick={() => onAttachmentChange(null)}
            >
              <X size={15} />
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--line-strong)] bg-white p-2 shadow-[0_8px_30px_rgba(35,45,50,0.07)] focus-within:border-[#aeb9bc]">
          <textarea
            data-testid="composer-input"
            value={draft}
            rows={1}
            placeholder="输入消息…"
            aria-label="消息"
            className="max-h-36 min-h-12 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 outline-none placeholder:text-[#9aa1a4]"
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSend) onSend();
              }
            }}
          />
          <div className="flex items-center justify-between px-1 pb-0.5">
            <div>
              {imageInputEnabled ? (
                <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                data-testid="image-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const validationError = validateImageFile(file);
                  if (validationError) {
                    onError(validationError);
                    event.target.value = "";
                    return;
                  }
                  onError(undefined);
                  onAttachmentChange({
                    id: createId("attachment"),
                    kind: "image",
                    name: file.name,
                    mimeType: file.type,
                    size: file.size,
                    blob: file,
                  });
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                aria-label="添加图片"
                onClick={() => fileInputRef.current?.click()}
                className="grid size-9 place-items-center rounded-xl text-[#657075] transition hover:bg-[var(--surface-soft)] hover:text-[#263034]"
              >
                <ImagePlus size={19} />
              </button>
                </>
              ) : null}
            </div>
            {pending ? (
              <button
                type="button"
                aria-label="停止回复"
                data-testid="cancel-response"
                onClick={onCancel}
                className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white transition hover:bg-[#26383e]"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="发送"
                data-testid="send-message"
                disabled={!canSend}
                onClick={onSend}
                className="grid size-9 place-items-center rounded-xl bg-[var(--brand)] text-white transition hover:bg-[#26383e] disabled:cursor-not-allowed disabled:bg-[#d7dcde]"
              >
                <ArrowUp size={18} strokeWidth={2.3} />
              </button>
            )}
          </div>
        </div>
        <div className="flex min-h-6 items-center justify-center px-2 pt-1.5 text-center text-[10px] text-[#959da0]">
          {error ? <span className="text-[var(--danger)]">{error}</span> : <span>内容保存在当前设备；AI 也可能出错，请核对重要信息。</span>}
        </div>
      </div>
    </div>
  );
}
