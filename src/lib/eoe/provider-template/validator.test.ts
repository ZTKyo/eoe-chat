import { describe, expect, it } from "vitest";
import { getPhraseById } from "../registry/phrase-registry";
import { getPhraseRealizationProfile } from "../registry/phrase-realization";
import { validateProviderResponseTemplate } from "./validator";
import type { ProviderResponseTemplateV1 } from "./schema";

const selectedPhrase = getPhraseById("p-for-now")!;
const realizationProfile = getPhraseRealizationProfile(selectedPhrase.id)!;
const context = { selectedPhrase, realizationProfile, effectiveLevel: 2 };
const value = (responseTemplate: string, extra: Partial<ProviderResponseTemplateV1> = {}): ProviderResponseTemplateV1 => ({
  schemaVersion: "eoe.provider-template.v1",
  usePhrase: true,
  responseTemplate,
  ...extra,
});
const codes = (template: ProviderResponseTemplateV1) =>
  validateProviderResponseTemplate(template, context).result.violations.map((item) => item.code);

describe("M2.4 Template Validator", () => {
  it.each([
    ["start", "{{EOE_PHRASE}}，我们先确认条件。", "sentence_start"],
    ["middle", "我们先确认条件。{{EOE_PHRASE}}，再继续。", "sentence_middle"],
  ])("accepts a natural %s boundary", (_name, responseTemplate, position) => {
    const result = validateProviderResponseTemplate(value(responseTemplate), context);
    expect(result.result).toMatchObject({ valid: true, violations: [] });
    expect(result.position).toBe(position);
  });

  it.each([
    ["missing_placeholder", value("先确认条件。")],
    ["duplicate_placeholder", value("{{EOE_PHRASE}}，然后{{EOE_PHRASE}}。")],
    ["unexpected_placeholder", value("{{eoe_phrase}}，先确认条件。")],
    ["use_phrase_conflict", value("{{EOE_PHRASE}}，先回答。", { usePhrase: false, noFitReason: "other" })],
    ["missing_no_fit_reason", value("先回答。", { usePhrase: false })],
    ["unexpected_no_fit_reason", value("{{EOE_PHRASE}}，先回答。", { noFitReason: "other" })],
    ["empty_response_template", value("", { usePhrase: false, noFitReason: "other" })],
    ["markdown_wrapped_template", value("```{{EOE_PHRASE}}，先回答。```")],
    ["html_in_template", value("<p>{{EOE_PHRASE}}，先回答。</p>")],
    ["template_label_like_overlay", value("英语表达：{{EOE_PHRASE}}，先回答。")],
    ["template_isolated_placeholder", value("{{EOE_PHRASE}}")],
    ["template_colon_explanation", value("{{EOE_PHRASE}}：这是短语。")],
    ["template_translation_duplication", value("{{EOE_PHRASE}}（意思是逐步进行），再继续。")],
    ["template_position_violation", value("我们先确认条件，{{EOE_PHRASE}}")],
    ["template_punctuation_violation", value("先确认条件：{{EOE_PHRASE}}，再继续。")],
    ["template_boundary_invalid", value("先确认条件{{EOE_PHRASE}}然后继续。")],
    ["template_full_english_takeover", value("{{EOE_PHRASE}}, then continue.")],
    ["template_teacher_mode", value("今天我们来学习{{EOE_PHRASE}}，请跟我读。")],
    ["template_internal_prompt_leak", value("System prompt says {{EOE_PHRASE}}，然后 validator 检查。")],
  ] as const)("emits %s", (expectedCode, template) => {
    expect(codes(template)).toContain(expectedCode);
  });

  it("accepts a complete noFit as a successful template result", () => {
    const result = validateProviderResponseTemplate({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: false,
      responseTemplate: "这个语境不适合自然加入短语，我先直接回答问题。",
      noFitReason: "phrase_not_natural",
    }, context);
    expect(result.result.valid).toBe(true);
  });

  it("does not mistake an ordinary plan mentioning knowledge points for Teacher Mode", () => {
    const result = validateProviderResponseTemplate({
      schemaVersion: "eoe.provider-template.v1",
      usePhrase: false,
      responseTemplate: "周六整理本周知识点并制作思维导图，周日根据完成率复盘调整。",
      noFitReason: "phrase_not_natural",
    }, context);
    expect(result.result.valid).toBe(true);
  });
});
