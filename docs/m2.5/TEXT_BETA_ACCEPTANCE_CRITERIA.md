# Text-First Beta Acceptance Criteria

Current status: `M2_TEXT_BETA_STOPPED_WITH_BLOCKERS`

## Scope and feature boundary

- [x] Text-First Beta scope is explicit.
- [x] M2.4.2 Vision failures remain failures.
- [x] Image capability is recorded as `DEFERRED_EXPERIMENTAL_FEATURE`.
- [x] Adaptive Progression remains disabled.
- [x] No Mastery or learning-effectiveness claim is made.

## Image flag

- [x] `EOE_ENABLE_IMAGE_INPUT` defaults to false.
- [x] Default Beta UI hides image input.
- [x] Explicit configuration plus Developer Mode can restore the retained image path.
- [x] API blocks default image requests before engine/provider work.
- [x] Provider Gateway blocks a disabled image request before Vision selection.
- [x] Text input remains available.
- [x] Historical image messages and IndexedDB v4 remain readable.
- [x] Image-off tests report zero native Vision requests.

## Required technical gates

- [x] Full no-quota Gate passes.
- [x] Desktop and 390×844 Mobile Beta UI pass.
- [x] Mock E2E reports zero live requests.
- [x] Text Focused Probe passes 5/5.
- [ ] Text Core19 all execute with zero severe Task Completeness failures.
- [x] Opportunity12 all execute.
- [x] Multi-Turn8 all execute.
- [x] Phrase replacement failures are zero.
- [x] Incorrect history denials are zero.
- [x] Vocabulary Assistance source errors are zero.
- [x] User Phrase Reuse chain passes.
- [x] Explicit Chinese scope passes.
- [x] Natural Fallback is never counted as pass.
- [x] All formal Live requests reconcile to their Ledgers.
- [x] Security scan is zero.

Evidence: the formal Focused Gate passed 5/5 after the single allowed Targeted Retry. The formal Corpus executed all 39 required text scenarios, but finished 35/39: Core19 17/19, Opportunity12 11/12, Multi-Turn8 7/8. The four failed scenarios used Natural Fallback and were not counted as PASS.

## Release handoff

- [ ] Technical state is `M2_TEXT_BETA_READY_FOR_INDEPENDENT_HUMAN_REVIEW`.
- [ ] Human-review package exists and is unfilled.
- [ ] Independent Human Review remains pending.
- [x] M3 remains blocked.
- [x] Codex does not declare human naturalness pass.

Evidence: because the Corpus technical gate failed, the independent review package was intentionally not created and human review was not started.
