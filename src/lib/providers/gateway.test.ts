import { describe, expect, it, vi } from "vitest";
import { ProviderGateway } from "./gateway";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResult } from "./types";

class TestProvider implements Provider {
  readonly capabilities = {
    text: true,
    vision: true,
    streaming: false,
    jsonMode: false,
    toolCalling: false,
  };

  constructor(
    readonly id: string,
    readonly modelId: string,
    private readonly action: (request: ProviderRequest) => Promise<ProviderResult>,
  ) {}

  generate(request: ProviderRequest): Promise<ProviderResult> {
    return this.action(request);
  }
}

const request: ProviderRequest = {
  messages: [{ role: "user", content: "你好" }],
  attachments: [],
  requestId: "request-1",
};

function success(id: string): TestProvider {
  return new TestProvider(id, `${id}-model`, async (input) => ({
    content: `${id} reply`,
    providerId: id,
    modelId: `${id}-model`,
    requestId: input.requestId,
    latencyMs: 1,
  }));
}

describe("ProviderGateway", () => {
  it("routes image requests to vision", async () => {
    const gateway = new ProviderGateway({
      primary: success("primary"),
      vision: success("vision"),
      fallback: success("fallback"),
      mock: success("mock"),
      forceMock: false,
    });
    const result = await gateway.generate({
      ...request,
      attachments: [
        {
          id: "image-1",
          name: "photo.png",
          mimeType: "image/png",
          size: 10,
          dataUrl: "data:image/png;base64,AAAA",
        },
      ],
    });
    expect(result.providerId).toBe("vision");
    expect(result.fallbackUsed).toBe(false);
  });

  it("uses text fallback after a retryable primary error", async () => {
    const failing = new TestProvider("primary", "primary-model", async () => {
      throw new ProviderError("unavailable", "provider_unavailable", true);
    });
    const gateway = new ProviderGateway({
      primary: failing,
      vision: success("vision"),
      fallback: success("fallback"),
      mock: success("mock"),
      forceMock: false,
    });
    const result = await gateway.generate(request);
    expect(result.providerId).toBe("fallback");
    expect(result.fallbackUsed).toBe(true);
  });

  it("does not send vision failures to a text fallback", async () => {
    const failingVision = new TestProvider("vision", "vision-model", async () => {
      throw new ProviderError("unavailable", "provider_unavailable", true);
    });
    const gateway = new ProviderGateway({
      primary: success("primary"),
      vision: failingVision,
      fallback: success("fallback"),
      mock: success("mock"),
      forceMock: false,
    });
    await expect(
      gateway.generate({
        ...request,
        attachments: [
          {
            id: "image-1",
            name: "photo.png",
            mimeType: "image/png",
            size: 10,
            dataUrl: "data:image/png;base64,AAAA",
          },
        ],
      }),
    ).rejects.toMatchObject({ category: "provider_unavailable" });
  });

  it("does not call the Vision provider when the Text Beta image feature is off", async () => {
    const vision = success("vision");
    const generate = vi.spyOn(vision, "generate");
    const gateway = new ProviderGateway(
      {
        primary: success("primary"),
        vision,
        fallback: success("fallback"),
        mock: success("mock"),
        forceMock: false,
      },
      { mode: "unit", allowLiveProvider: false },
      false,
    );
    await expect(
      gateway.generate({
        ...request,
        attachments: [{
          id: "image-1",
          name: "photo.png",
          mimeType: "image/png",
          size: 10,
          dataUrl: "data:image/png;base64,AAAA",
        }],
      }),
    ).rejects.toMatchObject({
      providerCode: "IMAGE_FEATURE_DEFERRED",
      retryable: false,
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
