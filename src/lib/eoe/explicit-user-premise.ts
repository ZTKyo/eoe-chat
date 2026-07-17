import { segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type {
  ExplicitUserPremise,
  PremisePreservationReview,
  ValidationResult,
} from "@/domain/eoe";

const timeValuePattern =
  /([零一二两三四五六七八九十百\d.]+)\s*(小时|分钟|天|周|月|年)/u;
const numericValuePattern =
  /([零一二两三四五六七八九十百\d.]+)\s*(%|％|亿元|万元|美元|人民币|元|个|次)/u;
const premiseSignalPattern =
  /每天|每周|每月|下周|截至|之前|以后|租金|房租|成本|预算|费用|价格|只能|必须|不得|不能|需要|有限|已经|正在|更高|更低|更多|更少|偏好|更喜欢|最看重|如果|只要|除非|前提/u;
const requestOnlyPattern =
  /^(?:我|我们)?(?:该|应该|要)?(?:怎么|如何|怎样)(?:办|做|选|选择|权衡|安排|处理)|^(?:能否|能不能|可以吗)|^(?:请)?(?:详细)?(?:分析|解释|比较|对比|说明|列出|指出|给出|介绍|总结|评估|讨论)/u;

const chineseNumberAlternatives: Record<string, string[]> = {
  零: ["零", "0"],
  一: ["一", "1"],
  二: ["二", "两", "2"],
  两: ["二", "两", "2"],
  三: ["三", "3"],
  四: ["四", "4"],
  五: ["五", "5"],
  六: ["六", "6"],
  七: ["七", "7"],
  八: ["八", "8"],
  九: ["九", "9"],
  十: ["十", "10"],
};

function splitPremiseClauses(message: string): string[] {
  return message
    .split(/[，。；！？!?]+/u)
    .flatMap((part) => part.split(/(?:但是|但|不过|同时)/u))
    .map((part) => part.trim())
    .filter(Boolean);
}

function premiseKind(clause: string): ExplicitUserPremise["kind"] {
  if (timeValuePattern.test(clause) || /每天|每周|每月|下周|截至|之前|以后/u.test(clause)) {
    return "time";
  }
  if (/租金|房租|成本|预算|费用|价格|金额/u.test(clause)) return "cost";
  if (/只能|必须|不得|不能|需要|有限|至少|最多/u.test(clause)) return "constraint";
  if (/偏好|更喜欢|最看重|优先/u.test(clause)) return "preference";
  if (/更高|更低|更多|更少|相比|比较|二选一/u.test(clause)) return "comparison";
  if (/如果|只要|除非|前提|已经|正在|目前/u.test(clause)) return "condition";
  if (numericValuePattern.test(clause)) return "numeric";
  return "other";
}

function normalizedValue(clause: string): string | undefined {
  const time = clause.match(timeValuePattern);
  if (time) {
    const frequency = /每天|每日/u.test(clause)
      ? "per-day:"
      : /每周/u.test(clause)
        ? "per-week:"
        : /每月/u.test(clause)
          ? "per-month:"
          : "";
    const normalizedNumber = chineseNumberAlternatives[time[1]]?.at(-1) ?? time[1];
    return `${frequency}${normalizedNumber}${time[2]}`;
  }
  const numeric = clause.match(numericValuePattern);
  if (!numeric) return undefined;
  const normalizedNumber = chineseNumberAlternatives[numeric[1]]?.at(-1) ?? numeric[1];
  return `${normalizedNumber}${numeric[2].replace("％", "%")}`;
}

export function extractExplicitUserPremises(message: string): ExplicitUserPremise[] {
  const clauses = splitPremiseClauses(message)
    .filter((clause) => !requestOnlyPattern.test(clause))
    .filter((clause) => premiseSignalPattern.test(clause) || timeValuePattern.test(clause) || numericValuePattern.test(clause));
  return clauses.map((sourceText, index) => ({
    id: `premise-${premiseKind(sourceText)}-${index + 1}`,
    sourceText,
    kind: premiseKind(sourceText),
    normalizedValue: normalizedValue(sourceText),
    mustPreserve: true,
  }));
}

function containsEquivalentTime(text: string, source: string): boolean {
  const match = source.match(timeValuePattern);
  if (!match) return false;
  const alternatives = chineseNumberAlternatives[match[1]] ?? [match[1]];
  const hasValue = alternatives.some((value) =>
    new RegExp(`${value}\\s*${match[2]}`, "u").test(text));
  const hasFrequency = !/每天|每日/u.test(source) || /每天|每日|一天/u.test(text);
  const hasAnchor = !/通勤/u.test(source) || /通勤/u.test(text);
  return hasValue && hasFrequency && hasAnchor;
}

function hasReplacementTime(text: string, source: string): boolean {
  const sourceMatch = source.match(timeValuePattern);
  if (!sourceMatch) return false;
  const allowedValues = new Set(
    chineseNumberAlternatives[sourceMatch[1]] ?? [sourceMatch[1]],
  );
  return [...text.matchAll(
    /([零一二两三四五六七八九十百\d.]+)\s*(小时|分钟|天|周|月|年)/gu,
  )].some(
    (match) =>
      match[2] === sourceMatch[2] &&
      !allowedValues.has(match[1]),
  );
}

function containsEquivalentNumeric(text: string, source: string): boolean {
  const match = source.match(numericValuePattern);
  if (!match) return false;
  const alternatives = chineseNumberAlternatives[match[1]] ?? [match[1]];
  const unit = match[2].replace("％", "%");
  return alternatives.some((value) => {
    const normalizedText = text.replaceAll("％", "%");
    return new RegExp(`${value}\\s*${unit}`, "u").test(normalizedText);
  });
}

function hasReplacementNumeric(text: string, source: string): boolean {
  const sourceMatch = source.match(numericValuePattern);
  if (!sourceMatch || containsEquivalentNumeric(text, source)) return false;
  const sourceUnit = sourceMatch[2].replace("％", "%");
  return [...text.replaceAll("％", "%").matchAll(
    /([零一二两三四五六七八九十百\d.]+)\s*(%|亿元|万元|美元|人民币|元|个|次)/gu,
  )].some((match) => match[2] === sourceUnit);
}

function hasConcreteNumericPremise(source: string): boolean {
  const match = source.match(numericValuePattern);
  if (!match) return false;
  if (
    match[2] === "个" &&
    /^(?:一|1)$/u.test(match[1]) &&
    /(?:一|1)\s*个(?:方案|选择|选项|办法|方法|情况|问题)/u.test(source)
  ) {
    return false;
  }
  return true;
}

function containsCostPremise(text: string, source: string): boolean {
  const costAnchor = source.match(/租金|房租|成本|预算|费用|价格/u)?.[0];
  if (!costAnchor || !text.includes(costAnchor)) return false;
  if (/更高|较高|高出|增加|上涨/u.test(source)) {
    return new RegExp(
      `(?:${costAnchor}.{0,12}(?:更高|较高|高出|增加|上涨)|(?:更高|较高|高出|增加|上涨|高).{0,8}${costAnchor}|高${costAnchor})`,
      "u",
    ).test(text);
  }
  if (/更低|较低|降低|下降/u.test(source)) {
    return new RegExp(
      `(?:${costAnchor}.{0,12}(?:更低|较低|降低|下降)|(?:更低|较低|降低|下降|低).{0,8}${costAnchor}|低${costAnchor})`,
      "u",
    ).test(text);
  }
  return true;
}

function contradictsPremise(text: string, premise: ExplicitUserPremise): boolean {
  const source = premise.sourceText;
  if (/租金|房租|成本|费用|价格/u.test(source)) {
    if (/更高|较高|高出|上涨/u.test(source) && /(?:租金|房租|成本|费用|价格).{0,10}(?:更低|较低|下降)/u.test(text)) {
      return true;
    }
    if (/更低|较低|下降/u.test(source) && /(?:租金|房租|成本|费用|价格).{0,10}(?:更高|较高|上涨)/u.test(text)) {
      return true;
    }
  }
  if (/省|减少|缩短/u.test(source) && /通勤.{0,10}(?:增加|更长|延长)/u.test(text)) {
    return true;
  }
  return false;
}

function containsGeneralPremise(text: string, source: string): boolean {
  const terms = source.match(/[\u3400-\u9fff]{2,6}/gu) ?? [];
  const anchors = terms.filter((term) =>
    /预算|方案|完成|已经|使用|只能|必须|不得|有限|偏好|更高|更低|更多|更少/u.test(term));
  if (anchors.length === 0) return terms.some((term) => text.includes(term));
  return anchors.some((term) => text.includes(term));
}

export function reviewPremisePreservation(input: {
  responseText: string;
  premises: ExplicitUserPremise[];
}): PremisePreservationReview {
  const preservedPremiseIds: string[] = [];
  const omittedPremiseIds: string[] = [];
  const contradictedPremiseIds: string[] = [];
  const replacedPremiseIds: string[] = [];

  for (const premise of input.premises.filter((item) => item.mustPreserve)) {
    if (contradictsPremise(input.responseText, premise)) {
      contradictedPremiseIds.push(premise.id);
      continue;
    }
    if (premise.kind === "time" && timeValuePattern.test(premise.sourceText)) {
      if (hasReplacementTime(input.responseText, premise.sourceText)) {
        replacedPremiseIds.push(premise.id);
      } else if (containsEquivalentTime(input.responseText, premise.sourceText)) {
        preservedPremiseIds.push(premise.id);
      } else {
        omittedPremiseIds.push(premise.id);
      }
      continue;
    }
    if (hasConcreteNumericPremise(premise.sourceText)) {
      if (containsEquivalentNumeric(input.responseText, premise.sourceText)) {
        preservedPremiseIds.push(premise.id);
      } else if (hasReplacementNumeric(input.responseText, premise.sourceText)) {
        replacedPremiseIds.push(premise.id);
      } else {
        omittedPremiseIds.push(premise.id);
      }
      continue;
    }
    if (premise.kind === "cost") {
      if (containsCostPremise(input.responseText, premise.sourceText)) {
        preservedPremiseIds.push(premise.id);
      } else {
        omittedPremiseIds.push(premise.id);
      }
      continue;
    }
    if (containsGeneralPremise(input.responseText, premise.sourceText)) {
      preservedPremiseIds.push(premise.id);
    } else {
      omittedPremiseIds.push(premise.id);
    }
  }

  return {
    preservedPremiseIds,
    omittedPremiseIds,
    contradictedPremiseIds,
    replacedPremiseIds,
    valid:
      omittedPremiseIds.length === 0 &&
      contradictedPremiseIds.length === 0 &&
      replacedPremiseIds.length === 0,
  };
}

export function validatePremisePreservation(input: {
  response: GeneratedResponse;
  premises: ExplicitUserPremise[];
}): { result: ValidationResult; review: PremisePreservationReview } {
  const review = reviewPremisePreservation({
    responseText: segmentsToPlainText(input.response.segments),
    premises: input.premises,
  });
  const violations = [
    ...review.omittedPremiseIds.map((id) => ({
      code: "premise_omitted",
      severity: "error" as const,
      details: id,
    })),
    ...review.contradictedPremiseIds.map((id) => ({
      code: "premise_contradicted",
      severity: "error" as const,
      details: id,
    })),
    ...review.replacedPremiseIds.map((id) => ({
      code: "premise_replaced",
      severity: "error" as const,
      details: id,
    })),
  ];
  return {
    review,
    result: {
      valid: violations.length === 0,
      violations,
      retryable: violations.length > 0,
    },
  };
}
