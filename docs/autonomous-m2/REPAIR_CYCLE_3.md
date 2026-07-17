# Repair Cycle 3

Status: **FINAL_LIVE_CORPUS_FAIL — AUTONOMOUS STOP**

## Starting evidence

- Capability progression: historical 5/9 forced-position gate -> Cycle 1 position-neutral 3/6 -> Cycle 2 position-neutral 5/6.
- Only GLM-4.6V English capability remains failing.
- Exact codes: `template_boundary_invalid` on both attempts.
- Exact raw shape: the Provider repeatedly joins the selected action Phrase to a causative Chinese frame.
- Cumulative budget: 16 requests, 12,027 tokens, 48,312 ms Provider runtime.
- Replay: 21/21.

## New root cause

The Phrase Registry already contains per-Phrase bilingual patterns, but M2.3 currently sends only content, semantic tags, realization role, allowed positions, and punctuation restrictions. The missing selected-Phrase safe frame leaves the vision Provider to invent a cross-language grammatical frame, which it does incorrectly and repeats after retry.

## Final minimal repair

1. Convert only the selected Phrase's existing Registry `bilingualPatterns` into placeholder-based safe frames.
2. Pass those frames in the compact per-turn selected-Phrase state.
3. Tell the Provider to use them only as grammatical/punctuation structure, not as an answer to copy.
4. Reference the safe frames in the `template_boundary_invalid` retry correction.
5. Keep Parser, Mapper, Domain schema, Hard Validator, Naturalness gate, Provider order, and request budget unchanged.

## Results

### Implemented

- Only the selected Phrase's existing `bilingualPatterns` are converted from `{phrase}` to `{{EOE_PHRASE}}` safe frames.
- At most two frames are included in compact per-turn state; no complete Registry or Phrase ID is exposed.
- Frames are explicitly structural references, not canned answers.
- `template_boundary_invalid` retry guidance references the selected safe frame.
- Parser, Mapper, Domain schema, Hard Validator, Naturalness gate, Provider order, and budgets are unchanged.

### Full no-quota gate

- `npm install`: PASS; 2 existing moderate transitive audit findings remain, no force fix.
- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm run test`: PASS, 232 passed; 3 Live tests skipped and not counted as Live evidence.
- `npm run benchmark:eoe`: PASS, 45/45.
- `npm run benchmark:naturalness`: PASS, 45 scenarios.
- `npm run replay:m2.3-live-failures`: PASS, 21/21.
- `npm run build`: PASS.
- `npm run test:e2e`: PASS, 20/20 across Desktop Chromium and 390x844 Mobile.

### Final Live result

- Capability Probe: PASS, 6/6.
- Fallback Probe: PASS; controlled GLM retryable failure -> DeepSeek -> Template -> Validator -> Mapper -> Domain Response.
- Live Corpus: 19/20 (95.0%).
- Per-Provider valid final response rate: GLM-4.7 10/10 (100%); GLM-4.6V 1/1 (100%); DeepSeek 8/9 (88.9%).
- Blocker: DeepSeek `corpus-long-analysis` failed `template_boundary_invalid` on both attempts and used Natural Fallback, which was not counted as success.
- Final exact replay: 51/51.
- Cycle 3 delta: 30 requests, 27,969 tokens, 78,849 ms Provider runtime.
- Cumulative: 46/60 requests, 39,996/150,000 tokens, 127,161/5,400,000 ms Provider runtime.

The aggregate Corpus threshold was met exactly, but the explicit per-Provider 90% threshold was not. Three Repair Cycles are exhausted, so autonomous work stops without a fourth repair or additional Live request.
