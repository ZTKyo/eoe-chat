import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import type { MockScenario } from "@/domain/eoe";
import { runEoeEngine } from "@/lib/eoe/engine";
import { ProviderGateway } from "./gateway";
import { MockProvider } from "./mock-provider";

function run(mockScenario: MockScenario) {
  const mock = new MockProvider();
  const gateway = new ProviderGateway({ primary: mock, vision: mock, mock, forceMock: true });
  const request: ChatRequest = {
    conversationId: `mock-${mockScenario}`,
    messages: [{ role: "user", content: "下一步该怎么做？" }],
    attachments: [],
    engineState: { recentExposurePhraseIds: [], mockScenario },
  };
  return runEoeEngine({ request, gateway, config: { enabled: true, fixedLevel: 2, developerMode: true } });
}

describe("MockProvider M2.3 raw Template matrix", () => {
  it.each([
    "valid_template_no_fit",
    "valid_template_start",
    "valid_template_middle",
  ] as const)("passes %s through parser, validator, mapper, and Domain validation", async (scenario) => {
    const result = await run(scenario);
    expect(result.diagnostics.attempts, JSON.stringify(result.diagnostics.attempts, null, 2)).toHaveLength(1);
    expect(result.diagnostics.attempts[0]?.pipeline).toMatchObject({
      templateParse: "passed", templateValidator: "passed", mapper: "passed",
      domainSchema: "passed", domainValidator: "passed",
    });
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it.each([
    ["template_missing_placeholder", "missing_placeholder"],
    ["template_duplicate_placeholder", "duplicate_placeholder"],
    ["template_unexpected_placeholder", "unexpected_placeholder"],
    ["template_use_phrase_conflict", "use_phrase_conflict"],
    ["template_missing_no_fit_reason", "missing_no_fit_reason"],
    ["template_unexpected_no_fit_reason", "unexpected_no_fit_reason"],
    ["template_empty_response", "empty_response_template"],
    ["template_html", "html_in_template"],
    ["template_label_like", "template_label_like_overlay"],
    ["template_isolated_placeholder", "template_isolated_placeholder"],
    ["template_colon_explanation", "template_colon_explanation"],
    ["template_translation_duplication", "template_translation_duplication"],
    ["template_position_violation", "template_position_violation"],
    ["template_punctuation_violation", "template_punctuation_violation"],
    ["template_full_english_takeover", "template_full_english_takeover"],
    ["template_teacher_mode", "template_teacher_mode"],
    ["template_internal_prompt_leak", "template_internal_prompt_leak"],
    ["template_old_control_fields", "provider_template_parse_failed"],
  ] as const)("blocks %s before Domain display", async (scenario, code) => {
    const result = await run(scenario);
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.attempts.flatMap((item) => item.validation.violations.map((violation) => violation.code))).toContain(code);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
    expect(result.response.noFit).toBe(true);
  });

  it("regenerates the whole Template and succeeds only on Attempt 2", async () => {
    const result = await run("template_retry_then_success");
    expect(result.diagnostics.attempts.map((item) => item.outcome)).toEqual(["invalid", "valid"]);
    expect(result.diagnostics.attempts[1]?.validatorRetry).toBe(true);
    expect(result.diagnostics.naturalFallbackUsed).toBe(false);
  });

  it("uses Natural Fallback after two invalid Templates", async () => {
    const result = await run("template_double_failure");
    expect(result.diagnostics.attempts).toHaveLength(2);
    expect(result.diagnostics.naturalFallbackUsed).toBe(true);
    expect(result.response.noFit).toBe(true);
  });

  it.each([
    ["provider_retryable_error", 2],
    ["provider_non_retryable_error", 1],
  ] as const)("normalizes %s independently from Template validation", async (scenario, attempts) => {
    const result = await run(scenario);
    expect(result.diagnostics.attempts).toHaveLength(attempts);
    expect(result.diagnostics.attempts.every((item) => item.outcome === "provider_error")).toBe(true);
  });
});
