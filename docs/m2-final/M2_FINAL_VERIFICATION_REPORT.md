# M2 Final Verification Report

Final Status: **M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING**

Independent Human Review: **PENDING_INDEPENDENT_HUMAN_REVIEW**

## 1. Starting HEAD

The rerun started from `2a5abd90b08a12b87ad2e954ebc7a13ba7d666c1` (`M2.3.2: preserve unresolved DeepSeek boundary evidence`). The commit was the checked-out HEAD and the working tree was clean.

## 2. Starting worktree and safety state

`.env.local` was ignored and untracked. No Git remote was configured. Starting evidence scans contained no credential values, Authorization values, full Directive state, private local paths, private image bytes, email addresses, or phone numbers. Baseline text/SHA false positives were inspected and excluded.

## 3. Budget correction

The previous 20-request limit incorrectly treated 20 independent Corpus scenarios as equivalent to 20 Provider HTTP requests. Because every scenario contractually permits Attempt 1 and Attempt 2, the corrected protection ceiling is 40 requests while the Corpus remains exactly 20 scenarios. Token and runtime ceilings are 50,000 and 30 minutes. This is a verification-harness change only; no product behavior was changed.

## 4. No-quota Gate

Every required command was re-executed before Live:

- `npm install`: exit 0; dependencies already current.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; 277 passed, 3 environment-gated Live tests skipped.
- `npm run benchmark:eoe`: exit 0; 45/45.
- `npm run benchmark:naturalness`: exit 0; 45 actual outputs regenerated.
- `npm run replay:m2.3-live-failures`: exit 0; 51/51.
- `npm run build`: exit 0.
- `npm run test:e2e`: exit 0; Desktop and 390x844 Mobile 20/20 on a controlled Mock production server.

## 5. Corpus execution

The original 20 scenarios were executed 20/20, in the original order and with the original Provider routing. No scenario was added, deleted, reordered, substituted, skipped, or counted from Mock evidence.

## 6. Provider request count

22 real Provider HTTP requests were made out of the maximum 40.

## 7. Validator Retry count

Two retry attempts occurred. `corpus-complex-opinion-ai` retried `provider_template_parse_failed`; `corpus-plan-study` retried `template_boundary_invalid`. Both regenerated complete Templates and passed on Attempt 2. No scenario exceeded two attempts.

## 8. Token usage

20,533 / 50,000 Provider tokens.

## 9. Provider runtime

61,606 / 1,800,000 ms (61.606 seconds of measured Provider runtime).

## 10. Per-Provider success rates

- GLM-4.7: 10/10, 100.0%.
- GLM-4.6V: 1/1, 100.0%.
- DeepSeek V4 Flash: 9/9, 100.0%.

## 11. Overall success rate

20/20, 100.0% Final Provider Structured Response Success. Every final outcome was `valid_provider_structured_response`.

## 12. noFit count

15 valid Provider noFit responses. Natural Fallback is not included.

## 13. English Chunk count

Five final responses displayed an English Chunk. Positions were four `sentence_middle` and one `sentence_start`.

## 14. Natural Fallback count

Zero.

## 15. Template Final Parse rate

20/20, 100.0%.

## 16. Placeholder Contract Final rate

20/20, 100.0%.

## 17. Mapper reached success rate

20/20, 100.0%.

## 18. Domain Schema reached success rate

20/20, 100.0%.

## 19. Domain Validator reached success rate

20/20, 100.0%.

## 20. Violation codes

The two Attempt 1 violations were `provider_template_parse_failed` and `template_boundary_invalid`. Both were retryable under existing policy and both Attempt 2 responses passed. No new violation policy or correction was added.

## 21. Capability Probe evidence

`PRIOR_UNCHANGED_EVIDENCE`: 6/6 PASS. It was not re-executed in this rerun and is not represented as new Live usage.

## 22. Fallback Probe evidence

`PRIOR_UNCHANGED_EVIDENCE`: PASS. It was not re-executed in this rerun and is not represented as new Live usage.

## 23. npm audit

`npm audit` was executed. It exited 1 with two moderate `postcss` advisories inherited through `next`; npm reports no fix available. No dependency or product-code change was made in response during this verification-only task.

## 24. Security scan

Final high-signal scans of the final report, budget ledger, replay captures, and human-review package found zero credential values, Bearer values, Authorization values, complete Directive state, private local paths, private image bytes, email addresses, or phone numbers. All Live inputs are repository-owned Golden Corpus cases. `.env.local` remains ignored and untracked.

## 25. Final status

`M2_TECHNICAL_PASS_HUMAN_REVIEW_PENDING`.

The technical gate is complete. This status does not assert conversational naturalness or independent acceptance.

## 26. Human Review Package

Created at `artifacts/human-review/m2-final/` with:

1. `REVIEW_INDEX.md`
2. `LIVE_CORPUS_REVIEW.md`
3. `NATURALNESS_BENCHMARK_REVIEW.md`
4. `PHRASE_USAGE_SUMMARY.md`
5. `NO_FIT_SUMMARY.md`
6. `REVIEW_CHECKLIST.md`

The Live review and checklist contain all 20 scenarios; the Naturalness review contains the 45 actual outputs. No checklist item is pre-approved.

## 27. M3 and Adaptive Progression

M3 remains blocked pending Independent Human Review. Adaptive Progression was not started. No push, deployment, remote creation, Provider change, Corpus change, Phrase change, Directive change, Validator change, Mapper change, or scenario-specific product branch occurred.
