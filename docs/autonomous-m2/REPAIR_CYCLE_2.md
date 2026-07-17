# Repair Cycle 2

Status: **LIVE_CAPABILITY_GATE_FAIL_WITH_IMPROVEMENT**

## Starting evidence

- Cycle 1 capability gate: 3/6.
- Cumulative autonomous Live budget: 9 requests, 6,088 tokens, 15,200 ms Provider runtime.
- All nine raw Template fixtures replay exactly; no security finding.
- DeepSeek passed noFit and English capability without a repair.
- GLM failures are confined to DTO shape, conditional `noFitReason`, duplicate placeholder, and unsafe Chinese-character adjacency.

## Evidence-backed root cause

The Directive states the contract but does not translate the strict boundary rule or each retry violation into sufficiently concrete, machine-actionable correction guidance. GLM consequently treats the placeholder as a Chinese verb fragment or omits a conditional field. This is a generation-contract clarity issue, not a reason to relax parsing or validation.

## Planned minimal change

1. Put the exact allowed-key/conditional-field contract at the top of the Directive.
2. State the generic boundary rule explicitly: placeholder must be at an allowed edge or isolated by compatible punctuation; it must never touch a Chinese or Latin word character.
3. Add generic valid start/middle shapes and invalid joined-character shapes without hardcoding any answer.
4. Map observed violation codes to exact retry corrections.
5. Preserve all Engine ownership and both Validators unchanged.

## Results

### Implemented

- The exact conditional DTO key contract now appears at the top of every Directive.
- Generic valid start/middle punctuation shapes and invalid word-adjacent/repeated-placeholder shapes are explicit.
- Retry guidance maps `provider_template_parse_failed`, `missing_no_fit_reason`, `duplicate_placeholder`, `template_boundary_invalid`, `template_position_violation`, and `unexpected_no_fit_reason` to exact corrections.
- No scenario-specific answer, Phrase override, Provider switch, parser normalization, string repair, or Validator relaxation was added.

### Full no-quota gate

- `npm install`: PASS; existing audit result remains 2 moderate transitive PostCSS findings, with no force fix applied.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 225 passed; 3 Live tests skipped and not counted as Live evidence.
- `npm run benchmark:eoe`: PASS, 45/45.
- `npm run benchmark:naturalness`: PASS, 45 scenarios.
- `npm run replay:m2.3-live-failures`: PASS, 14/14.
- `npm run build`: PASS.
- `npm run test:e2e`: PASS, 20/20 across Desktop Chromium and 390x844 Mobile.

### Live budget before re-probe

- Requests: 9/60.
- Tokens: 6,088/150,000.
- Provider runtime: 15,200/5,400,000 ms.

### Live capability result

- Gate: FAIL, 5/6; improved from Cycle 1's 3/6.
- GLM-4.7: noFit PASS, English Chunk PASS.
- GLM-4.6V: noFit PASS, English Chunk FAIL.
- DeepSeek: noFit PASS, English Chunk PASS.
- Provider fallback and 20-case Corpus: not executed by gate design.
- Natural Fallback was not counted as success.
- Cycle delta: 7 requests, 5,939 tokens, 33,112 ms Provider runtime.
- Cumulative: 16 requests, 12,027 tokens, 48,312 ms Provider runtime.

The remaining GLM-4.6V English failure reproduced `template_boundary_invalid` twice. Both responses used the same natural-language frame (`让我` + placeholder) despite the generic boundary correction. Exact offline replay is 21/21.

## Distinct evidence for Cycle 3

The selected Phrase already owns a Registry `bilingualPatterns` frame that expresses a validated natural code-switch boundary, but the per-turn Directive does not pass that selected Phrase metadata to the Provider. Passing only the selected Phrase's small safe-frame set is a distinct metadata propagation fix; it does not weaken validation or hardcode a scenario answer.
