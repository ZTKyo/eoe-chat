import { OpenAICompatibleProvider } from "./openai-compatible";
import { LiveBudgetGuard } from "./live-budget-guard";
import { MockProvider } from "./mock-provider";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResult } from "./types";
import {
  assertLiveProviderAuthorization,
  assertMockE2eEnvironment,
  assertProductionProviderAuthorization,
  isLiveExecutionMode,
  resolveExecutionContext,
  type ExecutionContext,
} from "@/lib/runtime/execution-mode";
import {
  IMAGE_FEATURE_DEFERRED_CODE,
  IMAGE_FEATURE_DEFERRED_MESSAGE,
  isImageInputConfigured,
} from "@/lib/features/image-input";

export interface GatewayResult extends ProviderResult {
  fallbackUsed: boolean;
}

export interface GatewayProviders {
  primary: Provider;
  vision: Provider;
  fallback?: Provider;
  mock: Provider;
  forceMock: boolean;
}

export class ProviderGateway {
  constructor(
    private readonly providers: GatewayProviders,
    private readonly executionContext: ExecutionContext = resolveExecutionContext(),
    private readonly imageInputConfigured = true,
  ) {}

  async generate(request: ProviderRequest): Promise<GatewayResult> {
    if (this.executionContext.mode === "mock_e2e" || this.providers.forceMock) {
      return { ...(await this.providers.mock.generate(request)), fallbackUsed: false };
    }

    const hasImage = request.attachments.length > 0;
    if (hasImage && !this.imageInputConfigured) {
      throw new ProviderError(
        IMAGE_FEATURE_DEFERRED_MESSAGE,
        "invalid_request",
        false,
        409,
        IMAGE_FEATURE_DEFERRED_CODE,
      );
    }
    const provider = hasImage ? this.providers.vision : this.providers.primary;

    try {
      return { ...(await provider.generate(request)), fallbackUsed: false };
    } catch (error) {
      if (
        !hasImage &&
        error instanceof ProviderError &&
        error.retryable &&
        this.providers.fallback &&
        this.providers.fallback.id !== provider.id
      ) {
        return { ...(await this.providers.fallback.generate(request)), fallbackUsed: true };
      }
      throw error;
    }
  }

  describeConfiguration(): {
    executionMode: ExecutionContext["mode"];
    forceMock: boolean;
    primary: string;
    vision: string;
    fallback?: string;
    mock: string;
  } {
    return {
      executionMode: this.executionContext.mode,
      forceMock: this.executionContext.mode === "mock_e2e" || this.providers.forceMock,
      primary: this.providers.primary.id,
      vision: this.providers.vision.id,
      fallback: this.providers.fallback?.id,
      mock: this.providers.mock.id,
    };
  }
}

function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createProviderGateway(): ProviderGateway {
  const executionContext = resolveExecutionContext();
  const timeoutMs = envNumber(process.env.PROVIDER_TIMEOUT_MS, 30_000);
  const mock = new MockProvider();

  if (executionContext.mode === "mock_e2e") {
    assertMockE2eEnvironment();
    return new ProviderGateway(
      { primary: mock, vision: mock, mock, forceMock: true },
      executionContext,
      isImageInputConfigured(),
    );
  }

  const productionLive =
    executionContext.mode === "production" && process.env.USE_MOCK_PROVIDER === "false";
  if (!isLiveExecutionMode(executionContext.mode) && !productionLive) {
    return new ProviderGateway(
      { primary: mock, vision: mock, mock, forceMock: true },
      executionContext,
      isImageInputConfigured(),
    );
  }

  if (productionLive) {
    assertProductionProviderAuthorization();
  } else {
    assertLiveProviderAuthorization();
  }
  const glmKey = process.env.GLM_API_KEY?.trim() ?? "";
  const deepSeekKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  const liveBudgetGuard = productionLive ? undefined : new LiveBudgetGuard();

  const primary = new OpenAICompatibleProvider({
    id: "glm",
    modelId: process.env.PRIMARY_MODEL ?? "glm-4.7",
    baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    apiKey: glmKey,
    timeoutMs,
    thinking: "disabled",
    liveBudgetGuard,
    allowProductionNativeFetch: productionLive,
    capabilities: {
      text: true,
      vision: false,
      streaming: true,
      jsonMode: true,
      toolCalling: true,
    },
  });

  const vision = new OpenAICompatibleProvider({
    id: "glm-vision",
    modelId: process.env.VISION_MODEL ?? "glm-4.6v",
    baseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    apiKey: glmKey,
    timeoutMs,
    thinking: "disabled",
    liveBudgetGuard,
    allowProductionNativeFetch: productionLive,
    capabilities: {
      text: true,
      vision: true,
      streaming: true,
      jsonMode: false,
      toolCalling: true,
    },
  });

  const fallback = new OpenAICompatibleProvider({
    id: "deepseek",
    modelId: process.env.FALLBACK_MODEL ?? "deepseek-v4-flash",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    apiKey: deepSeekKey,
    timeoutMs,
    thinking: "disabled",
    liveBudgetGuard,
    allowProductionNativeFetch: productionLive,
    capabilities: {
      text: true,
      vision: false,
      streaming: true,
      jsonMode: true,
      toolCalling: true,
    },
  });

  return new ProviderGateway(
    { primary, vision, fallback, mock, forceMock: false },
    executionContext,
    isImageInputConfigured(),
  );
}
