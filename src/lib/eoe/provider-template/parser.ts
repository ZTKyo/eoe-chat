import type { PipelineDiagnostic } from "@/domain/eoe";
import { providerResponseTemplateV1Schema, type ProviderResponseTemplateV1 } from "./schema";

export type ProviderTemplateParseResult =
  | { success: true; template: ProviderResponseTemplateV1; diagnostics: [] }
  | { success: false; diagnostics: PipelineDiagnostic[] };

function diagnostic(code: string, path?: string, details?: string): PipelineDiagnostic {
  return { stage: "provider_template_parse", code, path, details };
}

export function parseProviderResponseTemplate(raw: string): ProviderTemplateParseResult {
  if (/^\s*```/u.test(raw) || /```\s*$/u.test(raw)) {
    return { success: false, diagnostics: [diagnostic("markdown_wrapped_template")] };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        diagnostic(
          "provider_template_parse_failed",
          undefined,
          error instanceof Error ? error.message : "invalid JSON",
        ),
      ],
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      success: false,
      diagnostics: [diagnostic("provider_template_parse_failed", undefined, "root must be an object")],
    };
  }

  const parsed = providerResponseTemplateV1Schema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: parsed.error.issues.map((issue) =>
        diagnostic(
          "provider_template_parse_failed",
          issue.path.join("."),
          issue.code === "unrecognized_keys"
            ? `additionalProperties:${issue.keys.join(",")}`
            : issue.message,
        ),
      ),
    };
  }

  return { success: true, template: parsed.data, diagnostics: [] };
}
