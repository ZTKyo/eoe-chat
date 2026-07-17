# M2.3 Completion Report

> Historical M2.3 checkpoint report. The later autonomous M2.x closeout result is `M2_AUTONOMOUS_STOPPED_WITH_BLOCKERS`; see `docs/autonomous-m2/FINAL_AUTONOMOUS_REPORT.md`. The historical 5/9 result below is preserved unchanged as required evidence.

Final Status: **LIVE_TEMPLATE_PROBE_FAIL**  
Phase: **M2.3 — Engine-Owned Control Plane and Template-Based Realization**  
M3: **NOT STARTED**  
Adaptive Progression: **DISABLED / NOT STARTED**

M2.3 is locally complete and passes the full deterministic gate. The real Provider gate passed 5 of 9 required Template Probes, so M2.3 is not approved as a live pass. The gate correctly stopped before the separate Provider fallback probe and before the 20-case Live Corpus.

## 1. Executive result

- Local implementation and automated architecture result: **PASS**.
- Required Live Template Probe result: **5/9, FAIL**.
- Final status: **LIVE_TEMPLATE_PROBE_FAIL**.
- Validator relaxation: **none**.
- Provider switching after validation failure: **none**.
- Natural Fallback: used on the four failed probe cases and not presented as live success.

The new Template DTO eliminated the M2.2 control-field failure pattern in the captured responses: all 12 returned raw JSON objects used only the three phrase-use fields or the four noFit fields. All 12 captured raw responses passed the strict Template parser. Remaining live failures are realization/boundary validation failures plus one final GLM attempt that returned no captured response before the request completed.

## 2. M2.2 preservation checkpoint

- Commit: `2363bdf`
- Message: `M2.2 checkpoint: preserve live probe control-plane failure`
- Historical M2.2 benchmark reports, screenshots, and `docs/m2.2`: `git diff --quiet 2363bdf` exit `0` after M2.3 validation.
- M2.2 result remains `LIVE_PROBE_FAIL`.

## 3. Scope controls

- M3 was not started.
- Adaptive Progression was not started.
- Fixed Level remains the durable level; Effective Level remains per-turn only.
- No Validator rule was removed or weakened for live compatibility.
- The prior M2.2 decision not to run its full Corpus remains unchanged.

## 4. Control-plane ownership

The Engine owns Conversation Function, Fixed/Effective Level, scheduling, candidate/selected Phrase ID and content, Registry/policy metadata, Domain segments, Phrase provenance, validation, attempts, retry, fallback, diagnostics, and exposure. The Provider owns only whether to use the offered Phrase naturally and the natural-language Template text.

An import-boundary test verifies that Engine, Directive Builder, MockProvider, M2.3 live harness, and live runner contain no dependency on `provider-envelope` or `eoe.provider-envelope.v1`.

## 5. Deprecated Provider Envelope

`eoe.provider-envelope.v1 — deprecated after M2.2`

Its schema/parser/mapper and historical tests remain for migration evidence only. The M2.3 live runner targets `live-provider-template.test.ts` and the new path does not import the deprecated modules.

## 6. Provider Template schema

Implemented strict `eoe.provider-template.v1`:

- `schemaVersion`
- `usePhrase`
- `responseTemplate`
- conditional `noFitReason`

Additional properties are rejected instead of stripped. Provider control fields such as `conversationFunction`, `phraseId`, `segments`, `usedPhraseIds`, `intentPreserved`, and `naturalnessConfidence` fail parsing.

## 7. Placeholder contract

The exact placeholder is `{{EOE_PHRASE}}`.

- `usePhrase: true`: exactly one placeholder and no `noFitReason`.
- `usePhrase: false`: zero placeholders and a required valid `noFitReason`.
- Missing, duplicate, case-altered, unexpected, and conflicting placeholders are deterministically blocked.

## 8. NoFit reasons

All eight contract values are implemented and tested: `phrase_not_natural`, `conversation_too_short`, `sensitive_context`, `grammar_mismatch`, `position_mismatch`, `translation_risk`, `label_like_risk`, and `other`.

## 9. Strict parsing

The parser accepts one raw JSON object only. It rejects malformed JSON, Markdown fences, prose wrappers, arrays, primitives, wrong versions, missing fields, invalid enums, and additional properties. There is no tolerant repair.

## 10. Phrase Realization Profile

Implemented the required profile fields and deterministic position/punctuation/connector checks in `src/lib/eoe/registry/phrase-realization.ts`. Profiles provide eligibility metadata only; they do not assemble fixed sentences.

## 11. Live-Safe Phrase Set

Count: **10**, all previously active; no disabled Phrase was activated.

- Adverbial: 4 (`p-for-now`, `p-step-by-step`, `p-in-the-long-run`, `p-for-the-moment`)
- Discourse marker: 4 (`p-in-general`, `p-in-this-case`, `p-at-the-same-time`, `p-on-the-other-hand`)
- Stance marker: 1 (`p-maybe`)
- Clause frame: 1 (`p-take-a-closer-look`)

Every profile has at least two allowed positions. The default Engine candidate source is restricted to this set.

## 12. Candidate selection

Existing level, Conversation Function, tone, sensitivity, cooldown, reuse, context, response length, and naturalness gates remain. Realization safety and allowed positions now feed candidate metadata. All candidates may still be rejected, and noFit remains successful.

## 13. Directive contract

The compact M2.3 Directive:

- tells the Provider it produces only a Template;
- contains the Engine-selected phrase content and necessary realization metadata, but not Phrase IDs;
- prohibits Provider control fields, phrase echo, translation, gloss, pronunciation, definition, Teacher Mode, labels, internal rules, HTML, and Markdown;
- includes only normalized errors on Attempt 2;
- never includes the full Registry.

## 14. GLM text structured output

GLM-4.7 used JSON Mode through the OpenAI-compatible adapter and the common raw parser. Live results: noFit passed; sentence-start failed; sentence-middle failed.

## 15. GLM vision structured output

GLM-4.6V used the same Template directive/parser without claiming unsupported JSON Mode. Live results: noFit passed; sentence-start passed; sentence-middle failed.

## 16. DeepSeek structured output

DeepSeek V4 Flash used JSON Mode and the same raw parser. Live results: noFit passed; sentence-start passed; sentence-middle failed.

## 17. Template Parser

Module: `src/lib/eoe/provider-template/parser.ts`. Dedicated parser/schema/regression tests pass. All 12 captured live raw responses passed strict parsing.

## 18. Template Validator

All requested codes are implemented and tested:

`provider_template_parse_failed`, `missing_placeholder`, `duplicate_placeholder`, `unexpected_placeholder`, `use_phrase_conflict`, `missing_no_fit_reason`, `unexpected_no_fit_reason`, `empty_response_template`, `markdown_wrapped_template`, `html_in_template`, `template_label_like_overlay`, `template_isolated_placeholder`, `template_colon_explanation`, `template_translation_duplication`, `template_position_violation`, `template_punctuation_violation`, `template_boundary_invalid`, `template_full_english_takeover`, `template_teacher_mode`, and `template_internal_prompt_leak`.

## 19. Natural boundary validation

Deterministic tests pass for permitted sentence start/middle, rejected sentence end, isolated placeholder, label, colon, translation duplication, unsafe adjacent punctuation, connector requirements, English takeover, Teacher Mode, and internal prompt disclosure.

The live gate shows the unresolved area clearly: all three sentence-middle probes failed Template validation despite successful raw parsing. The live report intentionally does not contain raw response text. Its first version also omitted per-attempt violation-code persistence, so exact live middle-boundary codes cannot be reconstructed without an unauthorized rerun; this is a known diagnostic limitation, not a fabricated result.

## 20. Engine mapping

The Engine substitutes the exact placeholder with its canonical Registry content, creates `text` / `english_chunk` Domain segments, assigns Phrase ID, `isNew`, assistance flag, `usedPhraseIds`, and the authoritative Engine Conversation Function. Provider output is never rendered directly.

## 21. Domain hard validation

Domain schema and hard validation still run after Template validation/mapping. Phrase provenance, selected candidate, budgets, Chinese dominance, invalid language tags, duplicates, translation/teacher/prompt leaks, and other M2/M2.1 safeguards remain active.

## 22. Deterministic naturalness review

Naturalness remains an Engine gate. Sentence edges are permitted only when the reviewed Realization Profile allows them. Provider self-reported confidence and intent fields were removed from the live path and cannot satisfy validation.

## 23. Retry behavior

Maximum generation attempts remain two. Attempt 2 receives normalized violation-specific guidance and regenerates the complete Template. Invalid strings are not patched. Template validation failures do not cause Provider switching.

## 24. Natural Fallback

After two failed attempts the Engine returns a Chinese-dominant, intent-preserving Domain response with `noFit: true`, no internal error display, and no exposure. Four failed live probes ended in this safe path.

## 25. Provider fallback distinction

Provider fallback and Validator retry remain separate diagnostics and code paths. Because the 9-probe gate failed, the separate live Provider fallback probe was correctly **not executed**.

## 26. Exposure Event

Persistence tests verify that only the final displayed Engine-owned English Chunk creates Exposure. Rejected attempts, noFit, and Natural Fallback do not create exposure. M2.3 does not infer Mastery.

## 27. Developer diagnostics

The hidden panel now shows Template parse, Template validator, Mapper/Domain schema, Domain validator, attempt stages, violations, naturalness, Provider/model, usage, latency, fallback, Registry, Template schema, realization policy, and validator versions. It remains hidden by default.

## 28. MockProvider matrix

The dedicated M2.3 matrix contains **25 test cases**: three valid shapes, 18 strict invalid Template cases, Attempt-2 recovery, two-invalid-attempt fallback, and retryable/non-retryable Provider errors. Compatibility aliases also keep older M2 tests deterministic. All use the production raw parser/validator/mapper/Domain path.

## 29. M2.2 regression fixtures

Four redacted fixtures under `artifacts/regressions/m2.2-live-failures/` cover Provider-owned Conversation Function, Phrase ID, Domain segments, and label-like boundary behavior. Old control fields are rejected as additional properties. Historical M2.2 artifacts remain unchanged.

## 30. Automated test inventory

Coverage includes at least these 35 categories:

1. Template DTO schema;
2. additional properties;
3. NoFitReason enum;
4. raw JSON parsing;
5. Markdown wrapper rejection;
6. malformed/prose/primitive rejection;
7. missing placeholder;
8. duplicate placeholder;
9. unexpected placeholder;
10. usePhrase conflict;
11. noFit reason invariants;
12. HTML rejection;
13. label-like overlay;
14. isolated placeholder;
15. colon explanation;
16. translation duplication;
17. position restriction;
18. punctuation restriction;
19. boundary integrity;
20. full-English takeover;
21. Teacher Mode;
22. internal prompt leak;
23. realization profile schema/set;
24. candidate selection;
25. compact Directive;
26. Engine-owned Conversation Function;
27. semantic segment mapping;
28. Domain hard validator;
29. deterministic naturalness review;
30. two-attempt retry;
31. Natural Fallback;
32. exposure/persistence;
33. Developer diagnostics;
34. GLM/vision/DeepSeek adapter contracts;
35. M2.2 failure regression/import boundary.

Additional suites cover Golden Corpus, M1/M2 regressions, IndexedDB, PWA, desktop, and mobile.

## 31. Benchmark results

- `benchmark:eoe`: **45/45 passed**.
- `benchmark:naturalness`: **1/1 suite passed**, executing 45 scenarios.
- Report: `artifacts/benchmarks/m2.3-naturalness-report.md`.
- English appearance rate is not a pass metric.
- Automated naturalness is not reported as independent human review.

## 32. M1/M2 regression result

Full Vitest result: **31 files passed, 3 live suites skipped; 210 tests passed, 3 skipped**. Chat, images, multiple conversations, IndexedDB, PWA, Provider abstraction, semantic rendering, exposure, and diagnostics remained green.

## 33. Desktop evidence

- E2E: 10 desktop Chromium cases passed.
- Screenshot: `artifacts/screenshots/m2.3-desktop.png`
- Visual inspection performed: chat content, subtle English Chunk, and hidden-on-demand Developer Panel rendered correctly.

## 34. Mobile 390×844 evidence

- E2E: 10 mobile cases passed at 390×844.
- Screenshot: `artifacts/screenshots/m2.3-mobile-390x844.png`
- Visual inspection performed: content order and developer diagnostics remain readable; the panel intentionally occupies much of the small viewport only in hidden developer mode.

## 35. Local command ledger

| Command | Result | Evidence |
| --- | --- | --- |
| `npm install` | PASS | up to date; 462 packages audited |
| `npm run lint` | PASS | ESLint exit 0 |
| `npm run typecheck` | PASS | TypeScript exit 0 |
| `npm run test` | PASS | 210 passed, 3 live skipped |
| `npm run benchmark:eoe` | PASS | 45 passed |
| `npm run benchmark:naturalness` | PASS | 1 suite / 45 scenarios |
| `npm run build` | PASS | Next.js 16.2.10 production build |
| `npm run test:e2e` | PASS on final run | 20/20; desktop + 390×844 |
| `npm audit` | COMPLETED WITH FINDINGS | 2 moderate PostCSS advisories through Next.js |

E2E history is retained honestly: the first run found one stale expected Mock sentence; the second external-server attempt connected to a server already killed by the tool timeout; the final identical test suite ran against an explicitly verified local Mock server and passed 20/20.

`npm audit fix --force` was not run because npm proposed a breaking Next.js downgrade to 9.3.3. Functional acceptance and dependency advisory status are reported separately.

## 36. Live Template Probe gate

Executed exactly nine probes:

| Provider | noFit | sentence start | sentence middle |
| --- | --- | --- | --- |
| GLM-4.7 | PASS | FAIL | FAIL |
| GLM-4.6V | PASS | PASS | FAIL |
| DeepSeek V4 Flash | PASS | PASS | FAIL |

Result: **5/9 → LIVE_TEMPLATE_PROBE_FAIL**. Total recorded tokens: **8,426**. Average recorded latency: **12,145 ms**. No credentials, Authorization headers, full Directives, or raw private content were recorded.

## 37. Conditional fallback and Live Corpus

- Separate Provider fallback probe: **Not Executed**, blocked by 5/9 Template gate.
- 20-case Live Corpus: **Not Executed**, blocked by the failed Template gate.
- Live report: `artifacts/benchmarks/m2.3-live-provider-report.md`.

This is the required stop behavior, not missing test work.

## 38. Security, Git, limitations, and next boundary

- `.env.local` remains ignored.
- No key is included in reports, screenshots, tracked files, or raw captures.
- No push, deployment, remote creation, M3, Adaptive Progression, or human-review claim occurred.
- Final scan: credential-pattern files `0`; artifact full-Directive files `0`; artifact privacy-leak files `0`.
- `.env.local`: ignored `true`, tracked `false`.
- `git diff --check`: exit `0`.
- Historical M2.2 evidence comparison against `2363bdf`: exit `0`.
- Git remotes: none configured; no push occurred.

Known limitations:

1. Sentence-middle live realization remains unsuccessful across all three Providers.
2. GLM text sentence-start did not complete a valid final pipeline; its second attempt returned no captured Template before the request finished.
3. The first M2.3 live report schema did not persist per-attempt violation codes, so exact live boundary codes are unavailable without rerunning; no rerun was performed after the stop gate.
4. `npm audit` reports two moderate PostCSS advisories and offers only a breaking forced resolution in the current dependency graph.

M3 remains blocked. The accurate next scope is an M2.3 follow-up only: persist redacted per-attempt live violation codes and investigate sentence-middle Template boundary failures using the captured structural evidence, without changing Provider ownership, widening the Live-Safe set, or weakening validation.
