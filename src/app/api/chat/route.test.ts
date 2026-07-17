import { afterEach, describe, expect, it, vi } from "vitest";
import { getNativeLiveRequestCount, resetNativeLiveRequestCountForTest } from "@/lib/runtime/live-request-monitor";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  resetNativeLiveRequestCountForTest();
});

describe("POST /api/chat", () => {
  it("returns a provider-neutral semantic response through MockProvider", async () => {
    vi.stubEnv("USE_MOCK_PROVIDER", "true");
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: "conversation-1",
        messages: [{ role: "user", content: "你好" }],
        attachments: [],
      }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.provider.providerId).toBe("mock");
    expect(body.response.schemaVersion).toBe("eoe.response.v2");
    expect(body.engine.attempts).toHaveLength(1);
    expect(body.engine.finalValidation.valid).toBe(true);
  });

  it("rejects invalid requests", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects image input by default before any Vision request", async () => {
    vi.stubEnv("EOE_ENABLE_IMAGE_INPUT", "false");
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: "conversation-image-disabled",
        messages: [{ role: "user", content: "请分析图片" }],
        attachments: [{
          id: "image-1",
          name: "history.png",
          mimeType: "image/png",
          size: 12,
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        }],
        engineState: { developerMode: true },
      }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.error.code).toBe("IMAGE_FEATURE_DEFERRED");
    expect(getNativeLiveRequestCount()).toBe(0);
  });

  it("allows explicitly configured Developer image input through the retained Mock Vision path", async () => {
    vi.stubEnv("EOE_ENABLE_IMAGE_INPUT", "true");
    vi.stubEnv("EOE_EXECUTION_MODE", "unit");
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: "conversation-image-developer",
        messages: [{ role: "user", content: "请分析图片" }],
        attachments: [{
          id: "image-1",
          name: "history.png",
          mimeType: "image/png",
          size: 12,
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        }],
        engineState: { developerMode: true },
      }),
    });
    const response = await POST(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.provider.providerId).toBe("mock");
    expect(body.engine.visionObservation.valid).toBe(true);
    expect(getNativeLiveRequestCount()).toBe(0);
  });
});
