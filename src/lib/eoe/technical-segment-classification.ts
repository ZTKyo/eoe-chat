import type { MessageSegment } from "@/domain/chat";
import type { TechnicalSegmentRole } from "@/domain/eoe";

export interface TechnicalSurfaceClassification {
  surface: string;
  role: TechnicalSegmentRole;
}

const technicalTermPattern =
  /^(?:TypeScript|JavaScript|Python|Java|React|Next\.?js|Node\.?js|HTTP|HTTPS|API|SDK|SQL|JSON|HTML|CSS|Git|Docker|Kubernetes|type guard|assertion)$/iu;
const codeIdentifierPattern =
  /^(?:[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*|[A-Za-z_$][\w$]*<[^>\r\n]+>|--[a-z][\w-]*)$/u;
const teachingPattern =
  /中文意思|翻译成|请跟我读|发音是|音标|记住这个词|造句|小测验/u;

export function classifyTechnicalSurface(
  surface: string,
  contextText = surface,
): TechnicalSegmentRole {
  if (teachingPattern.test(contextText)) return "unsolicited_teaching";
  if (technicalTermPattern.test(surface)) return "technical_term";
  if (codeIdentifierPattern.test(surface)) return "code_identifier";
  return "technical_term";
}

export function classifyMessageSegments(
  segments: MessageSegment[],
): TechnicalSurfaceClassification[] {
  return segments.flatMap((segment) => {
    if (segment.type === "english_chunk") {
      return [{ surface: segment.content, role: "english_overlay" as const }];
    }
    if (segment.type === "assistance_phrase") {
      return [{ surface: segment.content, role: "vocabulary_assistance" as const }];
    }
    const surfaces = [
      ...(segment.content.match(/`([^`\r\n]+)`/gu) ?? []).map((value) => value.slice(1, -1)),
      ...(segment.content.match(/\b(?:TypeScript|JavaScript|Python|React|HTTP|API|SDK|SQL|JSON|any|unknown|typeof|instanceof|assertion|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+|[A-Za-z_$][\w$]*<[^>\r\n]+>)\b/giu) ?? []),
    ];
    return [...new Set(surfaces)].map((surface) => ({
      surface,
      role: classifyTechnicalSurface(surface, segment.content),
    }));
  });
}

export function extractTechnicalTerms(text: string): string[] {
  const explicit = [
    ...(text.match(/`([^`\r\n]+)`/gu) ?? []).map((value) => value.slice(1, -1)),
    ...(text.match(/\b(?:TypeScript|JavaScript|Python|React|HTTP|HTTPS|API|SDK|SQL|JSON|unknown|any|never|void|null|undefined|typeof|instanceof|assertion|type\s+guard|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+)\b/giu) ?? []),
  ];
  return [...new Set(explicit.map((value) => value.trim()).filter(Boolean))];
}

export function reviewTechnicalDistinction(
  text: string,
  technicalTerms: string[],
): string[] {
  const normalized = new Set(technicalTerms.map((term) => term.toLocaleLowerCase()));
  if (!normalized.has("unknown") || !normalized.has("any")) return [];
  const anyEvidence = /`?any`?/iu.test(text) &&
    /绕过|跳过|关闭|禁用|停用|放弃|失去|不受|不再|不会.{0,8}检查|允许.{0,12}(?:任何|任意).{0,8}(?:访问|调用|赋值|操作)|直接.{0,12}(?:访问|调用|赋值|操作)|类型检查.{0,12}(?:失效|不起作用|被禁用|被关闭)/u.test(text);
  const unknownEvidence = /`?unknown`?/iu.test(text) &&
    /收窄|类型守卫|guard|断言|assertion|typeof|instanceof|验证|检查.{0,12}(?:类型|结构)|确认.{0,12}(?:类型|结构)/iu.test(text);
  const saferEvidence =
    /`?unknown`?.{0,100}(?:更安全|安全性更高|更高的安全性|安全性更强|更多.{0,6}(?:类型)?安全性|保留.{0,12}(?:类型)?检查)|(?:更安全|安全性更高|更高的安全性|安全性更强|更多.{0,6}(?:类型)?安全性|安全性差异).{0,100}`?unknown`?/iu.test(text);
  const usageAdviceEvidence =
    /(?:优先|建议|适合|应该|尽量).{0,50}`?unknown`?|`?unknown`?.{0,100}(?:通常|一般|默认)?(?:应|应该|建议|优先)|`?any`?.{0,50}(?:迁移|兼容|临时|不得已|快速原型)/iu.test(text);
  return [
    anyEvidence ? undefined : "technical_any_behavior_missing",
    unknownEvidence ? undefined : "technical_unknown_narrowing_missing",
    saferEvidence ? undefined : "technical_unknown_safety_missing",
    usageAdviceEvidence ? undefined : "technical_usage_advice_missing",
  ].filter((item): item is string => Boolean(item));
}
