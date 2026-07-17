# M2.5 Completion Report

Final status: `M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`

This report records executed evidence only. M2.4.2 remains `M2_4_2_STOPPED_WITH_BLOCKERS`; no Vision result was relabeled, M3 was not started, and Adaptive Progression remains disabled.

## 1. Starting checkpoint

- Starting HEAD: `db2105d`.
- Clean-worktree checkpoint: `b23cc30 M2.5 checkpoint: preserve vision blockers before text beta`.
- Initial checks confirmed `.env.local` ignored and untracked, no Git remote, ports 3100/3200/3201 free, and no retained test server.
- Existing M2.4.2 Vision reports and failure evidence were not edited or deleted.

## 2. Text-First Scope decision

- Product scope: EOE Chat Text-First Fixed-Level Beta.
- Included: ordinary text chat, questions, analysis, advice, technical explanations, plans, comparisons, emotional responses, natural Overlay, Phrase reuse, Vocabulary Assistance, Chinese-only scope, multi-turn context, local storage, PWA, Desktop and Mobile.
- Excluded from this Beta: image upload, image analysis and image English Overlay.
- Scope commit: `c7fabb4 M2.5 scope: define text-first fixed-level beta`.

## 3. Image deferral reasons

Image capability is `DEFERRED_EXPERIMENTAL_FEATURE` because the GLM Vision path still has timeout and Chinese-only surface-text risks, while image input is not required for the core text conversation product. This is a scope decision, not a Vision PASS.

## 4. Image Feature Flag

- `EOE_ENABLE_IMAGE_INPUT=false` is the Beta default.
- Default UI hides the image picker.
- API and Provider Gateway block image requests before Vision selection.
- Explicit configuration plus Developer Mode can restore the retained experimental path.
- Historical image messages and IndexedDB v4 remain readable with a stable historical status.
- Feature commit: `86d6346 M2.5 beta: defer image input behind feature flag`.

## 5. Text Focused Probe

- Execution Mode: `live_probe`.
- Run ID: `m2-5-text-focused-2026-07-17T03-46-20-102Z`.
- First result: 3/5.
- Initial failures: DeepSeek plan validation fell into Natural Fallback; the Assistance evidence check rejected a valid natural contextual-meaning surface.
- Final complete result after the one allowed retry cycle: 5/5.
- Vision requests: 0.

## 6. Targeted Retry

- Targeted Retry cycles used: 1/1.
- Affected-only rerun: 2/2 PASS.
- Full five-scenario rerun: 5/5 PASS.
- General fix: ordinary planning text containing “知识点” is no longer mistaken for Teacher Mode; actual Teacher Mode patterns remain blocked.
- Test-only correction: the Assistance check accepts the valid “在这里：暂时/目前” contextual-meaning form.
- Regression tests were added before the retry, then the complete no-quota Gate was rerun.

## 7. Text Core19

- All 19 original non-image Core20 scenarios executed.
- Result: 17/19 PASS.
- Failures:
  - `core-advice-choice`: comparison recording and trade-off evidence missing after two attempts; Natural Fallback used.
  - `core-technical-typescript`: both generated attempts were rejected and Natural Fallback used.
- Original `image-overview` remains `DEFERRED_BY_TEXT_BETA_SCOPE`.

## 8. Opportunity12

- All 12 scenarios executed.
- Result: 11/12 PASS.
- Failure: `opportunity-advice-daily` lacked a concrete task assignment after two attempts and entered Natural Fallback.
- No English-appearance quota was applied.

## 9. Multi-Turn8

- All eight real-history groups executed.
- Result: 7/8 PASS.
- Meaning, pronunciation, click assistance, Phrase reuse, difficulty reduction, Chinese-only scope and English resumption passed.
- Failure: `multi-ambiguity` did not ask which of two prior Phrases the user meant after two attempts and entered Natural Fallback.

## 10. Task Completeness

- Severe Task Completeness failures: 3/39.
- Failed scenarios: `core-advice-choice`, `opportunity-advice-daily`, `multi-ambiguity`.
- `core-technical-typescript` had a complete Natural Fallback surface according to the deterministic review but is still a failed scenario because Natural Fallback cannot count as PASS.
- Phrase replacement of the core task: 0.
- Incorrect context denial: 0.

## 11. Vocabulary Assistance

- Provider-backed source Assistance passed for Core clarification plus Multi-Turn meaning, pronunciation and click.
- Source-sentence errors: 0.
- `providerContentPass=true` and `assistanceContentFallback=false` on the three explicit Assistance paths.
- Multi-Phrase ambiguity remains blocked separately because the generated answer failed to request disambiguation.

## 12. User Phrase Reuse

- Five Corpus records contained explicit reuse evidence:
  - `core-user-english-opinion`
  - `opportunity-user-english`
  - `opportunity-phrase-reuse`
  - `multi-reuse`
  - `multi-resume-english`
- Reuse Detector, candidate recording, cooldown bypass and final response paths passed.

## 13. English Chunk

- Corpus scenarios displaying an English Chunk: 21/39.
- Every displayed Chunk is traceable to the candidate selection and Phrase Registry.
- No fixed English count was required.

## 14. noFit

- Corpus noFit responses: 14/39.
- Four Assistance/clarification responses used neither automatic English Chunk nor noFit, as expected for explicit Assistance.
- noFit did not excuse task incompleteness.

## 15. noFitReason

Corpus distribution:

- `other`: 4
- `no_safe_candidate`: 1
- `sensitive_context`: 2
- `phrase_not_natural`: 3
- `conversation_too_short`: 2
- `explicit_chinese_request`: 2

## 16. Natural Fallback

- Focused final gate: 0.
- Corpus: 4.
- Natural Fallback cases were never counted as PASS.
- These four cases are the direct reason for `M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`.

## 17. Live Request

- Focused Ledger: 14/20 requests.
- Corpus Ledger: 48/100 requests.
- Total formal text Live requests: 62.
- All requests were preregistered and reconciled in `eoe.live-budget.v2` Ledgers.
- Pending attempts: 0; unannotated attempts: 0; Vision attempts: 0.

## 18. Token Usage

- Focused: 16,485/35,000.
- Corpus: 55,575/150,000.
- Total: 72,060 Provider tokens.

## 19. Provider Runtime

- Focused: 68,143/1,800,000 ms.
- Corpus: 241,142/5,400,000 ms.
- Total Provider runtime: 309,285 ms.

## 20. Environment Isolation

- Formal runs used separate `live_probe` and `live_corpus` identities and Ledgers.
- Ports: Focused 3200, Corpus 3201.
- Runtime identity was verified before Provider requests.
- No stale server was reused.

## 21. Mock Live Request

- Mock E2E identity: `EOE_EXECUTION_MODE=mock_e2e`.
- Provider: `MockProvider`.
- Live requests: 0.
- Image-off native Vision request tests: 0.

## 22. No-quota tests

Executed with exit 0 after the retry fix:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run benchmark:eoe`
- `npm run benchmark:structure`
- `npm run benchmark:naturalness`
- `npm run replay:m2.3-live-failures`
- `npm run build`
- `npm run test:e2e`

The final-state complete test run reported 350 PASS and 7 skipped. `benchmark:naturalness` printed `DEPRECATED_ALIAS — use benchmark:structure`. Structural evidence was not treated as naturalness evidence.

## 23. UI validation

- Desktop Chromium and 390×844 Mobile: 22/22 E2E PASS.
- Normal chat landing, text send, history restore, new conversation, image entry absent, English Chunk interaction, topic continuation, hidden Developer Panel and PWA manifest passed.
- Screenshots:
  - `artifacts/screenshots/m2.5-text-beta-desktop.png`
  - `artifacts/screenshots/m2.5-text-beta-mobile-390x844.png`

## 24. npm audit

- `npm audit --json` executed.
- Exit code: 1 because vulnerabilities were reported.
- Result: 2 moderate, 0 high, 0 critical.
- Affected chain: direct `next` through transitive `postcss` advisory GHSA-qx2v-qp2m-jg93.
- `fixAvailable=false`.
- No `npm audit fix` or force operation was run.

## 25. Security scan

- Intended M2.5 evidence/code files scanned: 26.
- API key/secret value matches: 0.
- Authorization header value matches: 0.
- Private path matches: 0.
- Full Directive matches: 0.
- Embedded image-byte matches: 0.
- `.env.local` remains ignored and untracked.

## 26. Git commits

- `b23cc30 M2.5 checkpoint: preserve vision blockers before text beta`
- `c7fabb4 M2.5 scope: define text-first fixed-level beta`
- `86d6346 M2.5 beta: defer image input behind feature flag`
- Final evidence subject: `M2.5 evidence: preserve text beta blockers`
- No push, deploy, remote creation, rebase, squash or global Git configuration change was performed.

## 27. Final status

`M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`

The Focused Gate passed, but the complete Corpus passed only 35/39 and four failed scenarios used Natural Fallback.

## 28. Independent Human Review

`NOT_STARTED_TECHNICAL_GATE_FAILED`

Codex did not declare human naturalness PASS. Because the technical gate failed, no independent review package was created.

## 29. Image Vision Track status

`DEFERRED_EXPERIMENTAL_FEATURE`

M2.4.2 remains `M2_4_2_STOPPED_WITH_BLOCKERS`. Image code and historical evidence are retained for a separate Vision Track.

## 30. M3 status

`BLOCKED`

Adaptive Progression remains `DISABLED`.

## 31. Human review package path

Planned path: `artifacts/human-review/m2-text-beta/`

Actual state: not created because the M2.5 technical gate failed.
