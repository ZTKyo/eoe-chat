import { afterEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA } from "@/lib/eoe/provider-template/schema";
import { OpenAICompatibleProvider } from "./openai-compatible";

function provider(input: { id: string; modelId: string; vision: boolean }) {
  return new OpenAICompatibleProvider({
    id: input.id,
    modelId: input.modelId,
    baseUrl: "https://provider.example/v1",
    apiKey: "test-secret",
    timeoutMs: 1000,
    fetchImpl: (...args) => fetch(...args),
    capabilities: {
      text: true,
      vision: input.vision,
      streaming: false,
      jsonMode: !input.vision,
      jsonSchema: false,
      toolCalling: false,
    },
  });
}

function response() {
  return new Response(JSON.stringify({
    id: "remote-id",
    choices: [{ message: { content: JSON.stringify({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: false,
      responseTemplate: "直接回答。",
      noFitReason: "other",
    }) } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("Provider-specific M2.3 Template request strategy", () => {
  it.each([
    ["GLM", "glm", "glm-4.7"],
    ["DeepSeek", "deepseek", "deepseek-v4-flash"],
  ])("uses JSON Mode for %s when native JSON Schema is not confirmed", async (_label, id, modelId) => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    await provider({ id, modelId, vision: false }).generate({
      messages: [{ role: "system", content: "schemaVersion=eoe.provider-template.v1" }],
      attachments: [], requestId: `${id}-request`, responseFormat: "json_schema",
      responseJsonSchema: { name: "eoe_provider_response_template_v1", schema: PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA, strict: true },
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model).toBe(modelId);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("eoe.provider-template.v1");
  });

  it("uses the same Template directive for GLM Vision without assuming unsupported JSON Mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);
    await provider({ id: "glm-vision", modelId: "glm-4.6v", vision: true }).generate({
      messages: [
        { role: "system", content: "schemaVersion=eoe.provider-template.v1" },
        { role: "user", content: "分析图片" },
      ],
      attachments: [{ id: "image", name: "fixture.png", mimeType: "image/png", size: 4, dataUrl: "data:image/png;base64,AAAA" }],
      requestId: "vision-request", responseFormat: "json_schema",
      responseJsonSchema: { name: "eoe_provider_response_template_v1", schema: PROVIDER_RESPONSE_TEMPLATE_JSON_SCHEMA, strict: true },
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.model).toBe("glm-4.6v");
    expect(body.response_format).toBeUndefined();
    expect(body.messages[0].content).toContain("eoe.provider-template.v1");
    expect(body.messages[1].content[0].type).toBe("image_url");
  });
});
