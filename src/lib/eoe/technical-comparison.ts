import type { TechnicalConceptComparisonRequirements } from "@/domain/eoe";

const comparisonSignal = /区别|差异|不同|比较|对比|\bvs\.?\b|\bversus\b/iu;
const languageContextTerms = new Set([
  "typescript",
  "javascript",
  "python",
  "java",
  "react",
  "node",
  "next.js",
]);

export interface TechnicalComparisonReview {
  hardIssues: string[];
  softWarnings: string[];
}

export function analyzeTechnicalConceptComparisonRequirements(
  message: string,
  technicalTerms: string[],
): TechnicalConceptComparisonRequirements | undefined {
  if (!comparisonSignal.test(message)) return undefined;
  const distinct = [...new Set(technicalTerms.map((term) => term.trim()).filter(Boolean))];
  const subjectConcepts = distinct.filter(
    (term) => !languageContextTerms.has(term.toLocaleLowerCase()),
  );
  const concepts = subjectConcepts.length >= 2 ? subjectConcepts : distinct;
  if (concepts.length < 2) return undefined;
  return {
    concepts,
    needsCoreDifference: true,
    needsSafetyDifference: true,
    needsUsagePrecondition: true,
    needsPracticalRecommendation: true,
    needsExample: false,
  };
}

function hasAnyExplanation(text: string): boolean {
  return /\bany\b/iu.test(text) &&
    /绕过|跳过|关闭|禁用|停用|放弃|失去|不再检查|类型检查失效|任意操作|任何操作|直接使用|直接访问|直接调用/u.test(text);
}

function hasUnknownExplanation(text: string): boolean {
  return /\bunknown\b/iu.test(text) &&
    /顶层类型|未知类型|不能直接|不可直接|使用前|访问前|调用前|需要|必须|强制|先检查|先验证|先确认|收窄|\bnarrowing\b|类型守卫|\btype\s+guard\b|\btypeof\b|\binstanceof\b|断言|\bassertion\b/iu.test(text);
}

function hasUsagePrecondition(text: string): boolean {
  return /\bunknown\b/iu.test(text) &&
    /收窄|\bnarrowing\b|类型守卫|\btype\s+guard\b|\btypeof\b|\binstanceof\b|明确断言|\bassertion\b|先验证|先检查|先确认|使用前(?:需要|必须|应当)?(?:验证|检查|确认|收窄|守卫|断言)/iu.test(text);
}

function hasSafetyDifference(text: string): boolean {
  if (!/\bunknown\b/iu.test(text) || !/\bany\b/iu.test(text)) return false;
  return /更安全|安全性更高|保留类型安全|保留了类型安全|类型安全性更强/u.test(text);
}

function hasPracticalRecommendation(text: string): boolean {
  const unknownRecommended = /\bunknown\b/iu.test(text) &&
    /优先|建议|默认选择|通常使用|适合|外部数据|类型不确定/u.test(text);
  const anyBounded = /\bany\b/iu.test(text) &&
    /仅在|只在|临时|原型|迁移|不得已|明确接受|失去类型安全/u.test(text);
  return unknownRecommended && anyBounded;
}

export function reviewTechnicalConceptComparison(input: {
  text: string;
  requirements: TechnicalConceptComparisonRequirements;
}): TechnicalComparisonReview {
  const hardIssues: string[] = [];
  const softWarnings: string[] = [];
  const normalized = input.text.toLocaleLowerCase();
  for (const concept of input.requirements.concepts) {
    if (!normalized.includes(concept.toLocaleLowerCase())) {
      hardIssues.push(`technical_concept_missing:${concept.toLocaleLowerCase()}`);
    }
  }
  if (/完全相同|没有区别|毫无差异/u.test(input.text)) {
    hardIssues.push("technical_concepts_incorrect_or_equated");
  }

  const unknownAny =
    input.requirements.concepts.some((item) => item.toLocaleLowerCase() === "unknown") &&
    input.requirements.concepts.some((item) => item.toLocaleLowerCase() === "any");
  if (unknownAny) {
    const anyExplained = hasAnyExplanation(input.text);
    const unknownExplained = hasUnknownExplanation(input.text);
    if (!anyExplained) hardIssues.push("technical_any_behavior_missing");
    if (!unknownExplained) hardIssues.push("technical_unknown_explanation_missing");
    if (input.requirements.needsCoreDifference && (!anyExplained || !unknownExplained)) {
      hardIssues.push("technical_core_difference_missing");
    }
    if (input.requirements.needsUsagePrecondition && !hasUsagePrecondition(input.text)) {
      softWarnings.push("technical_unknown_narrowing_missing");
    }
    if (input.requirements.needsSafetyDifference && !hasSafetyDifference(input.text)) {
      softWarnings.push("technical_unknown_safety_missing");
    }
    if (input.requirements.needsPracticalRecommendation && !hasPracticalRecommendation(input.text)) {
      softWarnings.push("technical_usage_advice_missing");
    }
  }
  if (input.requirements.needsExample && !/例如|比如|举例|for example/iu.test(input.text)) {
    softWarnings.push("technical_example_missing");
  }

  return {
    hardIssues: [...new Set(hardIssues)],
    softWarnings: [...new Set(softWarnings)],
  };
}
