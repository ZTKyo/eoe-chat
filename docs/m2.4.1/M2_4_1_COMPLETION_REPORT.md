# M2.4.1 Completion Report

Status: `M2_4_1_STOPPED_WITH_BLOCKERS`

This is a technical completion report, not a naturalness PASS. Historical M2/M2.4 evidence remains frozen. M3 and Adaptive Progression remain blocked.

## 1. Starting checkpoint

- Starting HEAD: `1ffd8be`.
- Clean-state checkpoint created before implementation: `3b7628a` (`M2.4 checkpoint: preserve focused live blockers`).
- `.env.local` was ignored/untracked and no Git remote existed.

## 2. Scope correction reason

M2.4.1 corrects four product-completeness blockers without reopening M2 architecture: grounded image answers, actionable plan structure, Engine-owned Vocabulary Assistance context, and exact user Phrase reuse.

## 3. Image Overlay deferral

Automatic English Overlay is disabled on image turns through `disabled_for_image`. English requested as the user's main task language remains allowed, but it is not an automatic learning Overlay. Image noFit is a policy result, not a naturalness failure.

## 4. Image grounding architecture

The Vision Provider first returns strict `eoe.vision-observation.v1`; the Engine validates and persists it, then makes at most one final-answer call with the Observation and no image attachment. The final answer must reference grounded evidence and state an epistemic boundary. Missing/invalid Observation prevents the final generation and is recorded as failure evidence.

## 5. Assistance Engine ownership

`VocabularyAssistanceContextV2` is resolved from stored semantic segments. The Engine owns Source Message, segment index, Phrase ID/canonical, complete source sentence, Registry pronunciation, previous topic, and assistance type. The Provider only returns contextual meaning, optional short example, and topic continuation.

## 6. Assistance fallback

After two invalid Assistance contents, the Engine constructs a usable response from Registry metadata and topic context. It records `assistanceContentFallback=true` and `providerContentPass=false`; it does not use or report ordinary Natural Fallback.

## 7. Plan requirements

`PlanRequirements` is proportional to the request. Weekly plans require multiple time/stage units, assigned tasks, and feedback adjustment; a simple “today” request does not force a weekly timetable. Retry violations expose exact missing elements such as `missing_timeline`, `missing_stage_structure`, `missing_task_assignment`, `missing_priority`, and `missing_feedback_loop`.

## 8. User Phrase reuse

The detector matches active Registry canonical/variants with exact or normalized boundaries only. A detected user Phrase bypasses ordinary cooldown and receives candidate priority, but cannot bypass high-risk, explicit Chinese/skip, grammatical compatibility, Task Completeness, or Naturalness validation.

## 9. noFit calibration

Image policy records `image_overlay_deferred`; explicit Chinese requests record `explicit_chinese_request`; selector no-candidate remains separate. noFit does not remove the user's task answer or plan structure.

## 10. Validator strictness

The hard and template Validators were not relaxed to make previous failures pass. Image completeness now requires a valid Observation plus grounded final text. Assistance-only `assistance_phrase` segments are permitted only under resolved Assistance context and never become ExposureEvents.

## 11. No-quota tests

Final controlled results:

- `npm install`: exit 0; up to date.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run test`: exit 0; 41 files passed, 5 live files skipped; 309 passed, 5 skipped.
- `npm run benchmark:eoe`: exit 0; 45/45.
- `npm run benchmark:structure`: exit 0; 1/1 structural benchmark.
- `npm run benchmark:naturalness`: exit 0 and printed `DEPRECATED_ALIAS — use benchmark:structure`; 1/1.
- `npm run replay:m2.3-live-failures`: exit 0; 51/51.
- `npm run build`: exit 0.
- `npm run test:e2e`: exit 0 under explicit `USE_MOCK_PROVIDER=true`; Desktop and 390×844 Mobile 22/22.

The final E2E run used an explicitly controlled Mock server and closed it afterward. Earlier E2E attempts are retained as execution evidence: one exposed two obsolete assertions; another external-server attempt mistakenly inherited real-provider mode.

## 12. Focused Probe

`NOT_EXECUTED`. The formal `test:live-m2.4.1-focused` command and its bounded ledger were not started. An external E2E server was launched without explicitly overriding `.env.local`, so it may have made real Provider requests outside the ledger. The request, token, and runtime totals cannot be reliably reconstructed. Continuing would violate the 30-request/40,000-token/30-minute bound.

## 13. Targeted Retry

`NOT_EXECUTED`. There was no formally metered Focused Probe result to retry, and no second repair cycle was opened.

## 14. Core20

`NOT_EXECUTED_LIVE`; prohibited because Focused Probe did not reach 7/7.

## 15. Opportunity12

`NOT_EXECUTED_LIVE`; prohibited because Focused Probe did not reach 7/7.

## 16. Multi-Turn8

`NOT_EXECUTED_LIVE`; prohibited because Focused Probe did not reach 7/7.

## 17. Image4

`NOT_EXECUTED_LIVE`; prohibited because Focused Probe did not reach 7/7. Mock Observation and image E2E coverage passed and remains structural evidence only.

## 18. Task Completeness

Deterministic/Mock coverage passes for image grounding, proportional plan requirements, exact retry codes, Assistance source/continuation, and ordinary M1–M2.4 regressions. Live severe-failure count is unknown because the formal corpora were not run.

## 19. English Chunk

Structural suites and Mock E2E pass. No new formal live distribution is reported.

## 20. noFit

Structural suites pass for explicit Chinese, image policy, selector no-candidate, and fallback separation. No new formal live distribution is reported.

## 21. Natural Fallback

Mock tests confirm fallback is not counted as a successful Focused scenario. No formal live result is reported.

## 22. Request count

Formal M2.4.1 Focused ledger: not created / 0 metered requests. Overall real-provider request count for this execution is `UNKNOWN` because of the E2E environment mistake; the allowed bound therefore cannot be certified.

## 23. Token usage

`UNKNOWN`; no claim of staying within 40,000 tokens is made.

## 24. Provider runtime

`UNKNOWN`; no claim of staying within 30 minutes is made.

## 25. npm audit

`npm audit` executed and exited 1 with two moderate findings in the `next` → `postcss` dependency chain (`GHSA-qx2v-qp2m-jg93`); npm reports no fix available. No `npm audit fix --force` was run.

## 26. Security scan

Final changed/new-file scan covered 49 text files and found zero key-like secrets, Bearer values, Authorization values, private user paths, complete Directive bodies in new evidence, image bytes in new evidence, or privacy patterns. `.env.local` is ignored and untracked; Git remote count is zero. Historical reports still contain their previously frozen redacted tokens/patterns and were not modified.

## 27. Git commits

- `3b7628a` — `M2.4 checkpoint: preserve focused live blockers`.
- Final local evidence commit is recorded in the task handoff; no push, remote, rebase, or squash is authorized.

## 28. Final status

`M2_4_1_STOPPED_WITH_BLOCKERS` because live-budget integrity cannot be proven and Focused Probe 7/7 was not executed.

## 29. Independent Human Review status

`NOT_CREATED`. The M2.4.1 human-review package may only be created after formal Focused Probe 7/7 and all conditional corpora execute.

## 30. M3 status

`BLOCKED`. Adaptive Progression remains disabled and was not implemented.

## 31. Human-review package path

Not created. The reserved path is `artifacts/human-review/m2.4.1/` and must remain absent until all live gates pass.
