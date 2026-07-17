import { describe, expect, it } from "vitest";
import { parseProviderResponseTemplate } from "./parser";

describe("Provider Template raw parser", () => {
  it("parses raw JSON text without repair", () => {
    const result = parseProviderResponseTemplate(JSON.stringify({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: false,
      responseTemplate: "直接回答。",
      noFitReason: "other",
    }));
    expect(result.success).toBe(true);
  });

  it.each([
    ["malformed", "{broken", "provider_template_parse_failed"],
    ["markdown", "```json\n{}\n```", "markdown_wrapped_template"],
    ["array", "[]", "provider_template_parse_failed"],
    ["primitive", "true", "provider_template_parse_failed"],
    ["prose wrapper", "Here: {}", "provider_template_parse_failed"],
  ])("rejects %s", (_name, raw, code) => {
    const result = parseProviderResponseTemplate(raw);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.diagnostics.map((item) => item.code)).toContain(code);
  });

  it("reports additional properties instead of stripping them", () => {
    const result = parseProviderResponseTemplate(JSON.stringify({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: false,
      responseTemplate: "直接回答。",
      noFitReason: "other",
      conversationFunction: "answer",
    }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics[0]).toMatchObject({ code: "provider_template_parse_failed" });
      expect(result.diagnostics[0]?.details).toContain("conversationFunction");
    }
  });
});
