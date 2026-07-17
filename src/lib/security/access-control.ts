import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "eoe_access";
const ACCESS_TOKEN_CONTEXT = "eoe-access-v1";
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SecurityEnvironment = Record<string, string | undefined>;

export class AccessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccessConfigurationError";
  }
}

interface AccessConfiguration {
  enabled: boolean;
  password?: string;
  sessionSecret?: string;
}

function readAccessConfiguration(env: SecurityEnvironment = process.env): AccessConfiguration {
  const password = env.EOE_ACCESS_PASSWORD?.trim();
  const sessionSecret = env.EOE_ACCESS_SESSION_SECRET?.trim();

  if (!password && !sessionSecret) return { enabled: false };
  if (!password) {
    throw new AccessConfigurationError(
      "EOE_ACCESS_PASSWORD is required when EOE_ACCESS_SESSION_SECRET is configured.",
    );
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new AccessConfigurationError(
      "EOE_ACCESS_SESSION_SECRET must contain at least 32 characters when access control is enabled.",
    );
  }

  return { enabled: true, password, sessionSecret };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function accessToken(password: string, sessionSecret: string): string {
  return createHmac("sha256", sessionSecret)
    .update(`${ACCESS_TOKEN_CONTEXT}:${password}`, "utf8")
    .digest("base64url");
}

export function isAccessControlEnabled(env: SecurityEnvironment = process.env): boolean {
  return readAccessConfiguration(env).enabled;
}

export function validateAccessPassword(
  candidate: string,
  env: SecurityEnvironment = process.env,
): boolean {
  const config = readAccessConfiguration(env);
  if (!config.enabled || !config.password) return false;
  return timingSafeEqual(digest(candidate), digest(config.password));
}

export function createAccessToken(env: SecurityEnvironment = process.env): string {
  const config = readAccessConfiguration(env);
  if (!config.enabled || !config.password || !config.sessionSecret) {
    throw new AccessConfigurationError("Access control is not configured.");
  }
  return accessToken(config.password, config.sessionSecret);
}

export function isAccessTokenValid(
  candidate: string | undefined,
  env: SecurityEnvironment = process.env,
): boolean {
  if (!candidate) return false;
  const expected = createAccessToken(env);
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function accessCookieOptions(env: SecurityEnvironment = process.env): {
  httpOnly: true;
  secure: boolean;
  sameSite: "strict";
  maxAge: number;
  path: "/";
} {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  };
}
