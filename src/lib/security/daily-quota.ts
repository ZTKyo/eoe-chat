import { createHmac, timingSafeEqual } from "node:crypto";
import {
  AccessConfigurationError,
  type SecurityEnvironment,
} from "./access-control";

export const DAILY_QUOTA_COOKIE_NAME = "eoe_daily_quota";
const QUOTA_CONTEXT = "eoe-daily-quota-v1";
const MAX_CONFIGURED_DAILY_LIMIT = 10_000;

export interface DailyQuotaResult {
  enabled: boolean;
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  setCookie?: string;
}

function configuredLimit(env: SecurityEnvironment): number {
  const parsed = Number(env.EOE_DAILY_REQUEST_LIMIT);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, MAX_CONFIGURED_DAILY_LIMIT);
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${QUOTA_CONTEXT}:${payload}`, "utf8")
    .digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const pair of header?.split(";") ?? []) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }
  return cookies;
}

function readCount(cookie: string | undefined, expectedDay: string, secret: string): number {
  if (!cookie) return 0;
  const [payload, signature, extra] = cookie.split(".");
  if (!payload || !signature || extra || !safeEqual(signature, sign(payload, secret))) return 0;
  const [storedDay, storedCount, extraPayload] = payload.split(":");
  if (extraPayload || storedDay !== expectedDay) return 0;
  const count = Number(storedCount);
  return Number.isInteger(count) && count >= 0 ? count : 0;
}

function serializeCookie(payload: string, secret: string, secure: boolean): string {
  const value = `${payload}.${sign(payload, secret)}`;
  return [
    `${DAILY_QUOTA_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=172800",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function consumeDailyQuota(
  request: Request,
  env: SecurityEnvironment = process.env,
  now = new Date(),
): DailyQuotaResult {
  const limit = configuredLimit(env);
  if (limit === 0) {
    return { enabled: false, allowed: true, limit: 0, used: 0, remaining: 0 };
  }

  const secret = env.EOE_ACCESS_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new AccessConfigurationError(
      "EOE_ACCESS_SESSION_SECRET must contain at least 32 characters when daily quota is enabled.",
    );
  }

  const today = dayKey(now);
  const current = readCount(
    parseCookies(request.headers.get("cookie")).get(DAILY_QUOTA_COOKIE_NAME),
    today,
    secret,
  );
  if (current >= limit) {
    return {
      enabled: true,
      allowed: false,
      limit,
      used: current,
      remaining: 0,
    };
  }

  const used = current + 1;
  const payload = `${today}:${used}`;
  return {
    enabled: true,
    allowed: true,
    limit,
    used,
    remaining: limit - used,
    setCookie: serializeCookie(payload, secret, env.NODE_ENV === "production"),
  };
}
