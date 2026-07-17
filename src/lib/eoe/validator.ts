import { generatedResponseSchema, segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type {
  CandidateSelection,
  ConversationAnalysis,
  OverlayDecision,
  PhrasePosition,
  ValidationResult,
} from "@/domain/eoe";
import { getPhraseById, isRegistryPhrase } from "./registry/phrase-registry";
import { getPhraseRealizationProfile } from "./registry/phrase-realization";
import { classifyMessageSegments } from "./technical-segment-classification";

export interface ValidationContext {
  analysis: ConversationAnalysis;
  decision: OverlayDecision;
  selection: CandidateSelection;
  assistanceActive?: boolean;
  historicalReplay?: boolean;
}

export interface ValidatedResponse {
  result: ValidationResult;
  response?: GeneratedResponse;
}

function segmentPosition(index: number, total: number): PhrasePosition {
  if (total === 1) return "standalone";
  if (index === 0) return "sentence_start";
  if (index === total - 1) return "sentence_end";
  return "sentence_middle";
}

export function validateStructuredResponse(raw: unknown, context: ValidationContext): ValidatedResponse {
  const violations: ValidationResult["violations"] = [];
  const seen = new Set<string>();
  const add = (code: string, severity: "error" | "warning" = "error", details?: string) => {
    const key = `${code}\u0000${details ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({ code, severity, details });
  };

  const parsed = generatedResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;
    const segments = Array.isArray(record?.segments) ? record.segments : undefined;
    if (segments?.length === 0) add("empty_response");
    if (
      segments?.some(
        (segment) =>
          segment &&
          typeof segment === "object" &&
          (segment as { type?: unknown }).type === "text" &&
          !["zh", "other"].includes(String((segment as { language?: unknown }).language)),
      )
    ) {
      add("invalid_language_tag");
    }
    add("broken_structured_output", "error", parsed.error.issues[0]?.message);
    return { result: { valid: false, violations, retryable: true } };
  }

  const response = parsed.data;
  const semanticClassifications = classifyMessageSegments(response.segments);
  const englishSegments = response.segments.filter((segment) => segment.type === "english_chunk");
  const assistanceSegments = response.segments.filter((segment) => segment.type === "assistance_phrase");
  const text = segmentsToPlainText(response.segments);

  for (const segment of assistanceSegments) {
    const phrase = getPhraseById(segment.phraseId);
    if (!context.assistanceActive) add("unsolicited_definition", "error", "assistance_phrase outside requested assistance");
    if (!phrase) add("invalid_phrase_id", "error", segment.phraseId);
    if (context.selection.selectedPhraseId !== segment.phraseId) add("phrase_not_selected", "error", segment.phraseId);
    if (phrase && segment.content.toLocaleLowerCase() !== phrase.canonical.toLocaleLowerCase()) {
      add("phrase_not_selected", "error", "assistance phrase must use Registry canonical surface");
    }
    if (phrase && segment.pronunciation !== phrase.pronunciation) {
      add("unsolicited_pronunciation", "error", "assistance pronunciation must come from Registry");
    }
  }
  if (context.assistanceActive && assistanceSegments.length !== 1) {
    add("broken_structured_output", "error", "assistance response requires exactly one assistance_phrase segment");
  }

  if (response.segments.length === 0 || text.trim().length === 0) add("empty_response");
  if (response.conversationFunction !== context.analysis.primaryFunction) {
    add("conversation_function_changed", "error", `${response.conversationFunction} != ${context.analysis.primaryFunction}`);
  }
  if (response.intentPreserved === false) add("conversation_function_changed", "error", "intentPreserved=false");

  for (const segment of englishSegments) {
    if (!isRegistryPhrase(segment.phraseId)) {
      add("invalid_phrase_id", "error", segment.phraseId);
      continue;
    }
    if (!context.selection.selectedPhraseId || segment.phraseId !== context.selection.selectedPhraseId) {
      add("phrase_not_selected", "error", segment.phraseId);
    }
    const phrase = getPhraseById(segment.phraseId);
    if (phrase && ![phrase.canonical, ...phrase.variants].some(
      (surface) => surface.toLocaleLowerCase() === segment.content.toLocaleLowerCase(),
    )) {
      add("phrase_not_selected", "error", "english_chunk content does not match selected Registry phrase");
    }
    if (phrase?.status !== "active") add("forced_overlay", "error", `${segment.phraseId} is disabled`);
  }

  response.segments.forEach((segment, index) => {
    if (segment.type !== "english_chunk") return;
    const previous = response.segments[index - 1];
    const next = response.segments[index + 1];
    const position = segmentPosition(index, response.segments.length);
    const phrase = getPhraseById(segment.phraseId);
    const candidate = context.selection.candidates.find((item) => item.phraseId === segment.phraseId);
    const realizationProfile = getPhraseRealizationProfile(segment.phraseId);
    const previousText = previous?.type === "text" ? previous.content : "";
    const nextText = next?.type === "text" ? next.content : "";

    if (!candidate?.allowedPositions.includes(position) || position === "standalone") {
      add("orphan_english_chunk", "error", `unsupported semantic position=${position}`);
      add("unnatural_segment_boundary", "error", `position=${position}`);
    }

    if (/[:：]\s*$/u.test(previousText) || /^\s*[:：]/u.test(nextText)) {
      add("label_like_overlay", "error", "colon adjacent to english_chunk");
      add("punctuation_boundary_error", "error", "colon boundary is not allowed");
    }
    if (/(?:英语|英文|表达|短语|phrase)\s*$/iu.test(previousText)) {
      add("label_like_overlay", "error", "english_chunk is introduced as a label");
    }

    const safeBefore = previousText.length === 0 || /[\s，。！？；、（“‘—]$/u.test(previousText);
    const safeAfter = nextText.length === 0 || /^[\s，。！？；、）”’—]/u.test(nextText);
    if (!safeBefore || !safeAfter) {
      add("punctuation_boundary_error", "error", "adjacent text must preserve whitespace or compatible punctuation");
      add("unnatural_segment_boundary", "error", "plain text boundary is syntactically discontinuous");
    }
    if (/\s{2,}$/u.test(previousText) || /^\s{2,}/u.test(nextText)) {
      add("punctuation_boundary_error", "error", "repeated boundary whitespace");
    }
    if (/\n\s*$/u.test(previousText) || /^\s*\n/u.test(nextText)) {
      add("isolated_learning_card_style", "error", "english_chunk is isolated by a line break");
    }

    if (candidate && !candidate.allowedPositions.includes(position)) {
      add("phrase_position_violation", "error", `${segment.phraseId} cannot appear at ${position}`);
    }
    if (realizationProfile && position !== "standalone" && !realizationProfile.allowedPositions.includes(position)) {
      add("phrase_position_violation", "error", `${segment.phraseId} realization profile mismatch`);
    }
    if (
      !context.historicalReplay &&
      realizationProfile?.betaFrame.autoLiveSafe &&
      position === "sentence_middle" &&
      !/[。！？.!?]\s*$/u.test(previousText.trimEnd())
    ) {
      add("beta_frame_chinese_internal_slot", "error", `${segment.phraseId} is inside a Chinese grammar slot`);
    }
    if (
      !context.historicalReplay &&
      realizationProfile?.betaFrame.allowedFrameTypes.includes("standalone_reaction") &&
      !realizationProfile.betaFrame.allowedFrameTypes.includes("sentence_initial_connector") &&
      !/^\s*[。.!！？?]/u.test(nextText)
    ) {
      add("beta_frame_reaction_not_standalone", "error", segment.phraseId);
    }
    if (
      !context.historicalReplay &&
      realizationProfile?.capitalizeAtSentenceStart &&
      (position === "sentence_start" || /[。！？.!?]\s*$/u.test(previousText.trimEnd())) &&
      /^[a-z]/u.test(segment.content)
    ) {
      add("phrase_capitalization_error", "error", `${segment.phraseId} must be capitalized at sentence_start`);
    }
    if (
      !context.historicalReplay &&
      segment.phraseId === "p-for-example" &&
      /(?:例如|比如|举例)(?:来说)?[，,:：]?\s*$/u.test(previousText)
    ) {
      add("beta_frame_duplicate_example_marker", "error");
    }
    const clauseSupport = nextText
      .replace(/^[\s，。！？；、）”’—]+/u, "")
      .trim();
    const clauseStemUnsupported = phrase?.grammaticalRole === "clause_stem" && (
      realizationProfile?.requiresClauseSupport !== true ||
      !/[\u3400-\u9fff]/u.test(clauseSupport) ||
      /^(?:先给出|再说明|下面(?:将|来)|这里(?:先|将)|我会先)(?:明确)?(?:判断|理由|回答|分析)/u.test(clauseSupport)
    );
    if (!candidate || candidate.grammaticalFit === "low" || clauseStemUnsupported) {
      add("grammatical_role_mismatch", "error", `${segment.phraseId} lacks a safe bilingual grammatical frame`);
    }
    if (phrase?.requiresCopula && !/(?:是|作为|当作)\s*$/u.test(previousText)) {
      add("grammatical_role_mismatch", "error", `${segment.phraseId} requires copula support`);
    }
    if (context.selection.noFit || context.decision.mode === "skip" || candidate?.labelLikeRisk === 1) {
      add("forced_overlay", "error", "overlay was used without an eligible selected candidate");
    }

    if (
      /(?:也就是|意思是|中文(?:意思)?是|英文(?:表达)?是|可以说成)\s*$/u.test(previousText) ||
      /^\s*[（(]?(?:也就是|意思是|即|中文(?:意思)?是)/u.test(nextText)
    ) {
      add("duplicated_translation", "error", "english_chunk is paired with a direct Chinese translation");
    }
    if (
      response.segments.length === 1 ||
      (previousText.length > 0 && /(?:^|\n)\s*(?:[-*•]|\d+[.)、])?\s*(?:英语|英文|表达|短语)?\s*$/iu.test(previousText))
    ) {
      add("isolated_learning_card_style", "error", "english_chunk resembles a heading or learning card");
    }
  });

  const newCount = englishSegments.filter((segment) => segment.isNew).length;
  if (newCount > context.decision.maxNewFocus) add("excessive_new_content");
  if (englishSegments.length > context.decision.maxEnglishSegments) add("overlay_budget_exceeded");
  if (context.decision.mode === "skip" && englishSegments.length > 0) add("overlay_budget_exceeded", "error", "scheduler skipped overlay");
  if (englishSegments.length === 0 && !response.noFit && !context.assistanceActive) {
    add("forced_overlay", "error", "no english_chunk requires noFit=true outside explicit assistance");
  }

  const chineseText = response.segments
    .filter((segment) => segment.type === "text" && segment.language === "zh")
    .map((segment) => segment.content)
    .join("");
  if (englishSegments.length > 0 && !/[\u3400-\u9fff]/u.test(chineseText) && context.decision.effectiveLevel < 6) {
    add("full_english_takeover_before_ready");
  }
  const overlayNeighborhoods = response.segments.flatMap((segment, index) => {
    if (segment.type !== "english_chunk") return [];
    return [
      response.segments
        .slice(Math.max(0, index - 1), index + 2)
        .map((part) => part.content)
        .join(""),
    ];
  });
  if (
    !context.assistanceActive &&
    semanticClassifications.some((item) => item.role === "english_overlay") &&
    overlayNeighborhoods.some((value) =>
      /（?\s*(?:意思是|中文是|也就是指)|\(\s*(?:meaning|means)\b/iu.test(value))
  ) {
    add("automatic_gloss");
  }
  if (!context.assistanceActive && /音标|发音(?:是|为)|\/[a-zæɑɔəɪʊʌθðʃʒŋː' -]{2,}\//iu.test(text)) add("unsolicited_pronunciation");
  if (!context.assistanceActive && /(?:这个|该)(?:英文)?(?:词|短语|表达).{0,12}(?:意思|表示|意味着|定义)/u.test(text)) add("unsolicited_definition");
  if (/今天(?:我们)?(?:来)?学习|记住这个(?:词|短语)|跟我读|练习造句|知识点\s*[：:]|小测验/u.test(text)) add("teacher_mode");
  if (/你(?:刚才|原来)的(?:话|意思).{0,12}(?:翻译|用英文)|翻译成英文是|用英文可以说/u.test(text)) add("translation_mode");
  if (/system prompt|系统提示词|内部规则|候选短语|EOE_STATE|validator|directive/iu.test(text)) add("internal_prompt_leak");
  if (/<\/?[a-z][^>]*>/iu.test(text)) add("broken_structured_output", "error", "HTML is not allowed");

  for (let index = 1; index < response.segments.length; index += 1) {
    const previous = response.segments[index - 1];
    const current = response.segments[index];
    if (previous.type === current.type && previous.content === current.content) add("duplicate_segment");
  }

  const errors = violations.filter((violation) => violation.severity === "error");
  return {
    result: { valid: errors.length === 0, violations, retryable: errors.length > 0 },
    response: errors.length === 0 ? response : undefined,
  };
}

export interface SoftValidator {
  validate(response: GeneratedResponse, context: ValidationContext): Promise<ValidationResult>;
}
