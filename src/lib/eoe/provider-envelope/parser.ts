import type { PipelineDiagnostic } from "@/domain/eoe";
import { isRegistryPhrase } from "../registry/phrase-registry";
import {
  providerGenerationEnvelopeV1Schema,
  type ProviderGenerationEnvelopeV1,
} from "./schema";

export interface ProviderEnvelopeSemanticContext {
  selectedPhraseId?: string;
  selectedPhrase?: string;
  selectedPhraseVariants?: string[];
}

export type ProviderEnvelopeParseResult =
  | {
      success: true;
      envelope: ProviderGenerationEnvelopeV1;
      diagnostics: [];
    }
  | {
      success: false;
      diagnostics: PipelineDiagnostic[];
    };

function diagnostic(
  stage: PipelineDiagnostic["stage"],
  code: string,
  path?: string,
  details?: string,
): PipelineDiagnostic {
  return { stage, code, path, details };
}

function uniqueDiagnostics(items: PipelineDiagnostic[]): PipelineDiagnostic[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.stage}\u0000${item.code}\u0000${item.path ?? ""}\u0000${item.details ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function zodDiagnostics(raw: unknown, issues: Array<{ code: string; path: PropertyKey[]; message: string; keys?: string[] }>): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [
    diagnostic("provider_envelope_parse", "provider_envelope_parse_failed"),
  ];
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;

  if (record && Object.hasOwn(record, "segments")) {
    diagnostics.push(diagnostic("provider_envelope_parse", "unexpected_segments_array", "segments"));
  }

  for (const issue of issues) {
    const path = issue.path.map(String).join(".");
    const root = String(issue.path[0] ?? "");
    if (issue.code === "unrecognized_keys") {
      const keys = issue.keys ?? [];
      for (const key of keys) {
        diagnostics.push(
          diagnostic(
            "provider_envelope_parse",
            key === "segments" ? "unexpected_segments_array" : "unexpected_extra_field",
            key,
          ),
        );
      }
      continue;
    }
    if (root === "beforeText" && record?.beforeText === undefined) {
      diagnostics.push(diagnostic("provider_envelope_parse", "missing_beforeText", path));
    } else if (root === "afterText" && record?.afterText === undefined) {
      diagnostics.push(diagnostic("provider_envelope_parse", "missing_afterText", path));
    } else if (root === "englishChunk") {
      diagnostics.push(diagnostic("provider_envelope_parse", "invalid_englishChunk", path, issue.code));
    } else if (root === "naturalnessConfidence") {
      diagnostics.push(diagnostic("provider_envelope_parse", "invalid_confidence", path, issue.code));
    } else {
      diagnostics.push(diagnostic("provider_envelope_parse", "provider_envelope_parse_failed", path, issue.code));
    }
  }
  return uniqueDiagnostics(diagnostics);
}

export function validateProviderEnvelopeSemantics(
  envelope: ProviderGenerationEnvelopeV1,
  context: ProviderEnvelopeSemanticContext,
): PipelineDiagnostic[] {
  const diagnostics: PipelineDiagnostic[] = [];
  const add = (code: string, path?: string, details?: string) => {
    diagnostics.push(diagnostic("provider_envelope_semantics", code, path, details));
  };
  const textFields = [
    ["beforeText", envelope.beforeText],
    ["afterText", envelope.afterText],
    ["englishChunk.content", envelope.englishChunk?.content ?? ""],
  ] as const;

  if (envelope.beforeText.length === 0 && envelope.afterText.length === 0) {
    add("provider_envelope_semantic_failed", "beforeText,afterText", "both text slots are empty");
  }
  for (const [path, value] of textFields) {
    if (value.length > 0 && value.trim().length === 0) {
      add("provider_envelope_semantic_failed", path, "whitespace-only text is not allowed");
    }
    if (/```/u.test(value)) add("provider_markdown_wrapped_json", path);
    if (/<\/?[a-z][^>]*>/iu.test(value)) {
      add("provider_envelope_semantic_failed", path, "HTML is not allowed");
    }
  }

  if (envelope.noFit && envelope.englishChunk !== null) {
    add("provider_no_fit_conflict", "noFit");
    add("noFit_chunk_conflict", "englishChunk");
  }
  if (!envelope.noFit && envelope.englishChunk === null) {
    add("provider_no_fit_conflict", "englishChunk", "noFit=false requires englishChunk");
  }

  if (envelope.englishChunk) {
    const { phraseId, content } = envelope.englishChunk;
    if (!isRegistryPhrase(phraseId)) {
      add("provider_phrase_mismatch", "englishChunk.phraseId", "unknown Registry Phrase ID");
      add("invalid_phrase_id", "englishChunk.phraseId");
    } else if (!context.selectedPhraseId || phraseId !== context.selectedPhraseId) {
      add("provider_phrase_mismatch", "englishChunk.phraseId", "Phrase ID does not match the selected candidate");
      add("phrase_id_mismatch", "englishChunk.phraseId");
    }

    const allowed = [context.selectedPhrase, ...(context.selectedPhraseVariants ?? [])].filter(
      (value): value is string => Boolean(value),
    );
    if (allowed.length === 0 || !allowed.includes(content)) {
      add("provider_phrase_mismatch", "englishChunk.content", "content is not a canonical or variant form");
    }
  }

  if (!context.selectedPhraseId && !envelope.noFit) {
    add("provider_envelope_semantic_failed", "noFit", "no selected candidate requires noFit=true");
  }

  if (diagnostics.length > 0 && !diagnostics.some((item) => item.code === "provider_envelope_semantic_failed")) {
    diagnostics.unshift(diagnostic("provider_envelope_semantics", "provider_envelope_semantic_failed"));
  }
  return uniqueDiagnostics(diagnostics);
}

export function parseProviderEnvelope(
  content: string,
  context: ProviderEnvelopeSemanticContext,
): ProviderEnvelopeParseResult {
  if (content.trim().length === 0) {
    return {
      success: false,
      diagnostics: [diagnostic("provider_text_extraction", "provider_empty_response")],
    };
  }

  if (/^```|```$/u.test(content.trim())) {
    return {
      success: false,
      diagnostics: [diagnostic("json_object_extraction", "provider_markdown_wrapped_json")],
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch {
    return {
      success: false,
      diagnostics: [diagnostic("json_object_extraction", "provider_non_json_response")],
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      success: false,
      diagnostics: [diagnostic("provider_envelope_parse", "provider_envelope_parse_failed", undefined, "root is not an object")],
    };
  }

  const parsed = providerGenerationEnvelopeV1Schema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: zodDiagnostics(raw, parsed.error.issues),
    };
  }

  const semanticDiagnostics = validateProviderEnvelopeSemantics(parsed.data, context);
  if (semanticDiagnostics.length > 0) return { success: false, diagnostics: semanticDiagnostics };
  return { success: true, envelope: parsed.data, diagnostics: [] };
}
