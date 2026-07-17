import { describe, expect, it } from "vitest";
import {
  isImageInputConfigured,
  isImageInputEnabled,
  isImageRequestAllowed,
} from "./image-input";

describe("M2.5 Text-First Beta image feature flag", () => {
  it("keeps image input disabled by default", () => {
    expect(isImageInputConfigured({})).toBe(false);
    expect(isImageInputEnabled({ configured: false, developerMode: false })).toBe(false);
  });

  it("requires explicit configuration and Developer Mode", () => {
    expect(isImageInputEnabled({ configured: true, developerMode: false })).toBe(false);
    expect(isImageInputEnabled({ configured: false, developerMode: true })).toBe(false);
    expect(isImageInputEnabled({ configured: true, developerMode: true })).toBe(true);
  });

  it("allows text while rejecting default image requests", () => {
    expect(isImageRequestAllowed({ attachmentCount: 0, developerMode: false, env: {} })).toBe(true);
    expect(isImageRequestAllowed({ attachmentCount: 1, developerMode: true, env: {} })).toBe(false);
  });

  it("allows an explicitly configured Developer image request", () => {
    expect(isImageRequestAllowed({
      attachmentCount: 1,
      developerMode: true,
      env: { EOE_ENABLE_IMAGE_INPUT: "true" },
    })).toBe(true);
  });
});
