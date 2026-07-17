# M2.5.1 Acceptance Criteria

## Implementation gate

- [x] Four blocker fixes are driven by conversation properties, not scenario IDs.
- [x] Comparison decisions use proportional requirements and precise missing codes.
- [x] Daily advice is distinct from a structured plan and rejects empty slogans.
- [x] Phrase references resolve to `resolved`, `ambiguous`, or `not_found`.
- [x] Ambiguous Phrase clarification is Engine-owned and makes no ordinary Provider request.
- [x] User selection after ambiguity enters the existing Vocabulary Assistance path.
- [x] Technical identifiers and terms are not treated as English Overlay.
- [x] TypeScript `unknown`/`any` receives a substantive distinction check.
- [x] The deterministic Validator remains enabled and strict.
- [x] New Attempt diagnostics preserve Provider output previews.

## No-quota gate

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run benchmark:eoe`
- [x] `npm run benchmark:structure`
- [x] `npm run benchmark:naturalness`
- [x] `npm run replay:m2.3-live-failures`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] The final full no-quota run of every command exits 0.
- [x] `benchmark:naturalness` reports the deprecated alias.
- [x] E2E uses MockProvider and makes zero Live requests.
- [x] Desktop and 390×844 Mobile pass.
- [x] Image entry remains disabled.
- [x] Ports 3100, 3200, and 3201 are released.

## Live gates

- [x] Targeted ledger is `artifacts/benchmarks/m2.5.1-targeted-budget.json`.
- [x] Targeted run stays within 20 requests, 35,000 tokens, and 30 minutes.
- [ ] All four targeted cases pass without Natural Fallback.
- [x] At most one minimal targeted retry is performed.
- [ ] Full 39-case corpus runs only after Targeted 4/4.
- [ ] Final ledger is `artifacts/benchmarks/m2.5.1-final-corpus-budget.json`.
- [ ] Final run stays within 100 requests, 160,000 tokens, and 90 minutes.
- [x] Natural Fallback is never counted as PASS.

## Final disposition

- [ ] Case A: 39/39 and all serious-failure counters are zero; or
- [ ] Case B: 38/39 with exactly one documented safe technical fallback meeting every stated exception condition; or
- [x] Case C: stop with blockers and do not create M2.5.2.
- [ ] Human review package is created only for Case A or B and contains no pre-filled human PASS.
- [x] No Human Review package is created because Case A/B was not reached.
- [x] Independent Human Review is not started.
- [x] M3 remains blocked and Adaptive Progression remains disabled.
