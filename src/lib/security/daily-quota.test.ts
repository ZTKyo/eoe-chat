import { describe, expect, it } from "vitest";
import { consumeDailyQuota, DAILY_QUOTA_COOKIE_NAME } from "./daily-quota";

const env = {
  EOE_DAILY_REQUEST_LIMIT: "2",
  EOE_ACCESS_SESSION_SECRET: "a-session-secret-that-is-longer-than-32-characters",
  NODE_ENV: "test",
};
const now = new Date("2026-07-17T10:00:00.000Z");

function cookieValue(setCookie: string): string {
  return setCookie.split(";")[0] ?? "";
}

describe("daily quota", () => {
  it("is disabled when no positive limit is configured", () => {
    expect(consumeDailyQuota(new Request("http://localhost"), {}, now)).toMatchObject({
      enabled: false,
      allowed: true,
    });
  });

  it("allows up to the configured signed-cookie limit", () => {
    const first = consumeDailyQuota(new Request("http://localhost"), env, now);
    expect(first).toMatchObject({ allowed: true, used: 1, remaining: 1 });
    expect(first.setCookie).toContain(`${DAILY_QUOTA_COOKIE_NAME}=`);

    const second = consumeDailyQuota(
      new Request("http://localhost", { headers: { Cookie: cookieValue(first.setCookie ?? "") } }),
      env,
      now,
    );
    expect(second).toMatchObject({ allowed: true, used: 2, remaining: 0 });

    const blocked = consumeDailyQuota(
      new Request("http://localhost", { headers: { Cookie: cookieValue(second.setCookie ?? "") } }),
      env,
      now,
    );
    expect(blocked).toMatchObject({ allowed: false, used: 2, remaining: 0 });
  });

  it("ignores a tampered quota cookie", () => {
    const result = consumeDailyQuota(
      new Request("http://localhost", {
        headers: { Cookie: `${DAILY_QUOTA_COOKIE_NAME}=2026-07-17:49.invalid` },
      }),
      env,
      now,
    );
    expect(result).toMatchObject({ allowed: true, used: 1 });
  });
});
