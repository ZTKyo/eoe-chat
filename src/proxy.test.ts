import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { ACCESS_COOKIE_NAME, createAccessToken } from "@/lib/security/access-control";

const accessEnvironment = {
  EOE_ACCESS_PASSWORD: "private-beta-password",
  EOE_ACCESS_SESSION_SECRET: "a-session-secret-that-is-longer-than-32-characters",
};

function configureAccess(): void {
  for (const [key, value] of Object.entries(accessEnvironment)) vi.stubEnv(key, value);
}

describe("password proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("redirects unauthenticated pages to the access screen", () => {
    configureAccess();
    const response = proxy(new NextRequest("https://example.test/"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.test/access");
  });

  it("rejects unauthenticated API requests with JSON", async () => {
    configureAccess();
    const response = proxy(new NextRequest("https://example.test/api/chat"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ACCESS_PASSWORD_REQUIRED" },
    });
  });

  it("accepts a valid signed access cookie", () => {
    configureAccess();
    const response = proxy(new NextRequest("https://example.test/", {
      headers: {
        Cookie: `${ACCESS_COOKIE_NAME}=${createAccessToken(accessEnvironment)}`,
      },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps PWA metadata public", () => {
    configureAccess();
    const response = proxy(new NextRequest("https://example.test/manifest.webmanifest"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
