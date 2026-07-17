import { describe, expect, it } from "vitest";
import {
  AccessConfigurationError,
  createAccessToken,
  isAccessControlEnabled,
  isAccessTokenValid,
  validateAccessPassword,
} from "./access-control";

const configuredEnvironment = {
  EOE_ACCESS_PASSWORD: "correct horse battery staple",
  EOE_ACCESS_SESSION_SECRET: "a-session-secret-that-is-longer-than-32-characters",
};

describe("access control", () => {
  it("is disabled only when neither secret is configured", () => {
    expect(isAccessControlEnabled({})).toBe(false);
  });

  it("validates passwords and signed access tokens", () => {
    expect(validateAccessPassword("correct horse battery staple", configuredEnvironment)).toBe(true);
    expect(validateAccessPassword("wrong", configuredEnvironment)).toBe(false);
    const token = createAccessToken(configuredEnvironment);
    expect(isAccessTokenValid(token, configuredEnvironment)).toBe(true);
    expect(isAccessTokenValid(`${token}x`, configuredEnvironment)).toBe(false);
  });

  it("fails closed for partial configuration", () => {
    expect(() =>
      isAccessControlEnabled({ EOE_ACCESS_PASSWORD: "configured-without-secret" }),
    ).toThrow(AccessConfigurationError);
  });
});
