import {
  ProviderError,
  type Provider,
  type ProviderCapabilities,
  type ProviderRequest,
  type ProviderResult,
} from "./types";
import type { LiveAttemptHandle, LiveBudgetGuard } from "./live-budget-guard";
import { liveProviderBlocked } from "@/lib/runtime/execution-mode";
import { recordNativeLiveRequest } from "@/lib/runtime/live-request-monitor";

export interface AdapterOptions {
  id: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  capabilities: ProviderCapabilities;
  timeoutMs: number;
  thinking?: "enabled" | "disabled";
  liveBudgetGuard?: LiveBudgetGuard;
  allowProductionNativeFetch?: boolean;
  fetchImpl?: typeof fetch;
}

interface CompletionResponse {
  id?: string;
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { code?: string; message?: string };
}

function errorFromStatus(status: number, message: string, providerCode?: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(message, "authentication", false, status, providerCode);
  }
  if (status === 429) {
    return new ProviderError(message, "rate_limit", true, status, providerCode);
  }
  if (status === 408 || status >= 500) {
    return new ProviderError(message, "provider_unavailable", true, status, providerCode);
  }
  if (status >= 400) {
    return new ProviderError(message, "invalid_request", false, status, providerCode);
  }
  return new ProviderError(message, "unknown", false, status, providerCode);
}

export class OpenAICompatibleProvider implements Provider {
  readonly id: string;
  readonly modelId: string;
  readonly capabilities: ProviderCapabilities;

  constructor(private readonly options: AdapterOptions) {
    this.id = options.id;
    this.modelId = options.modelId;
    this.capabilities = options.capabilities;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const startedAt = performance.now();
    let liveAttempt: LiveAttemptHandle | undefined;
    let ledgerFinished = false;
    let responseStatus: number | undefined;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.options.timeoutMs);
    const cancel = () => controller.abort();
    request.signal?.addEventListener("abort", cancel, { once: true });

    try {
      if (!this.options.fetchImpl) {
        if (!this.options.liveBudgetGuard && !this.options.allowProductionNativeFetch) {
          throw liveProviderBlocked("OpenAICompatibleProvider requires LiveBudgetGuard before native fetch");
        }
        if (this.options.liveBudgetGuard) {
          liveAttempt = await this.options.liveBudgetGuard.beforeRequest({
            provider: this.id,
            model: this.modelId,
            request,
          });
        }
      }
      const messages = request.messages.map((message) => ({ ...message })) as Array<{
        role: string;
        content: unknown;
      }>;

      if (request.attachments.length > 0) {
        const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
        if (lastUserIndex < 0 || !this.capabilities.vision) {
          throw new ProviderError(
            "The selected provider cannot process this image request.",
            "invalid_request",
            false,
            400,
          );
        }
        const text = String(messages[lastUserIndex].content);
        messages[lastUserIndex] = {
          role: "user",
          content: [
            ...request.attachments.map((attachment) => ({
              type: "image_url",
              image_url: { url: attachment.dataUrl },
            })),
            { type: "text", text },
          ],
        };
      }

      const payload: Record<string, unknown> = {
        model: this.modelId,
        messages,
        stream: false,
        max_tokens: 2048,
      };
      if (this.options.thinking) {
        payload.thinking = { type: this.options.thinking };
      }
      if (
        request.responseFormat === "json_schema" &&
        this.capabilities.jsonSchema &&
        request.responseJsonSchema
      ) {
        payload.response_format = {
          type: "json_schema",
          json_schema: request.responseJsonSchema,
        };
      } else if (
        (request.responseFormat === "json_schema" || request.responseFormat === "json_object") &&
        this.capabilities.jsonMode
      ) {
        payload.response_format = { type: "json_object" };
      }

      if (!this.options.fetchImpl) recordNativeLiveRequest();
      const response = await (this.options.fetchImpl ?? fetch)(`${this.options.baseUrl.replace(/\/$/u, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
          "X-Request-ID": request.requestId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      responseStatus = response.status;

      let data: CompletionResponse;
      try {
        data = (await response.json()) as CompletionResponse;
      } catch {
        throw new ProviderError(
          "Provider returned a non-JSON response.",
          "invalid_response",
          response.status >= 500,
          502,
        );
      }

      if (!response.ok) {
        throw errorFromStatus(
          response.status,
          data.error?.message ?? `Provider request failed with HTTP ${response.status}.`,
          data.error?.code,
        );
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        const finishReason = data.choices?.[0]?.finish_reason;
        const filtered = finishReason === "content_filter";
        throw new ProviderError(
          filtered ? "Provider filtered the response." : "Provider returned an empty response.",
          filtered ? "content_filter" : "invalid_response",
          !filtered,
          502,
        );
      }

      const result: ProviderResult = {
        content,
        providerId: this.id,
        modelId: this.modelId,
        requestId: data.id ?? request.requestId,
        latencyMs: Math.round(performance.now() - startedAt),
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
      if (liveAttempt) {
        await this.options.liveBudgetGuard?.completeRequest({
          handle: liveAttempt,
          httpStatus: response.status,
          usage: result.usage,
          latencyMs: result.latencyMs,
        });
        ledgerFinished = true;
      }
      return result;
    } catch (error) {
      let normalized: ProviderError;
      if (error instanceof ProviderError) {
        normalized = error;
      } else if (controller.signal.aborted) {
        if (timedOut) {
          normalized = new ProviderError("Provider request timed out.", "timeout", true, 504);
        } else {
          normalized = new ProviderError("Provider request was cancelled.", "cancelled", false, 499);
        }
      } else {
        normalized = new ProviderError(
          error instanceof Error ? error.message : "Unknown provider error.",
          "provider_unavailable",
          true,
          502,
        );
      }
      if (liveAttempt && !ledgerFinished) {
        await this.options.liveBudgetGuard?.failRequest({
          handle: liveAttempt,
          httpStatus: responseStatus ?? normalized.status,
          latencyMs: Math.round(performance.now() - startedAt),
          errorCategory: normalized.category,
        });
        ledgerFinished = true;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", cancel);
    }
  }
}
