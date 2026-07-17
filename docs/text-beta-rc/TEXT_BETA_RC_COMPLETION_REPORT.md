# Text Beta RC Completion Report

Current status: `M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS`

This report records the completed Text Beta Release Candidate focused quality
calibration. It does not change frozen historical M2/M2.4/M2.5 results.

## Scope and authoritative input

- Both independent human review inputs were read completely before changes.
- Human naturalness and task-completion findings remained authoritative over
  prior Mock or automated PASS results.
- The work remained Text-First, fixed-level, and release-focused.
- No M3, Adaptive Progression, image restoration, UI redesign, push, deploy,
  remote creation, rebase, or squash occurred.

## Implemented calibration

- Automatic Live-Safe was reduced from 10 to 8:
  `I think`, `it depends`, `that makes sense`, `for example`, `for now`,
  `at the same time`, `in the long run`, and `sounds good`.
- `p-a-little` and `p-kind-of` remain in Registry/history/Assistance but are
  excluded from automatic selection. User-authored `a little` remains
  recognizable.
- Beta Bilingual Frame profiles and sentence-boundary validation block Chinese
  internal grammar-slot insertion and duplicate example markers.
- Hard-valid answer retention is separate from Soft Quality Review. Soft-only
  warnings can trigger one retry but cannot alone cause Natural Fallback.
- Technical identifiers are separated from Overlay, and TypeScript semantic
  review accepts multiple legal orderings and additional synonymous wording.
- Existing-history short acknowledgements use Engine-owned topic continuity,
  with no automatic English Chunk and no Provider dependency.
- Explicit English difficulty creates a temporary `reduced` preference without
  changing Fixed Level.
- Unsupported precise quantitative claims are deterministically detected and
  retried unless sourced or explicitly hypothetical.
- Detailed analysis uses named-factor, interaction, trade-off, and synthesis
  obligations.
- Pronunciation-only Assistance remains brief, omits automatic examples, and
  returns to the real prior topic.
- Developer diagnostics expose Soft warnings and temporary preference state;
  ordinary UI remains unchanged.

## Complete no-quota gate

All required commands were rerun after the controlled fix:

| Command | Exit | Executed result |
|---|---:|---|
| `npm install` | 0 | Up to date; audit summary reported 2 moderate vulnerabilities |
| `npm run lint` | 0 | ESLint passed |
| `npm run typecheck` | 0 | TypeScript passed |
| `npm run test` | 0 | 51 files passed, 8 skipped; 389 tests passed, 8 skipped |
| `npm run benchmark:eoe` | 0 | 45/45 passed |
| `npm run benchmark:structure` | 0 | 1/1 passed |
| `npm run benchmark:naturalness` | 0 | 1/1 passed and printed `DEPRECATED_ALIAS — use benchmark:structure` |
| `npm run replay:m2.3-live-failures` | 0 | 51/51 passed |
| `npm run build` | 0 | Next.js production build passed |
| `npm run test:e2e` | 0 | 22/22 Desktop and 390×844 Mobile passed; MockProvider; Live requests 0 |

The generated structural report was restored after benchmark execution so the
frozen historical artifact remained unchanged.

## Live Release Corpus

Run ID: `text-beta-rc-2026-07-17T06-39-53-143Z`

Execution mode: `live_corpus`

The initial 18-scenario run stopped at 14/18 usable results:

- English Chunks: 11
- `noFit`: 6
- Soft warnings: 6
- Natural Fallback: 1
- Provider requests: 24
- Tokens: 31,712
- Provider runtime: 96,083 ms

The single permitted Targeted Retry was used for:

- `typescript-unknown-any`
- `conditional-tradeoff`
- `concrete-example`
- `context-ack-oh`

The complete no-quota gate was rerun before this retry. No second repair cycle
or second targeted retry was started.

Final merged result:

- Release Corpus: 15/18
- English Chunk cases/count: 10/10
- `noFit`: 7
- Soft warnings: 8
- Natural Fallback: 0
- Provider requests: 28/50
- Tokens: 37,567/80,000
- Provider runtime: 109,935/2,700,000 ms
- Image Provider requests: 0

## Remaining blockers

1. `typescript-unknown-any`: the displayed response is substantive and explains
   `any` disabling checks and `unknown` requiring checking, but the Targeted
   Retry output does not explicitly cover narrowing/assertion, state that
   `unknown` is safer, or give practical usage advice. It remains a corpus
   failure; the substantive answer was not replaced by Natural Fallback.
2. `conditional-tradeoff`: the response labels its numbers as a hypothesis, so
   it does not violate the unsupported-number policy. It nevertheless replaces
   the user's actual one-hour commute premise with new assumptions and fails to
   preserve the requested concrete trade-off.
3. `context-ack-oh`: the Engine-owned final text preserves the actual commuting
   topic and uses no Natural Fallback. The Release Corpus harness still rejects
   it as `invalid_attempt_count:0`, even though Engine-owned contextual
   resolutions intentionally make zero Provider attempts. Under the executed
   gate this remains a failed scenario and is not reinterpreted as PASS.

`concrete-example` passed after the evaluator recognized the selected
`For example` Phrase as a valid example signal.

## Release status and review package

The final result maps to Situation C:
`M2_TEXT_BETA_RC_STOPPED_WITH_BLOCKERS`.

An independent human review package was not created because only Situation A
or B permits one. Independent Human Review remains blocked rather than
pre-filled.

## UI and screenshots

- Desktop Mock E2E:
  `artifacts/screenshots/m2.5-text-beta-desktop.png`
- 390×844 Mobile Mock E2E:
  `artifacts/screenshots/m2.5-text-beta-mobile-390x844.png`
- Chat-first UI, hidden Developer Panel, disabled image entry, lightweight
  English Chunk, and in-chat Assistance all passed the E2E gate.

## Security and repository state

- Thirteen current RC documentation/Live evidence files were scanned.
- API credential, Bearer value, Authorization value, private absolute path,
  personal email, mainland phone/ID, complete Directive, and embedded image
  Base64 matches: 0.
- `.env.local`: ignored and untracked.
- Git remotes: 0.
- Final listeners on 3100/3200/3201: 0.
- Image Provider requests: 0.
- `npm audit`: exit 1, 2 moderate `postcss`/`next` dependency findings, with no
  fix available in the reported dependency path. No force fix was run.

## Evidence locations

- Live budget ledger:
  `artifacts/benchmarks/text-beta-rc-live-budget.json`
- Full actual-text corpus report:
  `artifacts/benchmarks/text-beta-rc-release-corpus-report.md`
- Structured merged results:
  `artifacts/benchmarks/text-beta-rc-release-corpus-results.json`
- Acceptance synchronization:
  `docs/text-beta-rc/TEXT_BETA_RC_ACCEPTANCE_CRITERIA.md`

## Frozen boundaries

- M3: `BLOCKED`
- Adaptive Progression: `DISABLED`
- Image: `DEFERRED_EXPERIMENTAL_FEATURE`
- Historical 35/39 and 3/4 evidence: unchanged
- Next action: stop and wait for user direction; do not create another repair
  stage automatically.
