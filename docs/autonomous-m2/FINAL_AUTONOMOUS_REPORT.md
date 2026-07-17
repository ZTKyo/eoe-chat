# Final Autonomous M2 Report

Final Status: **M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS**

Independent Human Review: **PENDING**

M3: **NOT STARTED**

Adaptive Progression: **NOT STARTED**

The three authorized Repair Cycles are exhausted. The final 6/6 capability gate and fallback gate passed, and the Live Corpus reached 19/20 (95.0%), but DeepSeek's per-Provider valid final response rate was 8/9 (88.9%), below the required 90%. Natural Fallback was not counted as success and no Validator rule was relaxed.

## 1. Starting Git checkpoint

- Commit: `8a9820e`
- Message: `M2.3 checkpoint: preserve live template probe failure`
- Preserved historical result: `LIVE_TEMPLATE_PROBE_FAIL`, 5/9; fallback and Corpus not executed.
- Historical raw M2.3 Template text was not available and was not reconstructed.

## 2. Repair Cycle count

Executed: **3 of 3 authorized cycles**.

## 3. Root cause by cycle

1. Cycle 1: the old gate injected caller-selected sentence positions into production state, conflicting with Provider-selected natural realization.
2. Cycle 2: GLM needed an operational DTO/conditional-field/boundary contract and violation-specific retry correction, not a weaker Validator.
3. Cycle 3: selected Phrase Registry `bilingualPatterns` were not propagated as compact safe grammatical frames, leaving GLM-4.6V to invent an invalid cross-language boundary.

Final remaining blocker: DeepSeek twice joined `p-in-the-long-run` directly to Chinese characters in `corpus-long-analysis`, producing `template_boundary_invalid` and Natural Fallback.

## 4. Modification by cycle

1. Cycle 1 removed `templatePositionPreference` from ChatRequest, Engine, Directive, and Live gate; added a position-neutral six-case gate, exact raw capture, hashes, budget ledger, and offline replay.
2. Cycle 2 moved the exact strict DTO contract to the Directive front, added generic valid/invalid boundary shapes, and mapped observed codes to precise retry corrections.
3. Cycle 3 passed at most two existing bilingual patterns for only the selected Phrase as placeholder-based structural frames and referenced them in boundary retry guidance.

No Provider was substituted to hide GLM behavior. No scenario-specific branch, fixed answer, tolerant parser, string repair, or additional Provider control field was added.

## 5. Regression tests by cycle

1. Cycle 1: Directive position-neutrality; historical failure replay; exact live fixture schema/hash/stage/code replay.
2. Cycle 2: DTO key counts, conditional `noFitReason`, duplicate placeholder, boundary, and violation-specific retry correction assertions.
3. Cycle 3: selected Phrase safe-frame inclusion, placeholder conversion, no Phrase ID leak, and boundary retry reference assertions.

## 6. Local tests by cycle

| Cycle | install | lint | typecheck | test | EOE benchmark | naturalness | replay | build | E2E |
|---|---|---|---|---|---|---|---|---|---|
| 1 | PASS | PASS | PASS | 215 pass, 3 Live skipped | 45/45 | 45 scenarios | 5/5 before Live; 14/14 after | PASS | 20/20 |
| 2 | PASS | PASS | PASS | 225 pass, 3 Live skipped | 45/45 | 45 scenarios | 21/21 after Live | PASS | 20/20 |
| 3 | PASS | PASS | PASS | 232 pass, 3 Live skipped | 45/45 | 45 scenarios | 51/51 after Live | PASS | 20/20 |

Skipped Live suites were never counted as Live passes. Desktop Chromium and 390x844 Mobile passed in every cycle.

## 7. Live Probe by cycle

| Cycle | Capability | Fallback | Corpus | Stop reason |
|---|---:|---|---|---|
| 1 | 3/6 | not executed | not executed | capability gate failed |
| 2 | 5/6 | not executed | not executed | GLM-4.6V English boundary failure |
| 3 | 6/6 | PASS | 19/20 | DeepSeek per-Provider rate 88.9% |

## 8. Real request count by cycle

- Cycle 1: 9.
- Cycle 2: 7.
- Cycle 3: 30.
- Total: **46/60**.

## 9. Token usage by cycle

- Cycle 1: 6,088.
- Cycle 2: 5,939.
- Cycle 3: 27,969.
- Total: **39,996/150,000**.
- Provider runtime: **127,161/5,400,000 ms**.

## 10. Success-rate change

- Historical forced-position checkpoint: 5/9 (55.6%).
- Cycle 1 capability: 3/6 (50.0%) under the corrected, stricter position-neutral definition.
- Cycle 2 capability: 5/6 (83.3%).
- Cycle 3 capability: 6/6 (100%).
- Cycle 3 Corpus: 19/20 (95.0%).

## 11. Final Capability Probe

- GLM-4.7 noFit: PASS.
- GLM-4.7 English Chunk: PASS after one Validator retry.
- GLM-4.6V noFit: PASS.
- GLM-4.6V English Chunk: PASS.
- DeepSeek V4 Flash noFit: PASS.
- DeepSeek V4 Flash English Chunk: PASS.
- Total: **6/6**; Natural Fallback count: 0.

## 12. Final Fallback Probe

**PASS**: controlled GLM retryable failure -> DeepSeek V4 Flash -> strict Template -> Template Validator -> Mapper -> Domain Schema -> Domain Validator. Provider fallback flag was true; Natural Fallback was false.

## 13. Twenty-case Live Corpus

- Final valid structured responses: **19/20 (95.0%)**.
- GLM-4.7: **10/10 (100%)**.
- GLM-4.6V: **1/1 (100%)**.
- DeepSeek: **8/9 (88.9%)**, below the required 90%.
- Failed case: `corpus-long-analysis`; both attempts ended at Template Validator with `template_boundary_invalid`; Natural Fallback was returned and excluded from success.

## 14. Template Parse Rate

- Final-attempt case rate: **27/27 (100%)**.
- Attempt-level rate in final run: **29/30 (96.7%)**; the one first-attempt failure retried successfully.

## 15. Placeholder Contract Rate

- Final-attempt case rate: **27/27 (100%)** for exact placeholder count, usePhrase/noFit consistency, and conditional fields.
- The failed Corpus case had a valid placeholder count but an invalid natural boundary.

## 16. Mapper Rate

- Final case reach-and-pass: **26/27 (96.3%)**.
- Reached Mapper: **26/26 (100%)**.
- The remaining case was correctly stopped at Template Validator before mapping.

## 17. Domain Schema Rate

- Final case reach-and-pass: **26/27 (96.3%)**.
- Reached Domain Schema: **26/26 (100%)**.

## 18. Domain Validator Rate

- Final case reach-and-pass: **26/27 (96.3%)**.
- Reached Domain Validator: **26/26 (100%)**.

## 19. Naturalness Gate Rate

- Reached and accepted: **26/26 (100%)**.
- One case never reached this gate because deterministic Template boundary validation rejected both attempts.
- Natural Fallback was not counted as a Naturalness pass.

## 20. Final Structured Response Rate

- All final Cycle 3 gates combined: **26/27 (96.3%)** valid Provider-generated Domain responses.
- Live Corpus only: **19/20 (95.0%)**.
- Technical pass remains false because DeepSeek's per-Provider rate is below 90%.

## 21. noFit count

Final Cycle 3 displayed responses: **20** noFit responses, including the one Natural Fallback case. Valid Provider-generated noFit responses: **19**.

## 22. English Chunk count

Final Cycle 3 displayed valid English Chunk responses: **7**.

## 23. Natural Fallback count

Final Cycle 3: **1** (`corpus-long-analysis`). It was recorded as failure and excluded from every Live pass rate.

## 24. Violation Codes

Unique codes observed across the autonomous task:

- `provider_template_parse_failed`
- `missing_no_fit_reason`
- `duplicate_placeholder`
- `template_boundary_invalid`

Final Cycle 3 observed `provider_template_parse_failed` on one repaired first attempt and `template_boundary_invalid` on three attempts, including both attempts of the terminal blocker.

## 25. Phrase Position Distribution

Final Cycle 3 valid English Chunks:

- `sentence_middle`: 6.
- `sentence_start`: 1.
- `sentence_end`: 0.
- `standalone`: 0.

No caller forced a position.

## 26. Phrase Metadata changes

Live-Safe Phrase metadata was audited. No Registry value was changed merely to pass a probe. Cycle 3 began propagating the already-existing selected Phrase `bilingualPatterns` as compact safe structural frames; the complete Registry remains absent from the Directive.

## 27. Validator strictness

**UNCHANGED / STRICT**. No Parser, Template Validator, Mapper, Domain schema, Domain Validator, or Naturalness rule was removed or weakened. Invalid boundaries, label-like overlays, translation, Teacher Mode, gloss, pronunciation, and control-field conflicts remain blocked.

## 28. npm audit

`npm install`/audit reported **2 moderate** transitive PostCSS findings. `npm audit fix --force` was not run because it is forbidden and would be a destructive dependency action outside this blocker.

## 29. Security scan

- `.env.local`: ignored and untracked.
- API keys/Bearer tokens/Authorization headers in tracked evidence: 0.
- Full Directive or image bytes in captures: 0.
- Private user content: 0; all exact raw captures come from synthetic prompts.
- Security terminal condition: not triggered.

## 30. Git commits

- `8a9820e` — M2.3 checkpoint: preserve live template probe failure
- `6b77d79` — M2.3.1 diagnostics: add replayable live attempt evidence
- `24b2a43` — M2.3 repair cycle 1: remove forced template placement
- `1fc4796` — M2.3 cycle 1: preserve replayable capability evidence
- `bb09f01` — M2.3 repair cycle 2: clarify template corrections
- `960f312` — M2.3 cycle 2: preserve 5 of 6 capability evidence
- `f6a439d` — M2.3 repair cycle 3: propagate selected phrase safe frames
- `d390ae9` — M2 technical gate: stopped with blockers

The report-only HEAD checkpoint that records `d390ae9` is identified in the task's final response.

No push, remote creation, deployment, rebase, squash, or history rewrite occurred.

## 31. Final status

**M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS**

Automatic stop condition: all three Repair Cycles were completed, while DeepSeek remained below the required per-Provider 90% valid final response rate.

## 32. Independent Human Review

**PENDING**. It was neither performed nor claimed.

## 33. Technical readiness for M3

**NO**. M3 and Adaptive Progression remain unstarted. The capability and fallback chains are proven, but the per-Provider Corpus threshold is not met.

## 34. Next reviewer action

The next reviewer only needs to inspect the two exact replay fixtures for `corpus-long-analysis`, decide whether `p-in-the-long-run` needs a more precise safe realization policy or should be rejected/noFit for that frame, add a general regression, rerun the full no-quota gate, and then rerun the minimum affected DeepSeek capability/Corpus gate under a newly authorized task. Do not relax `template_boundary_invalid` and do not count the existing Natural Fallback as success.

Primary evidence:

- `artifacts/benchmarks/m2.3-live-provider-report.md`
- `artifacts/benchmarks/autonomous-m2-live-budget.json`
- `artifacts/regressions/m2.3-live-captures/`
- `artifacts/screenshots/m2.3-desktop.png`
- `artifacts/screenshots/m2.3-mobile-390x844.png`
