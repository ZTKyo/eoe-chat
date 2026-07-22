"use client";

import { MessageSquareText, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Conversation } from "@/domain/chat";
import { PwaInstallButton } from "@/components/pwa-install-button";

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onRename: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return "刚刚";
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(timestamp);
}

export function Sidebar({
  conversations,
  activeId,
  mobileOpen,
  onCloseMobile,
  onCreate,
  onSelect,
  onRename,
  onDelete,
}: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="关闭会话列表"
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        aria-label="会话列表"
        className={`fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-[var(--line)] bg-[#f1f3f4] p-3 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center justify-between px-1">
          <div className="flex items-center gap-2.5 px-2">
            <div className="grid size-8 place-items-center rounded-xl bg-[var(--brand)] text-[12px] font-bold tracking-[-0.06em] text-white">
              EO
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">EOE Chat</div>
              <div className="text-[11px] text-[var(--muted)]">local-first</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭会话列表"
            className="grid size-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-black/5 md:hidden"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          data-testid="new-conversation"
          onClick={onCreate}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line-strong)] bg-white text-sm font-medium shadow-[0_1px_2px_rgba(20,30,35,0.03)] transition hover:border-[#bec7ca] hover:bg-[#fbfcfc]"
        >
          <Plus size={17} />
          新对话
        </button>

        <div className="mt-5 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#8b9397]">最近会话</div>
        <nav className="scrollbar-subtle mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="最近会话">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <div
                key={conversation.id}
                className={`group relative rounded-xl transition ${active ? "bg-white shadow-[0_1px_3px_rgba(20,30,35,0.05)]" : "hover:bg-black/[0.035]"}`}
              >
                <button
                  type="button"
                  data-testid={`conversation-${conversation.id}`}
                  onClick={() => onSelect(conversation.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 pr-17 text-left"
                >
                  <MessageSquareText size={16} className={active ? "text-[var(--accent)]" : "text-[#8c9599]"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{conversation.title}</span>
                    <span className="mt-0.5 block text-[10px] text-[#939b9f]">
                      {formatDate(conversation.lastMessageAt ?? conversation.updatedAt)}
                    </span>
                  </span>
                </button>
                <div className={`absolute right-2 top-2.5 flex gap-0.5 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                  <button
                    type="button"
                    aria-label={`重命名 ${conversation.title}`}
                    className="grid size-7 place-items-center rounded-lg text-[#7b8589] hover:bg-[#eef1f2] hover:text-[#31383b]"
                    onClick={() => onRename(conversation)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${conversation.title}`}
                    className="grid size-7 place-items-center rounded-lg text-[#7b8589] hover:bg-[#f9e9e9] hover:text-[var(--danger)]"
                    onClick={() => onDelete(conversation)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="mt-3 space-y-2">
          <PwaInstallButton />
          <div className="rounded-xl border border-[#e1e5e6] bg-white/70 px-3 py-2.5 text-[11px] leading-relaxed text-[var(--muted)]">
            对话仅保存在当前设备。API Key 只在服务端读取。
          </div>
        </div>
      </aside>
    </>
  );
}
