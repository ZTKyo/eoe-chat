import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "./openai-compatible";

function createProvider(overrides: Partial<ConstructorParameters<typeof OpenAICompatibleProvider>[0]> = {}) {
  return new OpenAICompatibleProvider({
    id: "test-provider",
    modelId: "test-model",
    baseUrl: "https://provider.example/v1",
    apiKey: "test-secret",
    timeoutMs: 1000,
    fetchImpl: (...args) => fetch(...args),
    capabilities: {
      text: true,
      vision: true,
      streaming: true,
      jsonMode: true,
      toolCalling: true,
    },
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAICompatibleProvider", () => {
  it("normalizes a vision response and sends Base64 image content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "provider-request",
          choices: [{ message: { content: "图片里有一只猫。" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await createProvider().generate({
      messages: [{ role: "user", content: "请描述图片" }],
      attachments: [
        {
          id: "image-1",
          name: "cat.png",
          mimeType: "image/png",
          size: 10,
          dataUrl: "data:image/png;base64,AAAA",
        },
      ],
      requestId: "local-request",
    });

    expect(result).toMatchObject({
      content: "图片里有一只猫。",
      requestId: "provider-request",
      providerId: "test-provider",
      usage: { totalTokens: 20 },
    });
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.messages[0].content[0].image_url.url).toBe("data:image/png;base64,AAAA");
    expect(String((requestInit.headers as Record<string, string>).Authorization)).toBe("Bearer test-secret");
  });

  it("normalizes HTTP 429 as a retryable rate-limit error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "rate", message: "too many requests" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(
      createProvider().generate({
        messages: [{ role: "user", content: "hello" }],
        attachments: [],
        requestId: "request-429",
      }),
    ).rejects.toMatchObject({ category: "rate_limit", retryable: true, status: 429 });
  });

  it("requests JSON mode when the adapter supports structured output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await createProvider().generate({
      messages: [{ role: "system", content: "Return JSON" }, { role: "user", content: "hello" }],
      attachments: [],
      requestId: "request-json",
      responseFormat: "json_object",
    });
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body)).response_format).toEqual({ type: "json_object" });
  });

  it("uses a strict native JSON Schema only when the capability is confirmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"ok\":true}" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await createProvider({ capabilities: { text: true, vision: false, streaming: false, jsonMode: true, jsonSchema: true, toolCalling: false } }).generate({
      messages: [{ role: "system", content: "Return the Envelope" }, { role: "user", content: "hello" }],
      attachments: [],
      requestId: "request-schema",
      responseFormat: "json_schema",
      responseJsonSchema: {
        name: "envelope",
        strict: true,
        schema: { type: "object", additionalProperties: false },
      },
    });
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body)).response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "envelope",
        strict: true,
        schema: { type: "object", additionalProperties: false },
      },
    });
  });

  it("honors client cancellation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
            once: true,
          });
        }),
      ),
    );
    const controller = new AbortController();
    const promise = createProvider().generate({
      messages: [{ role: "user", content: "hello" }],
      attachments: [],
      requestId: "request-cancel",
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ category: "cancelled", retryable: false });
  });
});
