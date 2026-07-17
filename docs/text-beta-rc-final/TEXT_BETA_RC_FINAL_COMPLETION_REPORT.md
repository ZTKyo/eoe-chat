# Text Beta RC Final Completion Report

Final status: `M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS`

Independent review package:
`artifacts/human-review/text-beta-rc-final/`

## 1. Starting state and Git checkpoints

- Starting HEAD: `15f97c9`
- Starting state: `M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS`
- Frozen result: 15/18, 8 Soft warnings, final Natural Fallback 0
- Checkpoint commit: `8b126d3`
  - `Text Beta RC final checkpoint: preserve three remaining blockers`
- Implementation commit: `90c74f2`
  - `Text Beta RC final: close premise technical and engine-owned accounting gaps`
- Final evidence commit:
  - `Text Beta RC final evidence: preserve remaining blockers for human review`
  - this completion report and the audited review package are included in that
    local commit
- No remote exists. No push or deployment was performed.

## 2. Three frozen root causes

1. `typescript-unknown-any`: the prior answer was substantive but the contract
   and review did not reliably capture narrowing, safety conclusion, and
   practical selection advice.
2. `conditional-tradeoff`: the Provider replaced the user's higher-rent and
   daily-one-hour premises with invented hourly-wage, workday, monthly-hour,
   and monetary assumptions.
3. `context-ack-oh`: the Engine-owned reply was product-valid with 0 Provider
   requests, but the old harness incorrectly required at least one attempt.

The complete pre-code evidence is retained in
`docs/text-beta-rc-final/THREE_BLOCKER_ROOT_CAUSE.md`.

## 3. Explicit User Premise preservation

The Engine now extracts lightweight `ExplicitUserPremise` state, includes it in
the compact per-turn Directive, validates it before display, retries omission,
contradiction, or replacement, and records `PremisePreservationReview`.

Regression coverage includes cost, time, numeric value, condition, constraint,
deadline, equivalent Chinese/Arabic numbers, omission, contradiction,
replacement, command-clause exclusion, and extra exact duration detection.

The first DeepSeek live result was correctly rejected after replacing the
premises. The Targeted Retry result retained the daily one-hour commute saving,
but final evidence audit found that it did not retain the higher-rent direction
and introduced new exact test periods. This remains the final blocker.

## 4. TypeScript technical completeness

`TechnicalConceptComparisonRequirements` is attached to technical comparison
obligations. Review is semantic and does not use Case IDs, fixed sentence
order, fixed keyword order, or character-distance windows.

Recognized usage preconditions include narrowing/收窄, type guards, `typeof`,
`instanceof`, assertions, and validate-first wording. Technical Hard failures
are separated from Soft completeness warnings, and a substantive Hard-valid
candidate survives Soft-only retry exhaustion.

Final live result:

- Hard Validation: valid
- Substantive answer: yes
- Natural Fallback: false
- Soft warning: `technical_usage_advice_missing` (exactly one)
- Harness case result: PASS under the allowed situation-B threshold

## 5. Engine-owned execution accounting

`ResponseExecutionSource` now distinguishes Provider generation,
Engine-owned resolution, Engine-owned acknowledgement, Engine-owned Assistance
fallback, and Natural Fallback.

Final `context-ack-oh` evidence:

- source: `engine_owned_acknowledgement`
- attemptCount: 0
- Provider Request: 0
- commuting topic retained: yes
- greeting reset: no
- English Chunk: 0
- Natural Fallback: false
- case result: PASS

## 6. No-quota test evidence

The final post-fix gate was executed in full:

| Command | Final result |
|---|---|
| `npm install` | exit 0; dependencies already current |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run test` | exit 0; 408 passed, 9 live suites skipped |
| `npm run benchmark:eoe` | exit 0; 45 passed |
| `npm run benchmark:structure` | exit 0 |
| `npm run benchmark:naturalness` | exit 0; printed `DEPRECATED_ALIAS — use benchmark:structure` |
| `npm run replay:m2.3-live-failures` | exit 0; 51 passed |
| `npm run build` | exit 0 |
| `npm run test:e2e` | exit 0; 22/22 Desktop and 390×844 tests passed |

Mock E2E reported `Live requests=0`. Image Provider requests were 0. The
Benchmark-generated M2.5.1 historical report and Next.js-generated
`next-env.d.ts` were restored and are not part of the final changes.

An earlier full-test invocation exposed three premise-extraction regressions in
historical boundary fixtures. The extractor was narrowed to exclude requested
analysis subjects, regression tests were added, and the complete final gate
above was rerun successfully.

## 7. Targeted Live and the one allowed retry

Run:

- ID: `text-beta-rc-final-2026-07-17T07-39-36-727Z`
- mode: `live_probe`
- Ledger: `artifacts/benchmarks/text-beta-rc-final-budget.json`
- limits: 12 requests / 20,000 tokens / 900,000 ms
- image input: disabled

Initial three-case run:

- command exit: 1
- Provider requests: 4
- tokens: 7,096
- Provider runtime: 27,276 ms
- TypeScript: Hard-valid but three Soft warnings
- conditional tradeoff: automated PASS, later found to contain unguarded
  derived exact durations
- context acknowledgement: PASS with zero requests

The one allowed Targeted Retry was executed only for TypeScript and conditional
tradeoff. No retry was run for the Engine-owned acknowledgement.

Cumulative Ledger:

- Provider HTTP requests: 7/12
- tokens: 12,438/20,000
- Provider runtime: 50,387/900,000 ms
- pending attempts: 0
- image Provider requests: 0
- Natural Fallback: 0

The merged automated harness exited 0 and labeled the run
`M2_TEXT_BETA_RC_REVIEWABLE_WITH_ONE_TYPESCRIPT_SOFT_WARNING`. Final textual
evidence audit rejected that label because the conditional reply omitted the
higher-rent direction and added unsupported exact test periods.

## 8. Final three-case result

| Case | Final result | Evidence |
|---|---|---|
| `typescript-unknown-any` | PASS_WITH_ONE_SOFT_WARNING | Hard-valid, useful answer; one usage-advice Soft warning |
| `conditional-tradeoff` | FAIL | daily one-hour premise retained; higher-rent direction omitted; new exact `1–2周` and `第3周起` periods introduced |
| `context-ack-oh` | PASS | Engine-owned, 0 attempts, 0 requests, topic retained |

Usable results under the explicit product contract: 2/3.

## 9. UI and screenshots

No UI code was changed. Mock E2E passed on Desktop and 390×844 Mobile. Existing
screenshots were copied byte-for-byte into the final review package:

- `artifacts/human-review/text-beta-rc-final/screenshots/desktop.png`
- `artifacts/human-review/text-beta-rc-final/screenshots/mobile-390x844.png`

SHA-256 matches the two source screenshots. Both files were opened and visually
inspected. This engineering inspection does not preselect human visual PASS.

## 10. npm audit and security

`npm audit` was executed and exited 1:

- 2 moderate vulnerabilities
- affected dependency: `postcss`, transitively through `next`
- advisory: `GHSA-qx2v-qp2m-jg93`
- npm reports no fix available
- no `npm audit fix --force` was run

Security scan of this turn's documents, evidence, package, scripts, and harness
found:

- no API key or token values;
- no Bearer or Authorization values;
- no `.env.local` content;
- no private absolute path;
- no user-private data;
- no complete Provider Directive in evidence;
- no Base64 image payload;
- no `.git`, `node_modules`, cache, or temporary runtime file in the review
  package.

Only environment-variable names appear in source. `.env.local` remains ignored
and untracked.

## 11. Final handoff

- Final engineering status:
  `M2_TEXT_BETA_RC_FINAL_STOPPED_WITH_BLOCKERS`
- Targeted Retry: executed once; no further retry permitted
- Review package status: `PENDING_FINAL_INDEPENDENT_HUMAN_REVIEW`
- Review package contains the blocker and does not preselect PASS
- M3: BLOCKED
- Adaptive Progression: DISABLED
- Image feature: `DEFERRED_EXPERIMENTAL_FEATURE`
- Further automated repair phase: not created
