# Text Beta RC Final Acceptance

Status: `M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS`

## Frozen scope

This gate closes only:

1. technical comparison completeness;
2. explicit user premise preservation;
3. Engine-owned zero-attempt accounting.

M3 remains blocked. Adaptive Progression remains disabled. Image input remains
a deferred experimental feature and its entry remains disabled.

## No-quota acceptance

- [x] Explicit premise extraction has deterministic regression coverage.
- [x] Numeric, time, cost, constraint, condition, omission, contradiction, and
  replacement behavior has regression coverage.
- [x] Premises are included in the per-turn Directive.
- [x] Premise violations are deterministic, hard, and retryable.
- [x] Technical comparison requirements are represented in Domain state.
- [x] `unknown` / `any` accepts multiple valid orders and equivalent
  narrowing, guard, assertion, or validate-first wording.
- [x] Technical hard and soft issues are separated.
- [x] A Hard-valid technical answer survives Soft warnings without Natural
  Fallback.
- [x] Execution source is explicit.
- [x] Engine-owned acknowledgement and resolution accept zero attempts and zero
  Provider requests.
- [x] Natural Fallback cannot be counted as an ordinary PASS.
- [x] Full no-quota command gate exits 0.
- [x] Desktop and 390×844 Mock E2E exit 0.
- [x] Mock E2E records zero Live Provider requests.

## Targeted live acceptance

- [x] `typescript-unknown-any` is Hard-valid, substantive, and has at most one
  Soft warning.
- [ ] `conditional-tradeoff` preserves higher rent and one saved commute hour
  per day without replacement assumptions.
- [x] `context-ack-oh` preserves commuting context with Engine-owned
  acknowledgement, zero attempts, and zero Provider requests.
- [ ] Three usable final results are retained.
- [x] Natural Fallback count is zero.
- [x] Image Provider request count is zero.
- [x] Requests, tokens, and Provider runtime stay within 12 / 20,000 / 900,000
  ms.

## Final evidence audit

The merged automated harness emitted
`M2_TEXT_BETA_RC_REVIEWABLE_WITH_ONE_TYPESCRIPT_SOFT_WARNING`, but final
evidence review overrides that automated summary:

- TypeScript is Hard-valid with exactly one Soft warning:
  `technical_usage_advice_missing`.
- `context-ack-oh` is valid Engine-owned evidence with 0 attempts and 0
  Provider requests.
- The final `conditional-tradeoff` answer preserves the daily one-hour commute
  saving, but does not preserve the direction “the option has higher rent”; it
  only refers to a rent difference.
- That answer also introduces exact `1–2周` and `第3周起` test periods that were
  not supplied by the user.

The sole Targeted Retry has already been used. No second repair or Live request
is permitted. The authoritative final engineering state is therefore
`M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS`.

## Release state

- `M2_TEXT_BETA_RC_READY_FOR_FINAL_HUMAN_REVIEW`: all three pass and the
  TypeScript result has no Soft warning.
- `M2_TEXT_BETA_RC_REVIEWABLE_WITH_ONE_TYPESCRIPT_SOFT_WARNING`: the premise
  and acknowledgement cases pass, TypeScript is complete and Hard-valid with
  no more than one Soft warning, and Natural Fallback is zero.
- `M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS`: any required product result is
  absent or invalid.

No state in this document constitutes independent human approval. The review
package checklist remains unselected.
