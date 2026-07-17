import { segmentsToPlainText, type GeneratedResponse } from "@/domain/chat";
import type { ValidationResult } from "@/domain/eoe";

const quantitativePattern =
  /(?:百分之\s*[零一二三四五六七八九十百点\d.]+|\d+(?:\.\d+)?\s*(?:%|％|元|万元|亿元|美元|人民币|倍|个百分点))/gu;
const hypotheticalCue =
  /例如|比如|示例|假设|假定|仅作演示|为了说明|不代表实际|无法确定|不能确定|实际比例未知|具体比例需要|没有数据/u;
const traceableSourceCue =
  /(?:根据|来自|依据).{0,48}(?:报告|数据|统计|财报|文档|资料|来源|用户提供)/u;

function normalizeClaim(value: string): string {
  return value.replace(/\s+/gu, "").replaceAll("％", "%").toLocaleLowerCase();
}

export function findUnsupportedQuantitativeClaims(input: {
  responseText: string;
  sourceTexts: string[];
}): string[] {
  const claims = input.responseText.match(quantitativePattern) ?? [];
  const normalizedSources = input.sourceTexts.map(normalizeClaim);
  return [...new Set(claims.filter((claim) => {
    const normalized = normalizeClaim(claim);
    if (normalizedSources.some((source) => source.includes(normalized))) return false;
    const index = input.responseText.indexOf(claim);
    const localContext = input.responseText.slice(Math.max(0, index - 80), index + claim.length + 80);
    return !hypotheticalCue.test(localContext) && !traceableSourceCue.test(localContext);
  }))];
}

export function validateQuantitativeClaims(input: {
  response: GeneratedResponse;
  sourceTexts: string[];
}): ValidationResult {
  const unsupported = findUnsupportedQuantitativeClaims({
    responseText: segmentsToPlainText(input.response.segments),
    sourceTexts: input.sourceTexts,
  });
  return unsupported.length === 0
    ? { valid: true, violations: [], retryable: false }
    : {
        valid: false,
        violations: unsupported.map((claim) => ({
          code: "unsupported_quantitative_claim",
          severity: "error" as const,
          details: claim,
        })),
        retryable: true,
      };
}
