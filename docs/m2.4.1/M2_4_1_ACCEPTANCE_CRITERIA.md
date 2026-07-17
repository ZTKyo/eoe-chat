# M2.4.1 Acceptance Criteria

Status is synchronized from executed evidence only.

## Focused implementation

- [x] Image turns use validated Observation grounding and `disabled_for_image`.
  Evidence: Observation schema/parser, two-stage Engine path, persistence, missing-observation stop, and Mock image E2E tests pass.
- [x] Plan requirements are proportional and retry codes are exact.
  Evidence: weekly/today analyzer tests and exact `missing_*` Engine retry diagnostics pass.
- [x] Assistance source context and final structure are Engine-owned.
  Evidence: Context v2 resolves the stored source segment; Engine constructs source, Phrase, Registry pronunciation, meaning, optional example, and continuation segments.
- [x] Engine-owned Assistance fallback is usable and separately diagnosed.
  Evidence: two invalid Provider contents produce a valid Assistance response with `assistanceContentFallback=true`, `providerContentPass=false`, and no Natural Fallback.
- [x] Exact/variant user Phrase reuse is detected and respects exclusions.
  Evidence: exact, normalized variant, cooldown override, high-risk exclusion, and explicit-skip tests pass.
- [x] Validator strictness is preserved.
  Evidence: full Validator and historical replay suites pass; image completeness requires a validated Observation and a grounded final answer.

## Gates

- [x] All required no-quota commands exit 0.
  Evidence: the final controlled run passed install, lint, typecheck, 309 tests, all three benchmark commands, 51 historical replays, build, and 22 Mock E2E cases across Desktop and 390×844 Mobile.
- [ ] Focused Probe passes 7/7 without Natural Fallback.
- [ ] Core20, Opportunity12, Multi-Turn8, and Image4 execute after Probe PASS.
- [ ] Severe Task Completeness failures are zero.
- [x] Security scans pass and `.env.local` remains ignored/untracked.
  Evidence: 49 changed/new text files contain zero key-like secrets, Bearer values, Authorization values, private paths, full Directives, image bytes, or privacy patterns; `.env.local` is ignored and untracked; remote count is zero.

Focused Probe is intentionally unchecked: an E2E server lifecycle mistake allowed an unmetered real-provider run before the formal ledger started. Request/token totals cannot be reconstructed, so the bounded live gate was not executed and full corpora remain prohibited.

## Independent review

- [ ] Human-review package exists with actual inputs and final texts.
- [ ] Independent reviewer completes the checklist.

Codex must not pre-check independent-review items or declare naturalness PASS.
