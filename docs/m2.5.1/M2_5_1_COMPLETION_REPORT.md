# M2.5.1 Completion Report

Status: `M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`

## 1. Starting checkpoint

- Baseline HEAD: `09a47a3`
- Checkpoint: `7e9f720` — `M2.5.1 checkpoint: preserve final text beta blockers`
- Implementation: `a6b71f9` — `M2.5.1 completeness: close comparison and daily advice gaps`
- Frozen M2.5 result: 35/39; Natural Fallback 4; Focused Probe 5/5.

## 2. Four failed scenarios

- `core-advice-choice`
- `core-technical-typescript`
- `opportunity-advice-daily`
- `multi-ambiguity`

## 3. Real root causes

- Comparison: disproportionate obligation definition, incomplete Provider realization, and imprecise retry correction.
- Daily advice: lightweight leisure advice was incorrectly treated as a structured plan.
- Ambiguity: the Engine detected multiple historical Phrases but delegated disambiguation to the Provider.
- TypeScript: the frozen M2.5 run was a task-realization failure; M2.5.1 retained raw Templates and confirmed a deterministic `validator_false_positive` caused by brittle lexical ordering and distance windows.
- The M2.5 raw Template retention gap is preserved in `FINAL_BLOCKER_ROOT_CAUSE.md`; no Template was reconstructed.

## 4. Comparison Requirements

`ComparisonDecisionRequirements` now derives proportional dimensions, user priority, trade-off, recording method, optional reversible trial, and next action. It reports exact missing codes and does not require headings or a fixed table.

## 5. Daily Advice Requirements

`DailyAdviceRequirements` requires concrete daily-life actions, proportional assignment, a start condition, and an adjustment only when applicable. Explicit requests containing `计划` remain on the existing structured plan path.

## 6. Phrase Ambiguity Resolution

`PhraseReferenceResolutionV1` deterministically returns `resolved`, `ambiguous`, or `not_found`. An ambiguous response is Engine-owned, lists real canonical candidates, makes zero ordinary Provider requests, creates no Exposure, and is not Natural Fallback.

## 7. Technical Identifier Classification

The roles `code_identifier`, `technical_term`, `english_overlay`, `vocabulary_assistance`, and `unsolicited_teaching` are explicit. Technical identifiers are ordinary domain content and do not consume Overlay budget or receive Phrase boundary/position rules.

The final blocker is not a teaching-mode misclassification. The isolated retry Attempt 2 was substantively correct but failed the technical-evidence matcher on `禁用` and a long valid narrowing sentence.

## 8. Validator strictness

The deterministic Validator remained enabled. No violation was bypassed, no result was string-patched, and Natural Fallback was never relabeled PASS. The one retry changed only observed safe lexical ordering; it still rejected unseen valid wording.

## 9. No-quota verification

After the final minimal retry change, all required commands were re-executed:

- `npm.cmd install`: exit 0; 462 packages audited; 2 moderate vulnerabilities reported.
- `npm.cmd run lint`: exit 0.
- `npm.cmd run typecheck`: exit 0.
- `npm.cmd run test`: exit 0; 50 files passed, 7 skipped; 371 tests passed, 7 skipped.
- `npm.cmd run benchmark:eoe`: exit 0; 45/45.
- `npm.cmd run benchmark:structure`: exit 0; 1/1.
- `npm.cmd run benchmark:naturalness`: exit 0; emitted `DEPRECATED_ALIAS — use benchmark:structure`; 1/1.
- `npm.cmd run replay:m2.3-live-failures`: exit 0; 51/51.
- `npm.cmd run build`: exit 0.
- `npm.cmd run test:e2e`: exit 0; Desktop and 390×844 Mobile 22/22; MockProvider; Live requests 0.

An earlier E2E pass before classification narrowing exposed 2/22 failures caused by `安排今天的计划` entering Daily Advice. The classifier was narrowed so explicit `计划` stays on PlanRequirements; every later full E2E run passed 22/22.

## 10. Targeted Gate

- Run: `m2-5-1-targeted-2026-07-17T04-43-08-097Z`
- Result: 3/4.
- PASS: comparison, daily advice, multi-Phrase ambiguity.
- FAIL: TypeScript.
- Requests: 5/20.
- Tokens: 7,726/35,000.
- Provider runtime: 23,141/1,800,000 ms.
- Evidence: `artifacts/benchmarks/m2.5.1-targeted-{budget.json,results.json,report.md}`.

A prior identity preflight exited before scenarios because the test expected `live_corpus/3201` instead of `live_probe/3200`. Its ledger is retained with zero requests and zero tokens. It is not counted as the semantic Targeted Retry.

## 11. Targeted Retry

- Performed: yes, exactly once.
- Scope: `core-technical-typescript` only.
- Run: `m2-5-1-targeted-retry-typescript-2026-07-17T04-47-55-680Z`
- Result: 0/1.
- Requests: 2/4.
- Tokens: 3,054/8,000.
- Provider runtime: 9,817/600,000 ms.
- Final four-case rerun: not executed because the isolated affected scenario remained below PASS.

## 12. Core19

Not re-executed because Targeted Gate did not reach 4/4. The frozen M2.5 result remains 17/19. The targeted comparison case passed; the targeted TypeScript case failed. These targeted results are not merged into a claimed Core19 rerun.

## 13. Opportunity12

Not re-executed. Frozen M2.5 result remains 11/12. The targeted daily-advice case passed but is not merged into a claimed corpus result.

## 14. Multi-Turn8

Not re-executed. Frozen M2.5 result remains 7/8. The targeted ambiguity case passed with Engine-owned disambiguation but is not merged into a claimed corpus result.

## 15. Overall 39

Not executed, as required by the Targeted 4/4 prerequisite. Frozen M2.5 remains 35/39. No `m2.5.1-final-corpus-budget.json` exists.

## 16. Task Completeness

Initial targeted run: 3/4 complete. Isolated retry: 0/1 complete according to the deterministic matcher, despite a substantively correct Retry Attempt 2. This unresolved false positive is a blocker under the strict gate.

## 17. English Chunk

Initial targeted final responses: 1/4 contains an English Chunk (`For now` in daily advice). Comparison used Provider noFit, ambiguity was an Engine contextual response, and TypeScript used Natural Fallback.

## 18. noFit

Initial targeted final responses: 3/4 noFit:

- comparison: `provider_phrase_rejected / phrase_not_natural`;
- TypeScript: `contextual_no_fit / other` due Natural Fallback;
- ambiguity: `contextual_no_fit / other`, Engine-owned and not fallback.

## 19. Assistance

The ambiguity turn was correctly detected as unresolved and ambiguous, listed `p-it-depends` and `p-for-now`, made zero Provider requests, did not deny history, and did not create Exposure. Existing resolved Vocabulary Assistance regressions passed.

## 20. Phrase Reuse

Not re-executed in the targeted run. Existing no-quota regressions pass; the frozen M2.5 User Phrase Reuse result remains PASS.

## 21. Natural Fallback

- Initial Targeted: 1 (`core-technical-typescript`), counted FAIL.
- Isolated Retry: 1 (`core-technical-typescript`), counted FAIL.
- No comparison, daily, or ambiguity Natural Fallback remained.

## 22. Requests

- Identity preflight: 0.
- Initial Targeted: 5.
- Isolated Retry: 2.
- Total M2.5.1 Provider HTTP requests: 7.

## 23. Tokens

- Identity preflight: 0.
- Initial Targeted: 7,726.
- Isolated Retry: 3,054.
- Total: 10,780.

## 24. Runtime

- Identity preflight Provider runtime: 0 ms.
- Initial Targeted Provider runtime: 23,141 ms.
- Isolated Retry Provider runtime: 9,817 ms.
- Total Provider runtime: 32,958 ms.

## 25. npm audit

- `npm.cmd audit`: exit 1.
- Reported: 2 moderate-severity vulnerabilities in `postcss`, inherited through `next`.
- Advisory: `GHSA-qx2v-qp2m-jg93`.
- npm reported `No fix available`.
- No `npm audit fix --force` or dependency-major-version override was run.

## 26. Security scan

The final scan covered all 18 modified/untracked files and found zero matching files for:

- API-key-like credential values;
- Bearer credentials;
- Authorization values;
- workspace-specific user-profile absolute paths;
- full `<EOE_TEMPLATE_STATE>` Directive payloads;
- embedded image bytes or data URLs.

`.env.local` is ignored by `.gitignore` and untracked. Git has no configured remote. Ports 3100, 3200, and 3201 have zero listeners. `.eoe-runtime` contains zero files. The M2 Text Beta final Human Review package does not exist.

## 27. Git commits

- `7e9f720` — checkpoint.
- `a6b71f9` — verified implementation.
- Final failure-evidence commit uses the authorized subject `M2.5.1 evidence: preserve final beta blockers`.
- No push, deploy, remote creation, rebase, or squash.

## 28. Final state

`M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`

The stop condition is the failed one permitted Targeted Retry. No M2.5.2 may be created automatically.

## 29. Human Review Package

Not created. Case A and Case B were not reached. Independent Human Review is `NOT_STARTED_TECHNICAL_GATE_FAILED`.

## 30. M3

`BLOCKED`. Adaptive Progression remains `DISABLED`. Image input remains deferred and disabled by default.
