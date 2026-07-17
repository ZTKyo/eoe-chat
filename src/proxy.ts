import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  AccessConfigurationError,
  isAccessControlEnabled,
  isAccessTokenValid,
} from "@/lib/security/access-control";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/access" ||
    pathname === "/api/access" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  );
}

export function proxy(request: NextRequest): NextResponse {
  try {
    if (!isAccessControlEnabled() || isPublicPath(request.nextUrl.pathname)) {
      return NextResponse.next();
    }

    if (isAccessTokenValid(request.cookies.get(ACCESS_COOKIE_NAME)?.value)) {
      return NextResponse.next();
    }

    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: {
            category: "authentication",
            code: "ACCESS_PASSWORD_REQUIRED",
            message: "请先输入访问密码。",
            retryable: false,
          },
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const accessUrl = new URL("/access", request.url);
    const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (nextPath !== "/") accessUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(accessUrl);
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
