# M2 Completion Report

- Status: `PASS`
- Completed: 2026-07-17
- Product: EOE Chat
- Engine: English Overlay Engine Alpha
- Boundary: fixed Progression Level only; Adaptive Progression and M3 were not started

## 1. M1 closing corrections

- Synchronized every original item in `docs/m0/M1_ACCEPTANCE_CRITERIA.md` with `[x]` status and section evidence without changing the criteria.
- Recorded GLM/DeepSeek Live Tests as `Not Executed`; MockProvider and mocked HTTP contracts remain passed.
- Added the formal naming relationship to `README.md` and `docs/ARCHITECTURE.md`: EOE Chat is the product, English Overlay Engine is the core, ACLAE is the retained workspace/future Adaptive Conversational Language Acquisition umbrella.
- Confirmed `.env.local` is absent and ignored by Git; no credential was requested or invented.
- During M2 mobile QA, found and fixed equal-timestamp user/assistant reload ordering with stable repository ordering and a regression test.

## 2. Created M2 documents

1. `M2_IMPLEMENTATION_CONTRACT.md`
2. `PHRASE_REGISTRY_DESIGN.md`
3. `SCHEDULER_POLICY_v1.md`
4. `CANDIDATE_SELECTION_POLICY_v1.md`
5. `DIRECTIVE_CONTRACT_v1.md`
6. `M2_VALIDATOR_RULES_v1.md`
7. `M2_ACCEPTANCE_CRITERIA.md`
8. `M2_COMPLETION_REPORT.md`

## 3. Added modules

- Domain: `src/domain/eoe.ts` and upgraded `eoe.response.v2` schemas in `src/domain/chat.ts`.
- Engine: analyzer, fixed config, scheduler, selector, directive builder, validator, natural fallback, orchestrator, and persistence-record builder under `src/lib/eoe/`.
- Registry: source-controlled phrases under `src/lib/eoe/phrases/` and validated lookup under `src/lib/eoe/registry/`.
- Persistence: IndexedDB v3, EngineRepository, Registry sync, ExposureEvent, GenerationAttempt, AssistanceRequest, and EngineDiagnostics.
- Providers: structured request metadata, JSON mode where supported, deterministic M2 MockProvider scenarios.
- UI: direct English Segment rendering, AssistanceRequest click, and hidden Developer Panel with no ordinary provider/internal labels.
- Benchmark: `golden-corpus.ts`, `benchmark.test.ts`, and `npm run benchmark:eoe`.

## 4. Phrase Registry

- Count: **50** unique, schema-valid, active Semantic Chunks.
- Version: `eoe.phrases.v1`.
- Primary categories: stance/opinion, reaction/empathy, explanation/cause, advice/action, condition/qualification, time/sequence, contrast/comparison, caution/reminder, planning/focus, and observation/image analysis.
- 41 phrases are Level 1–2; nine are Level 3. M2 default Level 2 therefore uses a broad high-frequency subset.
- Each record contains the required ID, canonical/variants, level, difficulty, frequency rank, reuse value, functions, tags, tones, hints, cooldown, status, and registry version.

## 5. Scheduler rules

- Default fixed level: 2; configurable with `EOE_FIXED_LEVEL`.
- `EOE_ENABLED=false` disables overlay without disabling chat.
- Emotional turns reduce Effective Level by one; high-stakes turns reduce it to Level 1; complex technical/image turns may reduce it by one.
- Explicit Chinese/non-understanding and unsuitable very short turns skip overlay.
- Maximum one new focus and one English Segment; coverage is a ceiling, not a quota.
- Fixed Level is never mutated and no promotion path exists.

## 6. Candidate Selection

- Runs after Scheduler.
- Applies active/status, level, Conversation Function, tone, naturalness eligibility, and cooldown gates.
- Scores function fit, frequency, reuse value, difficulty fit, contextual hints, and eligible reuse.
- Returns a deterministic top 3–5 pool where possible, with one engine-selected Phrase ID.
- Can return an empty pool and `noFit: true`; the Provider cannot invent or select a Phrase ID.

## 7. Structured Response Schema

`eoe.response.v2` contains Conversation Function, ordered Semantic Segments, used Phrase IDs, `noFit`, naturalness confidence, intent preservation, policy version, and generation attempt ID. Text Segments use `zh|other`; English chunks carry the selected Registry ID, new/reuse state, and assistance availability. UI renders these Segments directly; Plain Text Projection is context-only.

GLM text and DeepSeek request JSON mode. GLM vision, whose verified capability does not advertise JSON mode, receives the same strict JSON Directive and uses the shared parser/validator path.

## 8. Validator rules

The pre-display deterministic validator covers broken structure, invalid/unselected IDs, excess new content, overlay budget, premature English takeover, automatic gloss, unsolicited pronunciation/definition, Teacher Mode, translation mode, internal prompt leak, changed Conversation Function, empty response, duplicate Segments, invalid language tags, low naturalness confidence, HTML, and unsafe Segment boundaries.

Naturalness is enforced twice: candidate eligibility before generation and deterministic confidence/boundary gates before display. The optional Soft Validator interface exists but is not called by default.

## 9. Retry and fallback

- Attempt 1 uses the ordinary per-turn Directive.
- Attempt 2 receives exact violation codes and requests complete regeneration; no string replacement is performed.
- Maximum: two generation attempts.
- Two failures produce a separately constructed, validator-checked, Chinese-dominant, function-aware natural fallback with `noFit: true`.
- Provider fallback is recorded separately from validator retry; validation failure does not cause unlimited provider switching.

## 10. ExposureEvent

Only the final displayed `english_chunk` creates an ExposureEvent. It records phrase/conversation/message/attempt identity, timestamp, fixed/effective levels, function, new/reuse status, provider, and all policy/registry/selector versions. Rejected attempts and noFit fallbacks create no exposure. M2 does not infer mastery.

## 11. Developer Panel

Hidden by default. Enable with `EOE_DEVELOPER_MODE=true` on server response or `?eoe-dev=1`; `?eoe-level=3` provides a developer-only fixed-level override. It displays Function, levels, mode, candidates, selected phrase, noFit, Provider, attempts, validation/violations, latency, token usage, fallback states, and policy/registry versions. Desktop placement does not cover the Composer.

## 12. MockProvider scenarios

All required deterministic scenarios are implemented and tested:

1. valid noFit
2. valid English chunk
3. invalid Phrase ID
4. automatic Chinese gloss
5. Teacher Mode
6. overlay budget overflow
7. broken JSON
8. first failure / second success
9. two failures / natural fallback
10. retryable Provider error
11. non-retryable Provider error

## 13. Benchmark result

Golden Corpus result: **10/10 passed**. It covers daily chat, opinion, planning/advice, emotional support, technical explanation, image analysis, very short reply, user English, explicit Chinese-only, and no natural candidate. Checks include intent/function, Chinese as main carrier, no translation/Teacher Mode/gloss, Registry traceability, budget, noFit, and fallback usefulness. English occurrence rate is not a pass metric.

## 14. Executed commands

```text
npm install                 exit 0  (up to date)
npm run lint                exit 0
npm run typecheck           exit 0
npm run test                exit 0
npm run benchmark:eoe       exit 0
npm run build               exit 0
npm run test:e2e            exit 0
```

## 15. Final test results

- Vitest: **16 files, 63 tests passed**.
- EOE benchmark: **1 file, 10 tests passed**.
- Playwright: **20/20 passed** across desktop Chromium and 390×844 mobile.
- Build: Next.js production compilation, TypeScript, static generation, API/icon/manifest routes all passed.
- PWA: manifest, service worker, 192 icon, and 512 icon each returned HTTP 200 in the production build.
- Browser console: no warnings or errors.

Intermediate failures were not reported as passes: Developer Panel initially intercepted the desktop send control; one E2E assertion became stale after naturalness wording changed; visual QA found unsafe Mock phrase boundaries and equal-timestamp message reversal. Each was fixed and the applicable full suite was rerun to final success.

## 16. Screenshots

- Desktop 1280×720: `artifacts/screenshots/m2-desktop.png`
- Mobile 390×844: `artifacts/screenshots/m2-mobile-390x844.png`

Both production screenshots use the same persisted conversation. Verified: user precedes assistant, English chunk is subtle/clickable, desktop developer diagnostics are visible only when enabled, mobile diagnostics are hidden, Composer is visible, and document width equals viewport width.

## 17. Live Provider status

`.env.local` was absent, so no real credentials existed.

| Provider | Contract status | Live smoke test |
|---|---|---|
| MockProvider | Passed in API/unit/E2E/benchmark | Passed |
| GLM-4.7 | Adapter, JSON request, parsing, usage/latency/error contract mocked and passed | **Not Executed** |
| GLM-4.6V | Vision/Base64 routing, prompt-structured parsing, usage/latency/error contract mocked and passed | **Not Executed** |
| DeepSeek V4 Flash | Text fallback, JSON request, parsing, usage/latency/error contract mocked and passed | **Not Executed** |

No live-pass claim is made.

## 18. Known limitations

- Conversation classification and semantic scoring are deterministic Alpha heuristics and may need benchmark-driven refinement for nuanced mixed intents.
- Soft naturalness validation is only an interface; it is disabled to avoid an extra model call on every message.
- Function-aware natural fallback remains intentionally generic when both Provider generations are unusable.
- Mock vision validates routing but does not inspect real pixels.
- One image/5 MB per message, pending UI instead of token streaming, local device-only data, no account/sync/export.
- No Adaptive Progression, Mastery Score, or automatic Comprehension Evidence inference.

## 19. Accurate M3 recommendation

After approval, M3 should add explicit Vocabulary Assistance requested by the user, persist assistance outcomes and explicit comprehension signals, define replayable evidence scoring, expand the Golden Corpus with real-provider benchmark fixtures, and introduce a feature-flagged progression proposal/audit layer. Automatic promotion should remain disabled until evidence replay, rollback, and cross-context safety gates are demonstrably stable. M3 was not started.

## Git and security appendix

- Final credential scan found only the literal README placeholders `GLM_API_KEY=your-key` and `DEEPSEEK_API_KEY=your-key`; no real key or Bearer token was found.
- `.env.local` is absent and `git check-ignore` confirms it is ignored.
- `git diff --stat` produced no lines because this repository has no initial commit and every workspace file is still untracked; `git status --short --branch` reports `No commits yet on main` plus the untracked project tree.
- No commit, push, remote repository, or deployment was created.
- Test and production listeners on port 3000 were stopped after verification.
