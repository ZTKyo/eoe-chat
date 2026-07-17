import type {
  Phrase,
  PhraseRealizationProfile,
  RealizationPosition,
  ValidationResult,
} from "@/domain/eoe";
import { EOE_PHRASE_PLACEHOLDER, type ProviderResponseTemplateV1 } from "./schema";

export interface ProviderTemplateValidationContext {
  selectedPhrase?: Phrase;
  realizationProfile?: PhraseRealizationProfile;
  effectiveLevel: number;
  allowedNoFitReasons?: string[];
  assistanceActive?: boolean;
  historicalReplay?: boolean;
}

export interface ProviderTemplateValidationResult {
  result: ValidationResult;
  position?: RealizationPosition;
}

function placeholderCount(value: string): number {
  return value.split(EOE_PHRASE_PLACEHOLDER).length - 1;
}

function boundaryPosition(before: string, after: string): RealizationPosition | undefined {
  const hasBefore = before.trim().length > 0;
  const hasAfter = after.trim().length > 0;
  if (!hasBefore && !hasAfter) return undefined;
  if (!hasBefore) return "sentence_start";
  if (!hasAfter) return "sentence_end";
  return "sentence_middle";
}

export function validateProviderResponseTemplate(
  template: ProviderResponseTemplateV1,
  context: ProviderTemplateValidationContext,
): ProviderTemplateValidationResult {
  const violations: ValidationResult["violations"] = [];
  const seen = new Set<string>();
  const add = (code: string, details?: string) => {
    const key = `${code}\u0000${details ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ code, severity: "error", details });
  };
  const text = template.responseTemplate;
  const count = placeholderCount(text);
  const placeholderTokens = text.match(/\{\{[^{}]*\}\}/gu) ?? [];
  const unexpectedTokens = placeholderTokens.filter((token) => token !== EOE_PHRASE_PLACEHOLDER);

  if (text.trim().length === 0) add("empty_response_template");
  if (/^\s*```|```\s*$/u.test(text)) add("markdown_wrapped_template");
  if (/<\/?[a-z][^>]*>/iu.test(text)) add("html_in_template");
  if (unexpectedTokens.length > 0 || /\{\{\s*EOE[_ -]?PHRASE\s*\}\}/iu.test(text.replaceAll(EOE_PHRASE_PLACEHOLDER, ""))) {
    add("unexpected_placeholder", unexpectedTokens.join(",") || "placeholder spelling mismatch");
  }

  if (template.usePhrase) {
    if (count === 0) add("missing_placeholder");
    if (count > 1) add("duplicate_placeholder", `count=${count}`);
    if (template.noFitReason !== undefined) add("unexpected_no_fit_reason");
    if (!context.selectedPhrase || !context.realizationProfile) add("use_phrase_conflict", "no Engine-selected Phrase");
  } else {
    if (count > 0) add("use_phrase_conflict", "usePhrase=false with placeholder");
    if (template.noFitReason === undefined) add("missing_no_fit_reason");
    if (template.noFitReason && context.allowedNoFitReasons && !context.allowedNoFitReasons.includes(template.noFitReason)) {
      add("no_fit_reason_mismatch", `${template.noFitReason} not in ${context.allowedNoFitReasons.join(",")}`);
    }
  }

  if (/\b(system prompt|developer message|EOE_STATE|candidate ids?|phrase ids?|validator|directive)\b/iu.test(text) || /系统提示词|内部规则|候选短语|验证器/u.test(text)) {
    add("template_internal_prompt_leak");
  }
  if (/今天(?:我们)?(?:来)?学习|记住这个(?:词|短语)|跟我读|练习造句|知识点\s*[：:]|小测验/u.test(text) || (!context.assistanceActive && /音标|发音是/u.test(text))) {
    add("template_teacher_mode");
  }

  if (template.usePhrase && count === 1) {
    const [before, after] = text.split(EOE_PHRASE_PLACEHOLDER);
    const position = boundaryPosition(before, after);
    const compactBefore = before.trimEnd();
    const compactAfter = after.trimStart();

    if (!position || (!context.realizationProfile?.canBeWholeClause && !before.trim() && !after.trim())) {
      add("template_isolated_placeholder");
    }
    if (position && context.realizationProfile && !context.realizationProfile.allowedPositions.includes(position)) {
      add("template_position_violation", `position=${position}`);
    }
    if (context.realizationProfile && !context.assistanceActive && !context.historicalReplay) {
      const betaFrame = context.realizationProfile.betaFrame;
      if (!betaFrame.autoLiveSafe) {
        add("beta_frame_not_auto_live_safe");
      }
      if (position === "sentence_middle" && !/[。！？.!?]\s*$/u.test(compactBefore)) {
        add("beta_frame_chinese_internal_slot", "automatic Phrase must start after a complete sentence boundary");
      }
      if (betaFrame.requiresFollowingClause) {
        const followingClause = compactAfter.replace(/^[\s，,。.!！？?；;：:]+/u, "").trim();
        if (!/[\u3400-\u9fff]/u.test(followingClause)) {
          add("beta_frame_following_clause_missing");
        }
      }
      if (
        betaFrame.allowedFrameTypes.includes("standalone_reaction") &&
        !betaFrame.allowedFrameTypes.includes("sentence_initial_connector") &&
        !/^\s*[。.!！？?]/u.test(compactAfter)
      ) {
        add("beta_frame_reaction_not_standalone");
      }
      if (context.selectedPhrase?.id === "p-for-example") {
        if (/(?:例如|比如|举例)(?:来说)?[，,:：]?\s*$/u.test(compactBefore)) {
          add("beta_frame_duplicate_example_marker");
        }
        if (/^\s*[，,]\s*(?:下面|接下来|我们来看)(?:一个)?例/u.test(compactAfter)) {
          add("beta_frame_example_content_missing");
        }
      }
    }
    if (/(?:英语|英文|推荐)?(?:表达|短语|phrase)\s*[：:]?\s*$/iu.test(compactBefore)) {
      add("template_label_like_overlay");
    }
    if (/[：:]\s*$/u.test(compactBefore) || /^\s*[：:]/u.test(compactAfter)) {
      add("template_colon_explanation");
    }
    if (/^\s*[（(]?(?:意思是|也就是|中文(?:意思)?是|表示|即)/u.test(compactAfter) || /(?:意思是|也就是|中文(?:意思)?是)\s*$/u.test(compactBefore)) {
      add("template_translation_duplication");
    }
    if (context.selectedPhrase) {
      const surfaces = [context.selectedPhrase.canonical, ...context.selectedPhrase.variants];
      if (surfaces.some((surface) => surface && text.toLocaleLowerCase().includes(surface.toLocaleLowerCase()))) {
        add("template_translation_duplication", "selected phrase content must not be emitted by Provider");
      }
    }
    if (context.realizationProfile) {
      const beforeCharacter = compactBefore.at(-1) ?? "";
      const afterCharacter = compactAfter.at(0) ?? "";
      if (context.realizationProfile.forbiddenBeforePunctuation.includes(beforeCharacter)) {
        add("template_punctuation_violation", `before=${beforeCharacter}`);
      }
      if (context.realizationProfile.forbiddenAfterPunctuation.includes(afterCharacter)) {
        add("template_punctuation_violation", `after=${afterCharacter}`);
      }
      if (context.realizationProfile.requiresChineseConnectorBefore && !/[\u3400-\u9fff]\s*$/u.test(compactBefore)) {
        add("template_boundary_invalid", "Chinese connector required before placeholder");
      }
      if (context.realizationProfile.requiresChineseConnectorAfter && !/^\s*[\u3400-\u9fff]/u.test(compactAfter)) {
        add("template_boundary_invalid", "Chinese connector required after placeholder");
      }
    }

    const safeBefore = !compactBefore || /[\s，。！？；、（“‘）”’]$/u.test(before);
    const safeAfter = !compactAfter || /^[\s，。！？；、（“‘]/u.test(after);
    if (!safeBefore || !safeAfter) add("template_boundary_invalid");

    const withoutPlaceholder = text.replace(EOE_PHRASE_PLACEHOLDER, "");
    if (context.effectiveLevel < 6 && !/[\u3400-\u9fff]/u.test(withoutPlaceholder)) {
      add("template_full_english_takeover");
    }

    const errors = violations.length;
    return {
      result: { valid: errors === 0, violations, retryable: errors > 0 },
      position,
    };
  }

  if (context.effectiveLevel < 6 && text.trim() && !/[\u3400-\u9fff]/u.test(text)) {
    add("template_full_english_takeover");
  }
  return {
    result: { valid: violations.length === 0, violations, retryable: violations.length > 0 },
  };
}
