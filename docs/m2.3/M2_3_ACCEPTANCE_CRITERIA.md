# M2.3 Acceptance Criteria

Status: **IN PROGRESS**  
Required terminal status: `PASS`, `LIVE_TEMPLATE_PROBE_FAIL`, or an evidence-backed local-gate failure.  
M3 and Adaptive Progression remain out of scope.

An item is checked only after the stated behavior has been executed or directly inspected. Historical M2.2 evidence is preserved; it is not relabeled as M2.3 success.

## A. Checkpoint and preservation

- [x] A local checkpoint exists before M2.3 changes with message `M2.2 checkpoint: preserve live probe control-plane failure`.
- [x] The M2.1 live report working-tree and checkpoint hashes were compared before work.
- [x] `.env.local` is ignored and no real key was added to version control.
- [x] M2.2 reports and screenshots remain byte-for-byte unchanged after M2.3.
- [x] Redacted M2.2 failure fixtures preserve the four confirmed failure classes.

**Evidence:** Checkpoint `2363bdf`; pre-change M2.1 report hash `4652f0f620606e34dbd3f37c44d9db9e353e39d3` in both working tree and checkpoint.

## B. Control-plane ownership

- [x] Engine owns authoritative Conversation Function, levels, scheduling, candidates, selected Phrase, policies, Domain segments, attempts, validation, fallback, and exposure.
- [x] Provider output contains only the template DTO allowlist.
- [x] Provider output cannot override Engine Conversation Function.
- [x] Provider output cannot choose a Phrase ID or phrase content.
- [x] Provider output cannot create Domain semantic segments or language tags.
- [x] Deprecated `eoe.provider-envelope.v1` remains documented and regression-testable but is absent from the M2.3 live path.

**Evidence:** Engine Template path plus `control-plane-ownership.test.ts`; deprecated Envelope remains isolated to its historical directory/tests.

## C. Provider Template schema and parser

- [x] `eoe.provider-template.v1` schema is strict and rejects additional properties.
- [x] `usePhrase: true` requires exactly one exact `{{EOE_PHRASE}}` placeholder and forbids `noFitReason`.
- [x] `usePhrase: false` requires zero placeholders and a valid `noFitReason`.
- [x] All eight `NoFitReason` values are accepted and unknown values are rejected.
- [x] Malformed JSON, markdown-wrapped JSON, prose-wrapped JSON, arrays, primitives, and empty templates are rejected without repair.
- [x] Mock and every live Provider path use the same raw-text parser/validator/mapper sequence.

**Evidence:** Provider Template schema/parser suites and GLM/vision/DeepSeek request-contract tests passed; 12/12 captured live raw responses parsed strictly.

## D. Phrase realization and candidate policy

- [x] A reviewed Live-Safe Phrase Set contains 8–15 existing active Registry phrases.
- [x] No disabled phrase is activated merely to meet the set size.
- [x] Every live-safe phrase has a complete `PhraseRealizationProfile` and at least two allowed positions.
- [x] Default M2.3 production/live selection is restricted to live-safe phrases.
- [x] Existing level, Conversation Function, tone, cooldown, reuse, and naturalness gates still apply.
- [x] All candidates may be rejected and `noFit` remains a successful result.

**Evidence:** 10 active live-safe phrases, four grammatical categories, at least two allowed positions each; Registry/profile/selector tests passed.

## E. Template validator and boundary safety

- [x] Every required M2.3 template violation code is implemented and tested.
- [x] Isolated placeholders, label-like overlays, colon explanations, translation duplication, glossary/pronunciation/definition behavior, teacher mode, HTML, markdown, and prompt leaks are blocked.
- [x] Allowed sentence positions are computed from template text and checked against the selected profile.
- [x] Forbidden punctuation and required connector rules are deterministic.
- [x] English takeover is blocked before Domain rendering.
- [x] Provider self-reported confidence or intent is not accepted as validation evidence.

**Evidence:** Required-code table tests passed; Mock start/middle/noFit and negative boundary matrix passed before live validation.

## F. Mapping, Domain validation, retry, and fallback

- [x] Engine substitutes the exact placeholder with the Engine-owned Registry phrase.
- [x] Engine creates semantic segments and assigns the Engine-owned Phrase ID, `isNew`, and assistance flag.
- [x] Authoritative Conversation Function comes directly from Engine analysis.
- [x] Domain hard validation and deterministic naturalness review still run after mapping.
- [x] At most two complete generation attempts occur.
- [x] Attempt 2 contains normalized violation-specific correction guidance.
- [x] Invalid output is never string-patched and validation failure alone does not trigger Provider switching.
- [x] Two failures produce a Chinese-dominant Natural Fallback with `noFit: true` and no internal error display.
- [x] Provider fallback and validator retry remain distinct diagnostics.

**Evidence:** Engine and 25-case Mock Template matrix passed, including Attempt-2 success and two-failure Natural Fallback.

## G. Exposure and diagnostics

- [x] Exposure is recorded only for the final displayed English Chunk.
- [x] Rejected attempt content never creates an Exposure Event.
- [x] noFit and Natural Fallback create no Phrase exposure.
- [x] Diagnostics show template parse, template validation, mapping, Domain validation, attempts, usage, latency, policy/Registry versions, and fallback state without secrets or full directives.
- [x] Ordinary UI reveals none of the internal learning/control-plane fields.

**Evidence:** Persistence/exposure, IndexedDB repository, Developer Panel, desktop, and mobile tests passed.

## H. Deterministic MockProvider scenarios

- [x] At least 22 raw JSON-text scenarios cover valid phrase use and noFit; malformed/extra fields; all placeholder conflicts; boundary, label, translation, teacher, HTML/markdown/prompt leak; retry success; double failure; retryable/non-retryable Provider errors.
- [x] Mock responses pass through the production parser, validator, mapper, and Domain validator.
- [x] Same input, Engine state, policy, and Mock scenario produce reproducible decisions and diagnostics.

**Evidence:** Dedicated M2.3 Mock matrix: 25 passing cases through the production path.

## I. Regression and benchmark coverage

- [x] Old M2.2 control fields are rejected as additional properties.
- [x] The four redacted M2.2 live failure fixtures fail for the expected M2.3 reason before Domain rendering.
- [x] Golden corpus covers ordinary chat, views, advice, empathy, technical explanation, image analysis, short replies, user English, Chinese-only request, and no natural candidate.
- [x] Benchmark does not use English appearance rate as a hard pass metric.
- [x] M1/M2 chat, image, multiple conversations, IndexedDB, PWA, Provider abstraction, and semantic rendering do not regress.
- [x] Desktop and 390×844 mobile E2E pass with accessible copy order.

**Evidence:** 210 tests passed; Golden Corpus 45/45; Naturalness Benchmark 45 scenarios; build passed; desktop/mobile E2E 20/20.

## J. Local gate

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `npm run benchmark:eoe`
- [x] `npm run benchmark:naturalness`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] `npm audit` result is recorded separately from functional acceptance.

**Evidence:** All commands executed. `npm audit` completed with two moderate PostCSS findings; forced breaking downgrade was not applied.

## K. Live gate

Live validation may begin only after every required local command passes.

- [ ] GLM text: noFit, sentence-start placeholder, sentence-middle placeholder.
- [ ] GLM vision: noFit, sentence-start placeholder, sentence-middle placeholder.
- [ ] DeepSeek text: noFit, sentence-start placeholder, sentence-middle placeholder.
- [ ] All 9/9 template probes pass strict raw parsing, template validation, Engine mapping, Domain validation, and intent preservation.
- [ ] A separate Provider fallback probe passes after and only after 9/9 template probes.
- [ ] The 20-case Live Corpus runs after and only after the fallback probe passes.

**Stop rule:** Any template probe failure sets status `LIVE_TEMPLATE_PROBE_FAIL`; do not switch Provider, relax validation, run the fallback probe, or run the 20-case Corpus.

**Evidence:** Live Template Probe result 5/9: GLM noFit only; GLM Vision noFit/start; DeepSeek noFit/start. Status `LIVE_TEMPLATE_PROBE_FAIL`; fallback and Corpus correctly not executed.

## L. Final safety and scope

- [x] Final credential/privacy/full-directive scans are clean.
- [x] `git diff --check`, `git status`, and `git diff --stat` are recorded.
- [x] No push, deployment, remote repository creation, M3 work, or Adaptive Progression occurred.
- [x] No human-review claim is made without actual human evidence.

**Evidence:** Credential-pattern files 0; artifact full-Directive files 0; artifact privacy-leak files 0; `.env.local` ignored/untracked; `git diff --check` exit 0; no remotes configured.
