import { segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type {
  ConversationAnalysis,
  ResponseObligation,
  ResponseObligationKind,
  TaskCompletenessReview,
} from "@/domain/eoe";
import { EOE_TASK_COMPLETENESS_VERSION } from "./constants";
import {
  analyzeComparisonDecisionRequirements,
  reviewComparisonDecisionRequirements,
} from "./comparison-requirements";
import type { ConversationContext } from "./conversation-context";
import {
  analyzeDailyAdviceRequirements,
  isDailyAdviceRequest,
  reviewDailyAdviceRequirements,
} from "./daily-advice-requirements";
import { analyzePlanRequirements, reviewPlanRequirements } from "./plan-requirements";
import { analyzeResponseDepth, reviewResponseDepth } from "./response-depth";
import {
  extractTechnicalTerms,
  reviewTechnicalDistinction,
} from "./technical-segment-classification";
import {
  analyzeTechnicalConceptComparisonRequirements,
  reviewTechnicalConceptComparison,
} from "./technical-comparison";

const planPattern = /计划|安排|日程|下周|每天|阶段/u;
const comparisonPattern = /两个方案|两种方案|如何选择|怎么选|比较|对比|拿不定主意|权衡|取舍/u;
const explicitChinesePattern = /只用中文|请用中文|不要英文|全中文/u;
const nonAnsweringTemplatePattern =
  /先抓住核心关系：确认现象、找出直接原因|你把具体例子或报错补充出来|可以从目标、现状和限制三个方面继续展开|这次生成的回复没有通过质量检查/u;

function obligation(kind: ResponseObligationKind, description: string, minimumEvidence?: string[]): ResponseObligation {
  return { id: `obligation-${kind}`, kind, description, required: true, minimumEvidence };
}

export function analyzeResponseObligations(input: {
  userMessage: string;
  analysis: ConversationAnalysis;
  hasImage: boolean;
  context: ConversationContext;
}): ResponseObligation[] {
  const result: ResponseObligation[] = [];
  const add = (value: ResponseObligation) => {
    if (!result.some((item) => item.kind === value.kind)) result.push(value);
  };

  if (input.context.contextualAcknowledgement?.active) {
    add(obligation(
      "contextual_acknowledgement",
      "Acknowledge briefly while preserving the established topic; do not reset to a greeting.",
    ));
    add(obligation("continue_context", "Continue the established topic only when a next step is naturally needed."));
  } else {
    add(obligation("answer_question", "Directly answer the user's actual request."));
  }
  // An explicit Vocabulary Assistance turn has its own concrete obligations.
  // The surface wording often classifies as "explain", but adding a generic
  // causal-explanation contract would replace the requested contextual gloss.
  if (input.context.assistance) {
    if (explicitChinesePattern.test(input.userMessage) || input.context.chineseOnlyScope) {
      add(obligation("respect_language_request", "Use Chinese only, except a user-requested quoted Phrase in Vocabulary Assistance."));
    }
    add(obligation("clarify_prior_phrase", "Resolve the actual prior Phrase from message history; do not invent or deny context.", ["source_sentence", "pronunciation_or_requested_detail", "contextual_meaning"]));
    if (input.context.assistance.resolved) {
      add(obligation("continue_context", "After brief assistance, return to the original topic."));
    }
    return result;
  }
  if (input.analysis.primaryFunction === "explain") {
    const technicalTerms = input.analysis.sensitivity === "technical"
      ? extractTechnicalTerms(input.userMessage)
      : undefined;
    add({
      ...obligation("explain_concept", "Explain the cause, mechanism, or meaningful distinction.", ["cause_or_mechanism"]),
      technicalTerms,
      technicalComparisonRequirements: technicalTerms
        ? analyzeTechnicalConceptComparisonRequirements(input.userMessage, technicalTerms)
        : undefined,
    });
    add(obligation("provide_reasons", "Give reasons tied to the user's concrete situation."));
  }
  const responseDepthProfile = analyzeResponseDepth(input.userMessage);
  if (responseDepthProfile.level === "detailed") {
    add({
      ...obligation(
        "provide_detailed_analysis",
        "Cover the named factors, explain their interactions and trade-offs, and give a synthesis.",
      ),
      responseDepthProfile,
    });
  }
  if (input.analysis.primaryFunction === "advise") {
    if (isDailyAdviceRequest(input.userMessage)) {
      const dailyAdviceRequirements = analyzeDailyAdviceRequirements(input.userMessage);
      add({
        ...obligation(
          "provide_daily_advice",
          "Provide concrete daily-life advice proportionate to this request.",
          ["concrete_action", "start_condition", "adjustment_option"],
        ),
        dailyAdviceRequirements,
      });
    } else if (planPattern.test(input.userMessage)) {
      const planRequirements = analyzePlanRequirements(input.userMessage);
      add({
        ...obligation("provide_plan", "Provide an actionable plan proportionate to this request.", ["timeline", "stage_structure", "task_assignment", "priority", "feedback_loop"]),
        planRequirements,
      });
    } else if (comparisonPattern.test(input.userMessage)) {
      const comparisonRequirements = analyzeComparisonDecisionRequirements(input.userMessage);
      add({
        ...obligation(
          "compare_options",
          "Provide a usable, proportionate way to compare and decide.",
          ["dimensions", "user_priority", "tradeoff", "recording", "next_action"],
        ),
        comparisonRequirements,
      });
    } else {
      add(obligation("provide_steps", "Give concrete, usable next steps."));
    }
  }
  if (input.hasImage || input.analysis.primaryFunction === "analyze_image") {
    add(obligation("analyze_image", "Use actual visible image evidence and distinguish observation from inference or uncertainty.", ["visible_evidence", "epistemic_boundary", "answer_specific_question"]));
  }
  if (input.analysis.primaryFunction === "empathize") {
    add(obligation("acknowledge_emotion", "Acknowledge the user's emotion before advice."));
  }
  if (explicitChinesePattern.test(input.userMessage) || input.context.chineseOnlyScope) {
    add(obligation("respect_language_request", "Use Chinese only, except a user-requested quoted Phrase in Vocabulary Assistance."));
  }
  return result;
}

function checkImage(text: string): string[] {
  const visible = /图(?:片|中|里)|画面|可见|显示|看到|界面/u.test(text) &&
    /颜色|文字|按钮|图形|人物|物体|左侧|右侧|上方|下方|中央|背景|矩形|圆形|标题|数字/u.test(text);
  const boundary = /明确可见|可以确认|观察到|可能|推测|似乎|无法确定|看不清/u.test(text);
  return [visible ? undefined : "visible_evidence", boundary ? undefined : "epistemic_boundary"]
    .filter((item): item is string => Boolean(item));
}

function observationReferenced(
  text: string,
  observation: import("@/domain/eoe").VisionObservationEnvelopeV1,
): boolean {
  if (observation.visibleText.some((item) => text.toLocaleLowerCase().includes(item.toLocaleLowerCase()))) return true;
  const response = text.toLocaleLowerCase();
  return observation.observations.some((item) => {
    const description = item.description.toLocaleLowerCase();
    if (response.includes(description)) return true;
    const compact = description.replace(/[\s，。！？；、：,.!?;:()（）“”'"-]/gu, "");
    const pairs = new Set<string>();
    for (let index = 0; index < compact.length - 1; index += 1) pairs.add(compact.slice(index, index + 2));
    const overlap = [...pairs].filter((part) => response.includes(part));
    return overlap.length >= 2;
  });
}

export function reviewTaskCompleteness(input: {
  response: GeneratedResponse;
  obligations: ResponseObligation[];
  analysis: ConversationAnalysis;
  context: ConversationContext;
  visionObservation?: import("@/domain/eoe").VisionObservationEnvelopeV1;
}): TaskCompletenessReview {
  const text = segmentsToPlainText(input.response.segments).trim();
  const fulfilled: string[] = [];
  const missing: string[] = [];
  const issues: string[] = [];

  for (const item of input.obligations) {
    let itemIssues: string[] = [];
    switch (item.kind) {
      case "answer_question":
        if (!text || /^(?:收到|好的|可以|明白)[。！]?$/u.test(text)) {
          itemIssues = ["empty_or_trivial_answer"];
        } else if (nonAnsweringTemplatePattern.test(text)) {
          itemIssues = ["non_answering_template"];
        }
        break;
      case "provide_plan":
        itemIssues = reviewPlanRequirements(
          text,
          item.planRequirements ?? analyzePlanRequirements("计划"),
        );
        break;
      case "provide_daily_advice":
        itemIssues = reviewDailyAdviceRequirements(
          text,
          item.dailyAdviceRequirements ?? analyzeDailyAdviceRequirements("日常建议"),
        );
        break;
      case "compare_options":
        itemIssues = reviewComparisonDecisionRequirements(
          text,
          item.comparisonRequirements ?? analyzeComparisonDecisionRequirements("比较两个方案"),
        );
        break;
      case "analyze_image":
        itemIssues = input.visionObservation
          ? [
              observationReferenced(text, input.visionObservation) ? undefined : "image_analysis_missing_grounded_observation",
              /明确可见|可以确认|观察到|可能|推测|似乎|无法确定|看不清|不确定/u.test(text)
                ? undefined
                : "image_analysis_missing_epistemic_boundary",
            ].filter((part): part is string => Boolean(part))
          : checkImage(text).map((part) => `image_analysis_missing_${part}`);
        break;
      case "explain_concept":
        if (item.technicalComparisonRequirements) {
          const technicalReview = reviewTechnicalConceptComparison({
            text,
            requirements: item.technicalComparisonRequirements,
          });
          itemIssues.push(...technicalReview.hardIssues, ...technicalReview.softWarnings);
        } else {
          if (!/因为|原因|机制|导致|区别|取决于|触发|意味着/u.test(text)) {
            itemIssues = ["explanation_missing_cause_or_mechanism"];
          }
          itemIssues.push(...reviewTechnicalDistinction(text, item.technicalTerms ?? []));
        }
        break;
      case "acknowledge_emotion":
        if (!/难受|压力|焦虑|失落|理解|辛苦|不容易|情绪/u.test(text)) itemIssues = ["emotion_not_acknowledged"];
        break;
      case "respect_language_request":
        if (input.response.segments.some((segment) => segment.type === "english_chunk") && !input.context.assistance?.resolved) itemIssues = ["explicit_language_request_violated"];
        break;
      case "clarify_prior_phrase":
        if (!input.context.assistance?.resolved) {
          if (input.context.assistance?.referenceResolution.status === "ambiguous") {
            const candidates = input.context.assistance.referenceResolution.candidates;
            if (
              !/哪一个|哪句|具体指/u.test(text) ||
              candidates.some((candidate) =>
                !text.toLocaleLowerCase().includes(candidate.canonical.toLocaleLowerCase()))
            ) {
              itemIssues = ["phrase_clarification_ambiguity_not_resolved"];
            }
          } else if (!/没有找到|没找到|请指出|具体文本/u.test(text)) {
            itemIssues = ["phrase_clarification_context_error"];
          }
        } else {
          const phrase = input.context.assistance.phrase;
          if (phrase && ![phrase.canonical, ...phrase.variants].some((surface) => text.toLocaleLowerCase().includes(surface.toLocaleLowerCase()))) {
            itemIssues.push("assistance_source_sentence_missing");
          }
          if (
            input.context.assistance.trigger === "pronunciation" &&
            !/发音|读作|音标|怎么读/u.test(text)
          ) {
            itemIssues.push("assistance_pronunciation_missing");
          }
          if (
            input.context.assistance.trigger !== "pronunciation" &&
            !/这里|语境|意思|表示|相当于/u.test(text)
          ) {
            itemIssues.push("assistance_contextual_meaning_missing");
          }
        }
        break;
      case "continue_context":
        if (input.context.assistance?.resolved) {
          const topic = input.context.assistance.contextV2?.topicSummary ?? input.context.assistance.topic ?? "";
          const topicTerms = topic.match(/[\u3400-\u9fff]{2,6}/gu)?.slice(0, 8) ?? [];
          const topicSpecific = topicTerms.some((term) => text.includes(term)) ||
            /回到.{1,40}(?:计划|方案|问题|安排|选择|分析)/u.test(text);
          if (!topicSpecific) itemIssues = ["assistance_topic_resume_missing"];
        }
        break;
      case "contextual_acknowledgement":
        if (/你好|您好|请问有什么可以帮|你想讨论什么/u.test(text)) {
          itemIssues = ["context_reset_after_acknowledgement"];
        }
        break;
      case "provide_detailed_analysis": {
        const depth = reviewResponseDepth(
          text,
          item.responseDepthProfile ?? analyzeResponseDepth("详细分析"),
        );
        itemIssues = depth.warnings;
        break;
      }
      case "provide_reasons":
        if (!/因为|原因|所以|因此|从而|导致|取决于|依据|意味着|防止|避免|风险|作用/u.test(text)) {
          itemIssues = ["reasons_missing"];
        }
        break;
      case "provide_steps":
        if (!/先|然后|接着|下一步|第一|第二|1[.、)]|2[.、)]/u.test(text)) itemIssues = ["steps_missing"];
        break;
      default:
        break;
    }
    if (itemIssues.length === 0) fulfilled.push(item.id);
    else {
      missing.push(item.id);
      issues.push(...itemIssues);
    }
  }

  const complete = missing.length === 0;
  return {
    complete,
    confidence: complete ? 0.92 : 0.88,
    fulfilledObligationIds: fulfilled,
    missingObligationIds: missing,
    issues: [...new Set(issues)],
    suggestedAction: complete ? "accept" : "regenerate",
    reviewVersion: EOE_TASK_COMPLETENESS_VERSION,
  };
}
