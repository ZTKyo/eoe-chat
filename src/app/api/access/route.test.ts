import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE_NAME } from "@/lib/security/access-control";
import { POST } from "./route";

function configureAccess(): void {
  vi.stubEnv("EOE_ACCESS_PASSWORD", "private-beta-password");
  vi.stubEnv(
    "EOE_ACCESS_SESSION_SECRET",
    "a-session-secret-that-is-longer-than-32-characters",
  );
  vi.stubEnv("NODE_ENV", "production");
}

function loginRequest(password: string): NextRequest {
  const body = new FormData();
  body.set("password", password);
  body.set("next", "/");
  return new NextRequest("https://example.test/api/access", { method: "POST", body });
}

describe("POST /api/access", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an incorrect password without setting a session", async () => {
    configureAccess();
    const response = await POST(loginRequest("wrong"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.test/access?error=1");
    expect(response.cookies.get(ACCESS_COOKIE_NAME)).toBeUndefined();
  });

  it("sets a secure HTTP-only cookie after a correct password", async () => {
    configureAccess();
    const response = await POST(loginRequest("private-beta-password"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.test/");
    expect(response.cookies.get(ACCESS_COOKIE_NAME)?.value).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });
});
