# M2.4.2 Completion Report

## 1. Starting Git checkpoint

The task started from `2c100db` with a clean tree. Local checkpoint `01e2161` preserves the prior unmetered incident before implementation.

## 2. Previous Execution Incident

`M2_4_1_EXECUTION_INCIDENT.md` was not deleted or rewritten. Previous request count, tokens, and Provider runtime remain `UNKNOWN` and were not imported into the new Ledger.

## 3. Environment Isolation

Implemented fail-closed isolation at launcher, server startup, runtime identity, Provider factory, and Adapter transport boundaries.

## 4. Execution Mode

Implemented `unit`, `mock_e2e`, `structure_benchmark`, `replay`, `live_probe`, `live_corpus`, and `production`. Only the two Live modes can proceed to native transport.

## 5. E2E Mock Guard

`npm run test:e2e` explicitly forces Mock mode after inherited values, owns port 3100, verifies server identity before every test, and reported zero live requests.

## 6. Live Authorization Guard

Live transport requires the correct mode, `EOE_ALLOW_LIVE_PROVIDER=true`, Run ID, Ledger path, both keys, and a matching Ledger. Missing conditions fail with `LIVE_PROVIDER_BLOCKED_BY_EXECUTION_GUARD`.

## 7. Port Isolation

Mock E2E used 3100 and Focused Live used 3200. Port 3201 was reserved but unused because Corpus was blocked. Unknown listeners are not reused; all three ports were released at completion.

## 8. Server Identity

Temporary safe identity contains mode, Run ID, PID, port, Provider mode, and start timestamp. The client verifies it before tests; temporary state is deleted on shutdown.

## 9. Budget Ledger

The new `eoe.live-budget.v2` Ledger pre-registers every transport attempt and atomically records Usage, latency, outcome, pipeline, violation, fallback, Natural Fallback, and security state. The final Focused totals are 14 requests, 14,368 tokens, and 128,099 ms.

## 10. No-quota tests

The required 20 isolation cases are covered by 25 tests. Post-fix full results:

- `npm install`: exit 0;
- `npm run lint`: exit 0;
- `npm run typecheck`: exit 0;
- `npm run test`: 338 passed, 5 old Live suites skipped, exit 0;
- `npm run benchmark:eoe`: 45 passed, exit 0;
- `npm run benchmark:structure`: 1 passed, exit 0;
- `npm run benchmark:naturalness`: 1 passed, exit 0 and printed `DEPRECATED_ALIAS — use benchmark:structure`;
- `npm run replay:m2.3-live-failures`: 51 passed, exit 0;
- `npm run build`: exit 0;
- `npm run test:e2e`: 22 passed across Desktop and 390×844 Mobile, exit 0, live requests 0.

After the final Ledger-annotation fix, the focused no-quota subset passed 49/49, lint and typecheck remained exit 0.

## 11. Focused Probe

The first formal run executed 7/7 scenarios but passed 4/7. Passing cases were GLM text Overlay, explicit Chinese noFit, DeepSeek plan, and Vocabulary Assistance. Failed cases were two Vision scenarios and DeepSeek User Phrase Reuse.

## 12. Targeted Retry

Exactly one Targeted Retry cycle was used. A strict Vision compatibility mapper and a live-safe clause-stem false-positive fix were covered by regression tests; Validator thresholds were not relaxed. The affected subset passed 1/3: User Phrase Reuse passed, the grounded image request timed out, and the explicit-Chinese image answer included English visible text. The required affected-subset gate failed, so the complete 7-scenario rerun was not executed.

## 13. Core20

Not executed. Blocked by Focused Probe.

## 14. Opportunity12

Not executed. Blocked by Focused Probe.

## 15. Multi-Turn8

Not executed. Blocked by Focused Probe.

## 16. Image4

Not executed. Blocked by Focused Probe.

## 17. English Chunk distribution

Across the ten executed scenario evaluations, two displayed an English Chunk: `a little` in cycle one and `I think` in the targeted retry. There was no English quota.

## 18. noFit distribution

Seven of ten executed scenario evaluations returned noFit. noFit remained a valid non-Overlay outcome and did not excuse missing task content.

## 19. noFitReason distribution

Across displayed evaluations: `explicit_chinese_request` 3, `image_overlay_deferred` 2, `phrase_not_natural` 1, and `other` 1.

## 20. Task Completeness

Cycle one was complete in 5/7; both initial image fallbacks were incomplete. The targeted subset was complete in 2/3; the timed-out grounded image remained incomplete. The zero-severe-failure gate was not met.

## 21. Assistance Outcome

Vocabulary Assistance passed 1/1 with the correct source message, source sentence, `p-for-now`, Registry pronunciation, contextual meaning, topic continuation, `providerContentPass=true`, and `assistanceContentFallback=false`.

## 22. Image Grounding

Initial image grounding passed 0/2 because the Provider's semantically valid alternate DTO shape was rejected. In the targeted retry, one Observation normalized and grounded correctly but violated Chinese-only surface; the other timed out. Image grounding therefore did not clear the gate.

## 23. User Phrase Reuse

Cycle one detected `p-i-think` but rejected both meta-preamble realizations and used Natural Fallback. The targeted retry detected the same Phrase and produced a valid substantive realization with no fallback.

## 24. Natural Fallback

Natural Fallback occurred in three cycle-one scenarios and one targeted scenario evaluation. It was never counted as pass.

## 25. Request Count

14/30 formal Provider HTTP requests. Provider split: GLM text 4, GLM Vision 5, DeepSeek 5. Thirteen completed successfully at HTTP level; one GLM Vision request timed out.

## 26. Token Usage

14,368/40,000 Provider-reported total tokens.

## 27. Provider Runtime

128,099/1,800,000 ms.

## 28. npm audit

`npm audit --json` returned exit 1 with two moderate findings: the direct `next` dependency is affected through `postcss`, advisory `GHSA-qx2v-qp2m-jg93`. High: 0; critical: 0; `fixAvailable=false`. No audit fix was applied.

## 29. Security scan

355 repository files were scanned. Exact configured-secret matches outside ignored environment files: 0. Artifact private-path hits: 0. Authorization-value hits: 0. Full Directive hits: 0. Image-byte hits: 0. Test data is synthetic corpus content and repository fixtures.

## 30. Git commits

- `01e2161` — `M2.4.2 checkpoint: preserve unmetered live execution incident`
- `fb336f6` — `M2.4.2 live guard: add audited provider budget ledger`
- Final evidence commit: `M2.4.2 evidence: preserve isolated live blockers`

No push, remote, deploy, rebase, squash, or global Git configuration change occurred.

## 31. Final status

`M2_4_2_STOPPED_WITH_BLOCKERS`

## 32. Independent Human Review status

`NOT_READY`. Codex does not declare human naturalness pass.

## 33. M3 status

M3 remains `BLOCKED`. Adaptive Progression remains `DISABLED`.

## 34. Human-review package path

Not created. `artifacts/human-review/m2.4.2/` is intentionally absent because the technical gate did not pass.

## Evidence paths

- `artifacts/benchmarks/m2.4.2-focused-live-budget.json`
- `artifacts/benchmarks/m2.4.2-focused-probe-cycle-1-report.md`
- `artifacts/benchmarks/m2.4.2-focused-targeted-affected-report.md`
- `artifacts/benchmarks/m2.4.2-focused-provider-output-hashes.md`
- `artifacts/benchmarks/M2_4_2_FOCUSED_FAILURE_EVIDENCE.md`
