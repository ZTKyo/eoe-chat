# M2.3.2 Completion Report

Status: **M2_3_2_STOPPED_WITH_BLOCKER**

## 1. Starting checkpoint

Pre-change local checkpoint: `cb353ba` — `M2 autonomous checkpoint: preserve DeepSeek boundary blocker`. Historical commits `8a9820e`, `d390ae9`, and `dce8ee5` remain present. No rebase, squash, history deletion, push, deployment, or remote creation occurred.

## 2. Two historical failure fixtures

Both preserved `corpus-long-analysis` attempts were read before implementation and replay exactly as `template_boundary_invalid`. Attempt 1 joined `run` directly to `最`; Attempt 2 joined both `但` to `in` and `run` to `最`. Details are in `DEEPSEEK_BOUNDARY_ROOT_CAUSE.md`.

## 3. Root cause

The deterministic root was Provider realization plus insufficiently robust Phrase frame/retry precision. Parser and schema parsing succeeded; Mapper was not reached; the Validator correctly rejected visibly invalid token boundaries.

## 4. Direction selection

Direction A was selected because `p-in-the-long-run` is semantically and grammatically appropriate in the long-analysis context when punctuation-delimited. The evidence did not support globally disabling the Phrase or removing `sentence_middle`.

## 5. Phrase Metadata change

`p-in-the-long-run` changed from one lexically narrow whitespace-dependent bilingual pattern to two reusable explicit-punctuation frames. `allowedPositions` and realization-profile restrictions were not changed. Registry version advanced from `eoe.phrases.v1.1` to `eoe.phrases.v1.2` so displayed exposure remains traceable.

## 6. Directive change

The generic `template_boundary_invalid` retry correction now requires exact preservation of placeholder-adjacent punctuation/whitespace from a selected safe frame. If a fresh natural answer cannot preserve a safe frame, the Provider must return a complete valid `usePhrase=false` Template with `noFitReason=grammar_mismatch`.

## 7. Candidate Gate change

None. Candidate Selector and its thresholds are unchanged. No scenario ID, user text, corpus ID, or fixed answer is present in production logic.

## 8. Validator strictness

Template Validator and Domain Validator are unchanged. Direct Chinese attachment, translation duplication, labels, isolated chunks, disallowed positions, and discontinuous Domain boundaries remain rejected.

## 9. Regression tests

Added 15 general tests covering every requested boundary, retry, noFit, fallback, Mapper, Domain Validator, metadata, and historical replay case. Targeted execution passed 15/15; related Directive tests brought the targeted total to 18/18.

## 10. No-quota test gate

Final successful results:

- `npm install`: exit 0; dependencies already current.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; 277 passed, 3 Live tests skipped by environment.
- `npm run benchmark:eoe`: exit 0; 45/45.
- `npm run benchmark:naturalness`: exit 0; 45 scenarios, report written.
- `npm run replay:m2.3-live-failures`: exit 0; 51/51.
- `npm run build`: exit 0.
- `npm run test:e2e`: final exit 0; Desktop and 390x844 Mobile 20/20.

The first E2E attempt completed 20/20 assertions but timed out during Playwright-managed dev-server cleanup (exit 124). A diagnostic external-server run omitted `USE_MOCK_PROVIDER=true` and failed 6 provider-dependent assertions. After restarting a controlled production server with Mock enabled, the same npm command exited 0 with 20/20. Neither diagnostic run was charged to the M2.3.2 Live ledger.

## 11. Single affected scenario

PASS. `corpus-long-analysis` produced a valid English Chunk Structured Response on Attempt 2, with `p-in-the-long-run` at `sentence_middle`, no Natural Fallback, 3,722 ms aggregate latency, and 2,277 tokens. Attempt 1 remained correctly rejected for `template_boundary_invalid`.

## 12. DeepSeek three-scenario stage

PASS, 3/3: long analysis, a known English Chunk, and a known Provider noFit. The cumulative stage used four HTTP requests because long analysis required its allowed retry. Natural Fallback count was zero.

## 13. Original DeepSeek 9-case Corpus

PASS, 9/9 legal final Provider Structured Responses. Template final parse, Mapper, Domain Schema, and Domain Validator all passed for each final response. Natural Fallback was zero. This stage used 10 HTTP requests, 9,416 tokens, and 12,820 ms Provider runtime.

## 14. Original full 20-case Corpus

NOT COMPLETED. The cumulative run recorded 17 valid Provider Structured Responses. When `corpus-short-ok` began, the budget guard rejected its first Provider call because 20/20 real request slots had already been consumed by the 17 completed cases plus three Validator retries. That case entered Natural Fallback and correctly failed the gate; `corpus-user-english-opinion` and `corpus-ask-phrase-clarify` were not started. Natural Fallback was not counted as success.

This is a terminal blocker under the task contract. The hard 20-request ceiling cannot both permit retries and guarantee execution of all 20 unique Corpus cases. No additional Live request or repair cycle was started.

## 15. Capability Probe

Prior unchanged evidence remains 6/6. It was not re-executed because all 20 newly authorized request slots were reserved for the required Corpus. No Provider adapter or capability path changed.

## 16. Fallback Probe

Prior unchanged evidence remains PASS. It was not re-executed under the same hard request cap. Provider fallback behavior was not changed.

## 17. Final Structured Response rate

Affected stage: 1/1. DeepSeek three-stage: 3/3. Original DeepSeek Corpus: 9/9. Completed Provider cases in the progressive full run: 17/17. Gate-visible attempted Corpus records: 17/18 because the budget-blocked `corpus-short-ok` returned Natural Fallback. The required full 20-case rate was not established.

## 18. noFit count

12 valid Provider noFit final responses among the 17 completed Provider cases. The Natural Fallback noFit for `corpus-short-ok` is excluded.

## 19. English Chunk count

5 valid displayed English Chunk responses among the 17 completed Provider cases.

## 20. Natural Fallback count

1 gate-visible Natural Fallback, caused by the budget guard on `corpus-short-ok`; it is recorded as failure and excluded from Structured Response success.

## 21. Latency

Budget ledger Provider runtime: 63,752 ms. The affected long-analysis case used 3,722 ms aggregate Engine-reported latency. The budget-blocked case made no HTTP request and records 0 ms.

## 22. Token usage

19,017 / 30,000 Provider tokens. Request budget, not token or time budget, stopped execution.

## 23. npm audit

`npm audit` was executed and exited 1 with two moderate `postcss` vulnerabilities inherited through `next`; npm reported no fix available. No dependency changes were made in this targeted closure.

## 24. Security scan

Final high-signal scans found zero credential values, Bearer values, Authorization header values, local private paths, full Directive state, private-image bytes, email addresses, or phone-number patterns in M2.3.2 documents and artifacts. `.env.local` remains ignored and untracked. All Live inputs are repository-owned synthetic Golden Corpus cases.

## 25. Git commits

- `cb353ba` — `M2 autonomous checkpoint: preserve DeepSeek boundary blocker`.
- Final local commit message: `M2.3.2: preserve unresolved DeepSeek boundary evidence`.

No push or remote operation is authorized or performed.

## 26. Final status

`M2_3_2_STOPPED_WITH_BLOCKER`.

The original DeepSeek Phrase boundary blocker is technically closed at the affected-case, 3-case, and DeepSeek 9-case gates. The remaining terminal blocker is lack of a completed 20-case Corpus result within the exact 20-request ceiling after three legitimate Validator retries.

## 27. Independent Human Review

`PENDING`. It is not marked PASS.

## 28. M3 and Adaptive Progression

M3 remains blocked and was not started. Adaptive Progression remains disabled and was not started.

## 29. Human-review package

Not created. The package path `artifacts/human-review/m2-final/` is intentionally absent because the technical-pass condition was not reached.
