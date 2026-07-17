import type { ResponseDepthProfile } from "@/domain/eoe";

const detailedPattern = /详细分析|深入分析|分析.{0,20}之间的关系|分析两边代价|展开讲讲/u;

function cleanFactor(value: string): string {
  return value
    .replace(/^(?:一个|这个|该|产品|方案)/u, "")
    .replace(/(?:之间|的关系|两边代价|方面)$/u, "")
    .trim();
}

function extractNamedFactors(userMessage: string): string[] {
  const fromRange = userMessage.match(/从(.+?)(?:之间的关系|之间关系|的关系|。|？|\?|$)/u)?.[1];
  const source = fromRange ?? userMessage.match(/分析(?:一下)?(.+?)(?:。|？|\?|$)/u)?.[1] ?? "";
  return [...new Set(
    source
      .split(/[、，,；;]|以及|和|与|到/u)
      .map(cleanFactor)
      .filter((factor) => factor.length >= 2 && factor.length <= 24),
  )].slice(0, 8);
}

export function analyzeResponseDepth(userMessage: string): ResponseDepthProfile {
  const detailed = detailedPattern.test(userMessage);
  return {
    level: detailed ? "detailed" : /简短|简要|一句话/u.test(userMessage) ? "brief" : "standard",
    namedFactors: detailed ? extractNamedFactors(userMessage) : [],
    requiresInteractions: detailed,
    minimumInteractionCount: detailed ? 2 : 0,
    requiresTradeOffs: detailed,
    requiresConclusion: detailed,
  };
}

export interface ResponseDepthReview {
  warnings: string[];
  namedFactorCoverage: number;
  interactionCount: number;
}

export function reviewResponseDepth(
  responseText: string,
  profile: ResponseDepthProfile,
): ResponseDepthReview {
  if (profile.level !== "detailed") {
    return { warnings: [], namedFactorCoverage: 1, interactionCount: 0 };
  }
  const covered = profile.namedFactors.filter((factor) => responseText.includes(factor));
  const namedFactorCoverage = profile.namedFactors.length === 0
    ? 1
    : covered.length / profile.namedFactors.length;
  const relationClauses = responseText
    .split(/[。！？；\n]/u)
    .filter((part) =>
      /影响|导致|制约|取决于|反馈|相互|带来|进而|反过来|推动|抬高|降低|如果.+(?:就|会)/u.test(part),
    );
  const interactionCount = relationClauses.length;
  const warnings: string[] = [];
  if (namedFactorCoverage < 1) warnings.push("detailed_analysis_named_factors_incomplete");
  if (profile.requiresInteractions && interactionCount < profile.minimumInteractionCount) {
    warnings.push("detailed_analysis_interactions_insufficient");
  }
  if (profile.requiresTradeOffs && !/权衡|代价|取舍|短期|长期|一方面|另一方面|反馈环|此消彼长/u.test(responseText)) {
    warnings.push("detailed_analysis_tradeoff_missing");
  }
  if (profile.requiresConclusion && !/综合来看|总的来说|因此|结论|最终|整体上|归根结底/u.test(responseText)) {
    warnings.push("detailed_analysis_conclusion_missing");
  }
  return {
    warnings,
    namedFactorCoverage: Number(namedFactorCoverage.toFixed(3)),
    interactionCount,
  };
}
