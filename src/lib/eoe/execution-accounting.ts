import type { ResponseExecutionSource } from "@/domain/eoe";

export interface ExecutionAccountingReview {
  valid: boolean;
  violations: string[];
}

export function reviewExecutionAccounting(input: {
  source: ResponseExecutionSource;
  attemptCount: number;
  providerRequestCount: number;
}): ExecutionAccountingReview {
  const violations: string[] = [];
  switch (input.source) {
    case "provider_generated":
      if (input.attemptCount < 1 || input.attemptCount > 2) {
        violations.push(`provider_attempt_count_invalid:${input.attemptCount}`);
      }
      if (input.providerRequestCount < 1) {
        violations.push(`provider_request_count_invalid:${input.providerRequestCount}`);
      }
      break;
    case "engine_owned_resolution":
    case "engine_owned_acknowledgement":
      if (input.attemptCount !== 0) {
        violations.push(`engine_owned_attempt_count_invalid:${input.attemptCount}`);
      }
      if (input.providerRequestCount !== 0) {
        violations.push(`engine_owned_provider_request_count_invalid:${input.providerRequestCount}`);
      }
      break;
    case "engine_owned_assistance_fallback":
      if (input.attemptCount < 0 || input.providerRequestCount < 0) {
        violations.push("engine_owned_assistance_accounting_invalid");
      }
      break;
    case "natural_fallback":
      violations.push("natural_fallback_not_standard_pass");
      break;
    default:
      violations.push("unknown_execution_source");
      break;
  }
  return { valid: violations.length === 0, violations };
}
