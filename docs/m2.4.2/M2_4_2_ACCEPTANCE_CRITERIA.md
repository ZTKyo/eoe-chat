# M2.4.2 Acceptance Criteria

Final status: `M2_4_2_STOPPED_WITH_BLOCKERS`

## Environment and no-quota gates

- [x] Explicit Execution Modes are implemented.
- [x] Unit, Mock E2E, structure Benchmark, Replay, build verification, and production verification cannot authorize native Provider transport.
- [x] Mock E2E overrides inherited `.env.local` Provider values.
- [x] Live authorization requires mode, allow flag, Run ID, Ledger path, and both keys.
- [x] Native Provider Adapter transport cannot bypass `LiveBudgetGuard`.
- [x] Ports 3100, 3200, and 3201 use ownership and release checks.
- [x] Server identity is checked before test requests.
- [x] All twenty required isolation cases are covered without live calls.
- [x] Full no-quota command gate completed with exit 0.
- [x] Mock E2E reported zero live requests and passed Desktop plus 390×844 Mobile.

Evidence: 338 non-live tests passed with 5 old Live suites skipped; the focused isolation subset passed 49/49 after final Guard changes; E2E passed 22/22.

## Focused Probe

- [x] A fresh zero-count Ledger was created before the first request.
- [x] Every formal Provider HTTP attempt is present in the Ledger.
- [x] The first 7 scenarios were all executed.
- [ ] Focused Probe passed 7/7.
- [x] First-cycle failure evidence and Provider output hashes were preserved.
- [x] Only one Targeted Retry cycle was used.
- [x] Regression tests and the complete no-quota Gate passed before the retry.
- [x] The three affected scenarios were rerun first.
- [ ] The affected subset passed 3/3.
- [ ] The complete 7-scenario Probe was rerun after the affected subset.

Evidence: first cycle 4/7; targeted affected subset 1/3. The remaining failures were a GLM Vision timeout/Natural Fallback and an explicit-Chinese image answer containing English visible text.

## Corpus and human review

- [ ] Core20 executed.
- [ ] Opportunity12 executed.
- [ ] Multi-Turn8 executed.
- [ ] Image4 executed.
- [ ] Severe Task Completeness failures are zero.
- [ ] Severe image-grounding failures are zero.
- [x] Vocabulary Assistance Focused scenario passed.
- [x] User Phrase Reuse detector and final realization passed in the targeted retry.
- [x] Natural Fallback was not counted as pass.
- [x] Validator thresholds were not relaxed.
- [ ] Independent human-review package was created.

Evidence: Corpus and review-package creation were correctly blocked after the Targeted Retry failed.

## Safety and scope

- [x] Exact configured-key scan outside ignored environment files found zero matches.
- [x] Artifact scans found zero Authorization values, private paths, full Directives, and image bytes.
- [x] `.env.local` remains ignored and untracked.
- [x] No remote exists and no push/deploy occurred.
- [x] M3 remains blocked.
- [x] Adaptive Progression remains disabled.
- [x] Codex did not declare human naturalness pass.
- [ ] `npm audit` has zero findings.

Evidence: `npm audit` returned exit 1 with two moderate PostCSS/Next findings, zero high and zero critical, and no fix available. No audit fix was applied.
