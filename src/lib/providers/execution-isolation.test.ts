import { afterEach, describe, expect, it, vi } from "vitest";
import { createProviderGateway, ProviderGateway } from "./gateway";
import { MockProvider } from "./mock-provider";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { Provider, ProviderRequest } from "./types";
import {
  getNativeLiveRequestCount,
  resetNativeLiveRequestCountForTest,
} from "@/lib/runtime/live-request-monitor";

const request: ProviderRequest = {
  messages: [{ role: "user", content: "test" }],
  attachments: [],
  requestId: "isolation-request",
};

function stubEnvironment(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

const fakeLiveEnvironment = {
  EOE_ALLOW_LIVE_PROVIDER: "true",
  EOE_LIVE_RUN_ID: "live-run",
  EOE_LIVE_LEDGER_PATH: "unused-ledger.json",
  GLM_API_KEY: "test-glm-key",
  DEEPSEEK_API_KEY: "test-deepseek-key",
};

describe.sequential("provider execution isolation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetNativeLiveRequestCountForTest();
  });

  it("mock E2E cannot select GLM", () => {
    stubEnvironment({
      ...fakeLiveEnvironment,
      EOE_EXECUTION_MODE: "mock_e2e",
      EOE_ALLOW_LIVE_PROVIDER: "false",
      USE_MOCK_PROVIDER: "true",
    });
    expect(createProviderGateway().describeConfiguration().primary).toBe("mock");
  });

  it("mock E2E cannot select DeepSeek", () => {
    stubEnvironment({
      ...fakeLiveEnvironment,
      EOE_EXECUTION_MODE: "mock_e2e",
      EOE_ALLOW_LIVE_PROVIDER: "false",
      USE_MOCK_PROVIDER: "true",
    });
    expect(createProviderGateway().describeConfiguration().fallback).toBeUndefined();
  });

  it("mock E2E uses only MockProvider even when both keys exist", async () => {
    const mock = new MockProvider();
    const forbidden = {
      ...mock,
      id: "forbidden-live",
      generate: vi.fn(async () => {
        throw new Error("must not run");
      }),
    } satisfies Provider;
    const gateway = new ProviderGateway(
      { primary: forbidden, vision: forbidden, fallback: forbidden, mock, forceMock: false },
      { mode: "mock_e2e", allowLiveProvider: false },
    );
    expect((await gateway.generate(request)).providerId).toBe("mock");
    expect(forbidden.generate).not.toHaveBeenCalled();
  });

  it("live probe factory selects real provider adapters only after authorization", () => {
    stubEnvironment({ ...fakeLiveEnvironment, EOE_EXECUTION_MODE: "live_probe" });
    expect(createProviderGateway().describeConfiguration()).toMatchObject({
      executionMode: "live_probe",
      forceMock: false,
      primary: "glm",
      vision: "glm-vision",
      fallback: "deepseek",
    });
  });

  it("live corpus factory selects real provider adapters only after authorization", () => {
    stubEnvironment({ ...fakeLiveEnvironment, EOE_EXECUTION_MODE: "live_corpus" });
    expect(createProviderGateway().describeConfiguration()).toMatchObject({
      executionMode: "live_corpus",
      forceMock: false,
      primary: "glm",
      fallback: "deepseek",
    });
  });

  it("production remains mock-only unless live use is explicitly enabled", () => {
    stubEnvironment({
      ...fakeLiveEnvironment,
      EOE_EXECUTION_MODE: "production",
      EOE_ALLOW_LIVE_PROVIDER: "false",
      USE_MOCK_PROVIDER: "true",
    });
    expect(createProviderGateway().describeConfiguration()).toMatchObject({
      executionMode: "production",
      forceMock: true,
      primary: "mock",
    });
  });

  it("authorized production selects live adapters without a benchmark ledger", () => {
    stubEnvironment({
      EOE_EXECUTION_MODE: "production",
      EOE_ALLOW_LIVE_PROVIDER: "true",
      USE_MOCK_PROVIDER: "false",
      GLM_API_KEY: "test-glm-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
    });
    expect(createProviderGateway().describeConfiguration()).toMatchObject({
      executionMode: "production",
      forceMock: false,
      primary: "glm",
      fallback: "deepseek",
    });
  });

  it("authorized production can make a native request without a benchmark ledger", async () => {
    stubEnvironment({
      EOE_EXECUTION_MODE: "production",
      EOE_ALLOW_LIVE_PROVIDER: "true",
      USE_MOCK_PROVIDER: "false",
      GLM_API_KEY: "test-glm-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
    });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        id: "production-request",
        choices: [{ message: { content: "{\"ok\":true}" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createProviderGateway().generate(request);
    expect(result).toMatchObject({ providerId: "glm", requestId: "production-request" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getNativeLiveRequestCount()).toBe(1);
  });

  it("image-off Live Probe records zero native Vision requests", async () => {
    stubEnvironment({
      ...fakeLiveEnvironment,
      EOE_EXECUTION_MODE: "live_probe",
      EOE_ENABLE_IMAGE_INPUT: "false",
    });
    const gateway = createProviderGateway();
    await expect(gateway.generate({
      ...request,
      attachments: [{
        id: "image-off",
        name: "image-off.png",
        mimeType: "image/png",
        size: 12,
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      }],
    })).rejects.toMatchObject({
      providerCode: "IMAGE_FEATURE_DEFERRED",
    });
    expect(getNativeLiveRequestCount()).toBe(0);
  });

  it("replay mode remains mock-only even when keys and allow flag exist", () => {
    stubEnvironment({ ...fakeLiveEnvironment, EOE_EXECUTION_MODE: "replay" });
    expect(createProviderGateway().describeConfiguration()).toMatchObject({
      executionMode: "replay",
      forceMock: true,
      primary: "mock",
    });
  });

  it("an OpenAI-compatible adapter cannot use native fetch without LiveBudgetGuard", async () => {
    const nativeFetch = vi.spyOn(globalThis, "fetch");
    const provider = new OpenAICompatibleProvider({
      id: "blocked",
      modelId: "blocked-model",
      baseUrl: "https://invalid.test",
      apiKey: "test-key",
      timeoutMs: 10,
      capabilities: {
        text: true,
        vision: false,
        streaming: false,
        jsonMode: false,
        toolCalling: false,
      },
    });
    await expect(provider.generate(request)).rejects.toMatchObject({
      providerCode: "LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD",
    });
    expect(nativeFetch).not.toHaveBeenCalled();
  });
});
