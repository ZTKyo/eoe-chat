# M2.3.2 Acceptance Criteria

## Scope and safety

- [x] M3 remains not started.
- [x] Adaptive Progression remains not started.
- [x] Historical 19/20 and DeepSeek 8/9 evidence remains unchanged.
- [x] Pre-change checkpoint exists.
- [x] Validator remains unchanged and strict after the repair.
- [x] No scenario ID branch or fixed answer is added.
- [x] Final security scan is zero.

Evidence: no diff exists in either Validator, Mapper, or Candidate Selector; the 15-case boundary regression proves the unchanged strict behavior. The final high-signal scan of M2.3.2 evidence returned zero findings.

## Evidence and regression

- [x] Both historical `corpus-long-analysis` attempts are exactly replayed and documented.
- [x] One evidence-backed primary direction is selected.
- [x] All 15 general boundary regression cases pass.
- [x] Historical fixtures remain stable replay evidence.

Evidence: Direction A was selected after exact inspection; targeted tests passed 15/15 and the complete historical replay command passed 51/51.

## No-quota gate

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run benchmark:eoe`
- [x] `npm run benchmark:naturalness`
- [x] `npm run replay:m2.3-live-failures`
- [x] `npm run build`
- [x] `npm run test:e2e`

Evidence: final executions all exited 0. Unit/integration tests were 277 passed with 3 intentionally skipped Live tests; EOE benchmark was 45/45; replay was 51/51; final E2E was 20/20 on Desktop and 390x844 Mobile.

## Live gate

- [x] Single affected DeepSeek scenario passes without Natural Fallback.
- [x] DeepSeek three-scenario regression passes 3/3.
- [x] Original DeepSeek Corpus passes 9/9.
- [ ] Original full Corpus passes its unchanged thresholds.
- [x] Capability remains 6/6.
- [x] Fallback remains PASS.

Evidence: `corpus-long-analysis` succeeded on Attempt 2 with a valid `in the long run` boundary; cumulative stages reached 1/1, 3/3, and original DeepSeek 9/9 with zero Natural Fallback. Prior unchanged Capability 6/6 and Fallback PASS evidence remains valid but was not re-executed because the hard 20-request budget was reserved for the Corpus. The full Corpus stopped at 17 passed cases plus one budget-blocked case after all 20 HTTP request slots were consumed by three Validator retries; two original cases were not started.

## Final state

- [x] Final state is exactly `M2_3_2_STOPPED_WITH_BLOCKER`.
- [x] Independent Human Review remains Pending.

Evidence: the request ceiling stopped the full-Corpus stage, so the technical-pass state and human-review package were not produced.
