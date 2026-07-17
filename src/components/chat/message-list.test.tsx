import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { StoredMessage } from "@/domain/chat";
import { MessageList } from "./message-list";

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

const message: StoredMessage = {
  id: "message-1",
  conversationId: "conversation-1",
  role: "assistant",
  segments: [
    { type: "text", content: "我觉得先确认最重要的目标，是 ", language: "zh" },
    { type: "english_chunk", content: "a good place to start", phraseId: "p-good-place-to-start", isNew: true, assistanceAvailable: true },
    { type: "text", content: "；之后再决定具体动作。", language: "zh" },
  ],
  attachments: [],
  plainText: "我觉得先确认最重要的目标，是 a good place to start；之后再决定具体动作。",
  status: "complete",
  policyVersion: "eoe.scheduler.v1.1",
  schemaVersion: "eoe.data.v1",
  createdAt: 1,
  updatedAt: 1,
};

describe("English Chunk UI", () => {
  it("renders inline without Badge styling and records click assistance", () => {
    const onAssistance = vi.fn();
    render(<MessageList messages={[message]} ready onRetry={vi.fn()} onSuggestion={vi.fn()} onAssistance={onAssistance} />);
    const chunk = screen.getByTestId("english-chunk");
    expect(chunk.className).toContain("bg-transparent");
    expect(chunk.className).toContain("p-0");
    expect(chunk.className).not.toContain("brand-soft");
    expect(chunk.className).not.toContain("rounded-md");
    expect(screen.getByTestId("message-assistant").textContent).toBe(message.plainText);
    fireEvent.click(chunk);
    expect(onAssistance).toHaveBeenCalledWith("message-1", "p-good-place-to-start", 1, "click");
    fireEvent.contextMenu(chunk);
    expect(onAssistance).toHaveBeenCalledWith("message-1", "p-good-place-to-start", 1, "long_press");
  });

  it("keeps a legacy image message readable with a stable deferred status", () => {
    const legacyImage: StoredMessage = {
      ...message,
      id: "legacy-image-message",
      role: "user",
      segments: [{ type: "text", content: "这是以前保存的图片。", language: "zh" }],
      attachments: [{
        id: "legacy-image",
        kind: "image",
        name: "legacy.png",
        mimeType: "image/png",
        size: 12,
        blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
      }],
      plainText: "这是以前保存的图片。",
    };
    render(
      <MessageList
        messages={[legacyImage]}
        ready
        imageInputEnabled={false}
        onRetry={vi.fn()}
        onSuggestion={vi.fn()}
        onAssistance={vi.fn()}
      />,
    );
    expect(screen.getByTestId("message-user")).toHaveTextContent("这是以前保存的图片。");
    expect(screen.getByTestId("historical-image-status")).toHaveTextContent("历史图片仅供查看");
    expect(screen.getByText("图片功能暂未开放；历史图片仅供查看。")).toBeVisible();
  });
});
