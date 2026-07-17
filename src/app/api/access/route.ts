import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  AccessConfigurationError,
  accessCookieOptions,
  createAccessToken,
  isAccessControlEnabled,
  validateAccessPassword,
} from "@/lib/security/access-control";

export const runtime = "nodejs";

function safeNextPath(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!isAccessControlEnabled()) {
      return NextResponse.json(
        { error: { code: "ACCESS_CONTROL_NOT_CONFIGURED", message: "访问控制尚未配置。" } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const form = await request.formData();
    const password = form.get("password");
    const nextPath = safeNextPath(form.get("next"));
    if (typeof password !== "string" || !validateAccessPassword(password)) {
      const retryUrl = new URL("/access", request.url);
      retryUrl.searchParams.set("error", "1");
      if (nextPath !== "/") retryUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(retryUrl, 303);
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
    response.cookies.set(ACCESS_COOKIE_NAME, createAccessToken(), accessCookieOptions());
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const message =
      error instanceof AccessConfigurationError
        ? "访问控制配置不完整。"
        : "访问控制暂时不可用。";
    return NextResponse.json(
      {
        error: {
          category: "configuration",
          code: "ACCESS_CONTROL_CONFIGURATION_ERROR",
          message,
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
