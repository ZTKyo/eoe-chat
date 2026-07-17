# Repair Cycle 1

Status: **LIVE_CAPABILITY_GATE_FAIL**

## Starting evidence

- Historical M2.3 gate: 5/9.
- noFit: 3/3.
- forced sentence start: 2/3.
- forced sentence middle: 0/3.
- All 12 captured raw objects passed Template parsing and used the allowed DTO keys.
- Historical raw `responseTemplate` values and per-attempt Template violation codes were not retained.

## Evidence-backed hypothesis

The live gate incorrectly measured compliance with a probe-selected sentence position instead of Provider capability to produce any natural allowed realization. This contradicts the Product contract that naturalness is a hard gate and the Provider chooses natural wording/position. Forced position is therefore removed before the six-case capability gate.

## Planned minimal change

1. Add replayable, redacted per-attempt capture with exact stage and violation codes.
2. Remove `templatePositionPreference` from production request state and Directive.
3. Replace nine forced-position probes with six capability probes: natural noFit plus natural English Chunk for each Provider.
4. Preserve allowed-position metadata and all Validator rules.
5. Add position-neutrality and diagnostic regression tests.

## Results

### Root cause and minimal fix

- Root cause: the historical nine-case gate injected a caller-selected sentence position into the production request state and Directive. That converted a naturalness capability test into a forced-placement compliance test.
- Minimal fix: removed only `templatePositionPreference` from `ChatRequest`, Engine input, Directive state, and the Live runner. Provider-selected placement remains limited by the unchanged Phrase Realization Profile and both unchanged deterministic Validators.
- Validator relaxation: none.
- Provider substitution: none.
- Phrase hardcoding: none.

### Regression evidence

- Directive regression proves no position override or live-probe instruction is emitted.
- The Live runner now requires six position-neutral capability cases: valid noFit plus valid English Chunk for GLM-4.7, GLM-4.6V, and DeepSeek V4 Flash.
- Every new synthetic raw Template is hashed and stored with exact Engine context, pipeline stage, violation codes, latency, usage, fallback state, and offline replay metadata.

### Full no-quota gate

- `npm install`: PASS, up to date.
- `npm run lint`: PASS, zero warnings after the capture helper cleanup.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 215 passed; 3 Live tests skipped and not counted as Live evidence.
- `npm run benchmark:eoe`: PASS, 45/45.
- `npm run benchmark:naturalness`: PASS, 45 scenarios written to the evidence report.
- `npm run replay:m2.3-live-failures`: PASS, 5/5 before the new Live run.
- `npm run build`: PASS.
- `npm run test:e2e`: PASS, 20/20 across Desktop Chromium and 390x844 Mobile.

### Live budget delta

- Requests: 0.
- Tokens: 0.
- Provider runtime: 0 ms.

### Live capability result

- Gate: FAIL, 3/6.
- Valid noFit: GLM-4.6V and DeepSeek; GLM-4.7 failed both attempts.
- Valid English Chunk: DeepSeek only; GLM-4.7 and GLM-4.6V failed both attempts.
- Provider fallback: not executed by gate design.
- 20-case Corpus: not executed by gate design.
- Natural Fallback was not counted as success.
- Real-call delta: 9 requests, 6,088 tokens, 15,200 ms Provider runtime.

Exact replayed failures:

- GLM-4.7 noFit Attempt 1: `provider_template_parse_failed` after returning an `answer` object instead of the Template DTO.
- GLM-4.7 noFit Attempt 2: `missing_no_fit_reason`.
- GLM-4.7 English Attempts 1 and 2: `template_boundary_invalid`; the placeholder was joined directly to Chinese characters.
- GLM-4.6V English Attempt 1: `duplicate_placeholder`.
- GLM-4.6V English Attempt 2: `template_boundary_invalid`; the placeholder was joined directly to Chinese characters.

Offline exact replay: PASS, 14/14 including all nine new raw Template fixtures.

The evidence supports a second cycle limited to generic DTO-field, placeholder-count, punctuation-boundary, and violation-specific retry guidance. No Validator change is justified.
