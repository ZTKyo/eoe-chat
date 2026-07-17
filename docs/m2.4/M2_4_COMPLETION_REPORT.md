# M2.4 Completion Report

Final status: `M2_4_STOPPED_WITH_BLOCKERS`

Independent M2.4 human review: `NOT_STARTED`

M3: `BLOCKED`

Adaptive Progression: `DISABLED`

This report preserves the independent review findings as product facts. Local automation is engineering evidence only and does not override the human verdict `M2_HUMAN_REVIEW_FAIL`.

## 1. Starting checkpoint

- Starting commit: `e51d195`
- Local empty checkpoint commit: `df5f4b8` (`M2 technical checkpoint: preserve pre-M2.4 human review state`)
- `.env.local` was ignored and untracked before work began.
- No push, deploy, remote repository creation, M3 work, or Adaptive Progression work was performed.

## 2. Product Constitution and human input

- Added `docs/PRODUCT_CONSTITUTION.md` and executable Constitution tests.
- Added `INDEPENDENT_HUMAN_REVIEW_INPUT.md` as the authoritative M2.4 input derived from both supplied review files.
- The Constitution fixes the order: complete the real user task first, then consider an optional Overlay. `noFit` changes only the Overlay decision and cannot excuse an incomplete answer.
- Automated PASS results remain explicitly non-authoritative for product naturalness.

## 3. Task Completeness and Response Obligations

The Engine now derives typed Response Obligations before scheduling and validates them after the deterministic Hard Validator but before optional naturalness review. The Provider receives compact obligations but cannot create, remove, or mark them complete.

Implemented obligations cover direct answers, actionable plans, comparisons, steps, reasons, explanations, emotion acknowledgement, image evidence, explicit Chinese scope, phrase clarification, and return to the original topic.

The final second-cycle fix gives explicit Vocabulary Assistance its own obligations. It no longer inherits generic causal-explanation obligations merely because the surface request contains “解释”.

## 4. Live-Safe Phrase v2

- Registry: 50 phrases, version `eoe.phrases.v2.0`.
- Live-Safe v2: 10 phrases with typed realization profiles: `I think`, `it depends`, `that makes sense`, `for example`, `for now`, `a little`, `kind of`, `at the same time`, `in the long run`, and `sounds good`.
- Added grammatical role, allowed position, punctuation/connector constraints, capitalization, forbidden patterns, task-replacement risk, and function preferences.
- Removed `maybe`, `step by step`, and `take a closer look` from Live-Safe selection. They remain registry data for versioned compatibility and are not current Live-Safe candidates.
- Historical M2.3 replay uses historical profiles so current v2 rules do not rewrite previous evidence.

## 5. noFit calibration

- Added explicit decision source and allowed reason policy.
- `noFit` reasons distinguish explicit Chinese requests, high-risk/complex context, no safe candidate, grammar mismatch, naturalness failure, and fallback conditions.
- Direct user English reuse can override cooldown as a candidate opportunity.
- Live Probe still showed over-conservative or failure-derived noFit in several expected-English cases, so M2.4 noFit product calibration is not accepted.

## 6. Vocabulary Assistance and multi-turn context

- English Chunk click/context-menu now creates a real structured Assistance request and a normal conversation turn.
- Resolution uses actual message IDs, segment indices, Phrase IDs, source sentence Templates, and topic history.
- IndexedDB is the committed source of truth when an English Chunk is clicked, eliminating a render/history race.
- Chinese-only scope persists across turns and resumes only on an explicit user English signal.
- Added true multi-turn scenarios for meaning, pronunciation, clarification, reuse, difficulty, Chinese-only scope, resume, and ambiguity.
- Local unit and E2E evidence passed; the real multi-turn Probe still failed and therefore blocks the full corpus.

## 7. Provider Directive and Validator

- Directive priority is task completion, obligation fulfillment, ordinary natural reply, then optional Phrase.
- The Provider still returns only the strict Template DTO. It does not own Phrase IDs, Segments, noFit policy, Response Obligations, validation, or state.
- Hard Validator remains deterministic and was not relaxed.
- Task Completeness failure triggers complete regeneration, never string repair, with at most two attempts.
- Natural Fallback remains Chinese-dominant, answers as much as safely possible, records failure diagnostics, and never exposes internal errors.

## 8. Structural Benchmark reclassification

- `benchmark:structure` is the canonical MockProvider command.
- `benchmark:naturalness` is a deprecated alias and prints exactly `DEPRECATED_ALIAS — use benchmark:structure`.
- The generated report is named `Structural Realization Benchmark` and explicitly excludes human naturalness, Phrase activation, comprehension, and progression evidence.
- MockProvider no longer fabricates blanket `natural=true` / `0.96` evidence for clean cases.

## 9. Persistence and diagnostics

IndexedDB schema v4 adds Response Obligations, Task Completeness Reviews, and Assistance Outcomes. Developer diagnostics now include obligations, missing obligations, noFit source/reason, user-English reuse, realized position/profile, Assistance source, benchmark type, and evidence class. The panel remains hidden by default.

## 10. Repair cycles

### Cycle 1

Initial integration produced 27 local regressions. They were fixed with versioned historical replay, v2 realization-risk precedence, quote-safe template boundaries, deterministic candidate sizing, and removal of synthetic naturalness evidence. No Validator rule was weakened.

### Cycle 2

Initial browser E2E exposed a real Vocabulary Assistance integration failure. The fix made the committed IndexedDB message the source context and made Assistance obligations take precedence over generic explanation obligations. Targeted results were 25/25 unit tests and 2/2 desktop/mobile E2E before the complete gate was rerun.

The later real Probe failed after these two authorized repair cycles. No third repair cycle was started.

## 11. Final local command evidence

| Command | Exit | Result |
|---|---:|---|
| `npm install` | 0 | Up to date; 462 packages audited |
| `npm run lint` | 0 | ESLint passed |
| `npm run typecheck` | 0 | TypeScript passed |
| `npm run test` | 0 | 38 files passed, 4 live files skipped; 290 passed, 4 skipped |
| `npm run benchmark:eoe` | 0 | 45/45 passed |
| `npm run benchmark:structure` | 0 | 1/1 structural suite passed |
| `npm run benchmark:naturalness` | 0 | Deprecated alias printed; structural suite 1/1 passed |
| `npm run replay:m2.3-live-failures` | 0 | 51/51 historical records replayed |
| `npm run build` | 0 | Next.js production build passed |
| `npm run test:e2e` | 0 | 22/22 passed across desktop and 390×844 mobile |
| `npm audit` | 1 | 2 moderate PostCSS findings through Next.js; no fix available |
| `npm run test:live-m2.4` | 1 | Probe stopped with blockers; full corpus not started |

## 12. Desktop and mobile evidence

- Desktop: `artifacts/screenshots/m2.4-desktop.png`
- Mobile 390×844: `artifacts/screenshots/m2.4-mobile-390x844.png`
- Both were visually inspected after the final 22/22 E2E pass. Developer diagnostics were intentionally enabled for evidence; the ordinary UI keeps the panel hidden.

## 13. Real Provider Probe

Run ID: `m2-4-2026-07-17T01-41-31-965Z`

| Metric | Result |
|---|---:|
| Probe cases passed | 3/8 |
| HTTP/provider requests | 12/80 |
| Tokens | 16,128/100,000 |
| Provider runtime | 70,796/5,400,000 ms |
| English Chunk cases | 1 |
| noFit cases | 7 |
| Natural Fallback cases | 4 |
| Budget stop | No |

Models actually exercised: GLM `glm-4.7`, GLM Vision `glm-4.6v`, and DeepSeek `deepseek-v4-flash`.

noFitReason distribution: `explicit_chinese_request=2`, `no_safe_candidate=1`, `other=4`.

Passing cases: GLM text English, GLM explicit-Chinese noFit, and DeepSeek explicit-Chinese comparison noFit.

Blocking cases:

1. GLM Vision expected-English returned a complete but noFit image answer instead of an English Chunk.
2. GLM Vision Chinese-only response failed visible-evidence completeness twice and used Natural Fallback.
3. DeepSeek plan missed time/stage evidence twice and used Natural Fallback.
4. Real multi-turn clarification missed source sentence, pronunciation, and topic resume twice and used Natural Fallback.
5. User `I think` reuse failed twice and used Natural Fallback.

Full Core20, Opportunity12, Multi-Turn8, and the remaining two image fixtures were not executed because the Probe gate failed. This is an intentional stop, not missing evidence presented as PASS.

Evidence:

- `artifacts/benchmarks/m2.4-live-report.md`
- `artifacts/benchmarks/m2.4-live-cycle-1.md`
- `artifacts/benchmarks/m2.4-live-budget.json`

## 14. Security and privacy

- Configured secret-value hits outside `.env.local`: 0.
- Private absolute path hits: 0.
- Authorization credential hits: 0.
- Prompt or image-payload hits in reports: 0.
- `.env.local`: ignored and untracked.
- Reports contain final text and diagnostics but not keys, Authorization headers, full Directives, or image bytes.
- Dependency audit remains non-zero because of two moderate PostCSS advisories inherited through Next.js, with no available fix in the current dependency graph.

## 15. Final disposition

`M2_4_STOPPED_WITH_BLOCKERS`

The technical architecture and local regression surface improved materially, but the real Provider Probe did not meet the gate. No M2.4 independent human-review package was generated. The previous independent review remains authoritative, M3 stays blocked, and Adaptive Progression stays disabled.
