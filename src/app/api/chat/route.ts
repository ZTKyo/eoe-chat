import { NextResponse } from "next/server";
import { chatRequestSchema, type ChatResponse } from "@/domain/chat";
import { loadEoeConfig } from "@/lib/eoe/config";
import { runEoeEngine } from "@/lib/eoe/engine";
import {
  IMAGE_FEATURE_DEFERRED_CODE,
  IMAGE_FEATURE_DEFERRED_MESSAGE,
  isImageRequestAllowed,
} from "@/lib/features/image-input";
import { createProviderGateway } from "@/lib/providers/gateway";
import { ProviderError } from "@/lib/providers/types";
import { AccessConfigurationError } from "@/lib/security/access-control";
import { consumeDailyQuota, type DailyQuotaResult } from "@/lib/security/daily-quota";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: { category: "invalid_request", message: "请求内容不是有效的 JSON。" } },
      { status: 400 },
    );
  }

  const parsed = chatRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          category: "invalid_request",
          message: "请求内容不符合聊天接口约定。",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (!isImageRequestAllowed({
    attachmentCount: parsed.data.attachments.length,
    developerMode: parsed.data.engineState?.developerMode === true,
  })) {
    return NextResponse.json(
      {
        error: {
          category: "invalid_request",
          code: IMAGE_FEATURE_DEFERRED_CODE,
          message: IMAGE_FEATURE_DEFERRED_MESSAGE,
          retryable: false,
        },
      },
      { status: 409 },
    );
  }

  let quota: DailyQuotaResult;
  try {
    quota = consumeDailyQuota(request);
  } catch (error) {
    const message =
      error instanceof AccessConfigurationError
        ? "每日请求限制配置不完整。"
        : "每日请求限制暂时不可用。";
    return NextResponse.json(
      {
        error: {
          category: "configuration",
          code: "DAILY_QUOTA_CONFIGURATION_ERROR",
          message,
          retryable: false,
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: {
          category: "rate_limit",
          code: "DAILY_REQUEST_LIMIT_REACHED",
          message: `今天的 ${quota.limit} 次请求额度已经用完，请明天再试。`,
          retryable: false,
        },
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const responseHeaders: Record<string, string> = { "Cache-Control": "no-store" };
  if (quota.setCookie) responseHeaders["Set-Cookie"] = quota.setCookie;

  try {
    const result = await runEoeEngine({
      request: parsed.data,
      gateway: createProviderGateway(),
      config: loadEoeConfig(),
      signal: request.signal,
    });

    const response: ChatResponse = {
      response: result.response,
      provider: result.provider,
      engine: result.diagnostics,
    };

    return NextResponse.json(response, {
      headers: responseHeaders,
    });
  } catch (error) {
    const normalized =
      error instanceof ProviderError
        ? error
        : new ProviderError("聊天服务暂时不可用。", "unknown", false, 500);
    return NextResponse.json(
      {
        error: {
          category: normalized.category,
          message:
            normalized.category === "cancelled"
              ? "请求已取消。"
              : normalized.category === "timeout"
                ? "请求超时，请重试。"
                : "暂时无法完成回复，请稍后重试。",
          requestId: "unavailable",
          retryable: normalized.retryable,
        },
      },
      {
        status: normalized.status >= 400 && normalized.status <= 599 ? normalized.status : 500,
        headers: responseHeaders,
      },
    );
  }
}
