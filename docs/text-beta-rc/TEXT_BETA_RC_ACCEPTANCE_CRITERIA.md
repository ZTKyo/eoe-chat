# Text Beta RC Acceptance Criteria

Status is synchronized only from executed evidence. Historical M2/M2.4/M2.5 results remain frozen.

## Local implementation gate

- [x] Authoritative independent human review was read completely and recorded.
- [x] `p-a-little` is not automatic Live-Safe.
- [x] User-authored `a little` remains recognizable and Assistance-compatible.
- [x] Automatic Phrase use is constrained to Beta sentence frames.
- [x] Hard Validation and Soft Quality Review are separate.
- [x] A Soft warning alone cannot trigger Natural Fallback.
- [x] TypeScript `unknown`/`any` semantic coverage accepts five valid orderings.
- [x] Contextual `好` and `哦` do not reset the conversation.
- [x] English difficulty produces a temporary reduced preference without changing Fixed Level.
- [x] Unsupported precise quantitative claims are deterministically blocked and retried.
- [x] Detailed analysis has named-factor, interaction, trade-off, and synthesis obligations.
- [x] Pronunciation-only Assistance omits automatic examples and resumes the real topic.
- [x] All required no-quota commands exit 0.
- [x] Desktop and 390×844 Mock E2E pass with Live Requests=0.
- [x] Final ports 3100/3200/3201 are released.

Evidence: the post-fix gate completed on 2026-07-17. Unit/regression tests were
389 passed and 8 skipped; E2E was 22/22 with `Provider=MockProvider` and
`Live requests=0`. The final port query found zero listeners.

## Release Corpus gate

- [x] Exactly 18 required scenarios/groups have a final result.
- [ ] 18/18 final answers are Hard-valid and displayable.
- [x] Natural Fallback=0.
- [ ] Severe Task Failure=0.
- [x] Unsupported quantitative claim=0.
- [x] Context reset=0.
- [x] Phrase task replacement=0.
- [x] Chinese internal grammar-slot English Chunk=0.
- [x] TypeScript displays a substantive answer.
- [x] Image Provider Requests=0.
- [ ] Soft Quality Warnings are at most 2 for a reviewable result.

Evidence: after the single Targeted Retry, the merged corpus was 15/18 with
10 English Chunks, 7 `noFit` results, 8 Soft warnings, 0 Natural Fallback,
28 Provider requests, 37,567 tokens, 109,935 ms Provider runtime, and 0 image
requests. Remaining failures are `typescript-unknown-any`,
`conditional-tradeoff`, and `context-ack-oh`; their actual texts and
diagnostics are preserved in the Release Corpus report.

## Status mapping

- Situation A: `M2_TEXT_BETA_RC_READY_FOR_INDEPENDENT_HUMAN_REVIEW`
- Situation B: `M2_TEXT_BETA_RC_REVIEWABLE_WITH_SOFT_WARNINGS`
- Situation C: `M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS`

An independent review package is created only for Situation A or B. It must not preselect a human PASS.

Final executed mapping: Situation C,
`M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS`. No independent review package was
created.
