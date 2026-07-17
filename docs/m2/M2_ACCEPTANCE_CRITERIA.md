# M2 Acceptance Criteria

- Criteria version: `eoe.m2-acceptance.v1`
- Gate: all required items must pass before M3

## Engine

- [x] Same input, state, policy, and MockProvider produce reproducible decisions.
- [x] All English chunks trace to the Registry, Candidate Selection, and selected Phrase ID.
- [x] `noFit` succeeds without reducing ordinary answer usefulness.
- [x] Conversation Function runs before Scheduler and Selector.
- [x] Fixed Level remains unchanged; Effective Level may only lower per turn.
- [x] Adaptive Progression is disabled.

**Evidence:** deterministic analyzer/scheduler/selector/engine tests, 50-record Registry schema tests, valid English/noFit engine scenarios, and the 10-case Golden Corpus all pass. M2 contains no promotion or long-term demotion path.

## Validation and recovery

- [x] Teacher Mode, automatic gloss/pronunciation/definition, invalid IDs, and budget violations are blocked before display.
- [x] Generation performs at most two attempts.
- [x] Attempt 2 receives Attempt 1 violation codes and fully regenerates.
- [x] Two failures produce a valid Chinese-dominant natural fallback.
- [x] Provider fallback and validator retry are separately diagnosed.

**Evidence:** Validator and all 11 MockProvider scenarios pass, including broken JSON, retry-then-success, double failure, retryable/non-retryable Provider errors, and the additional deterministic unsafe-segment-boundary naturalness gate.

## Persistence and UI

- [x] UI renders Semantic Segments directly.
- [x] Only displayed English chunks create ExposureEvents.
- [x] Generation Attempts and diagnostics persist locally.
- [x] Hidden Developer Panel exposes required diagnostics only when enabled.
- [x] English chunks are subtle, clickable, copy in sentence order, and do not auto-show teaching content.

**Evidence:** persistence-event and IndexedDB v3 repository tests pass; E2E verifies the hidden/default and explicit Developer Panel states, AssistanceRequest click, text order, reload persistence, and no automatic gloss. Production desktop/mobile inspection confirms normal rendering.

## Providers, regression, and evidence

- [x] MockProvider covers all required deterministic M2 scenarios.
- [x] GLM and DeepSeek adapters support structured-output requests without leaking into Domain/UI.
- [x] Golden Conversation Corpus covers all ten requested categories.
- [x] M1 chat, image, multi-conversation, PWA, and IndexedDB behavior does not regress.
- [x] Unit/integration, benchmark, desktop, and 390×844 mobile tests pass.
- [x] Install, lint, type-check, test, benchmark, build, and E2E commands are recorded truthfully.
- [x] Live Provider status is recorded without invented pass results.

**Evidence:** 16 Vitest files/63 tests, Golden Corpus 10/10, and Playwright desktop/mobile 20/20 pass. Production manifest, service worker, and 192/512 icons return HTTP 200. `.env.local` was absent, so GLM-4.7, GLM-4.6V, and DeepSeek V4 Flash Live Tests are explicitly `Not Executed`; mocked HTTP structured-contract tests pass.
