# Text Beta RC Release Quality Scope

Status: `FOCUSED_QUALITY_CALIBRATION`

EOE Chat remains a text-first, fixed-level ordinary chat product. The English Overlay Engine may add a small optional English Chunk only after the user’s task, context, factual reliability, requested depth, and natural conversation quality are protected.

## Included

- Ordinary text chat, advice, explanation, comparison, planning, analysis, technical content, contextual acknowledgement, Chinese-only scope, user Phrase reuse, and explicit Vocabulary Assistance.
- Fixed Progression Level and per-turn Effective Level.
- Deterministic Hard Validation, Soft Quality Review, at most two generation attempts, and local diagnostics.
- Desktop, 390×844 mobile, PWA, IndexedDB, and existing Provider adapters.

## Excluded

- M3, Adaptive Progression, Mastery, automatic promotion or demotion.
- New image input and image release validation. Image remains `DEFERRED_EXPERIMENTAL_FEATURE` and disabled by default.
- UI redesign, learning dashboard, lessons, streaks, scores, courses, or English appearance quotas.
- Rewriting frozen M2/M2.4/M2.5 evidence or the historical 35/39 and 3/4 results.

## Release priority

1. Complete the user’s actual task.
2. Preserve conversation context.
3. Avoid unsupported facts and precise numbers.
4. Match the requested response depth.
5. Keep the response natural.
6. Only then use a sentence-boundary English Overlay if it genuinely fits.

`noFit` is a valid result. Fewer English Chunks are acceptable. Natural Fallback is reserved for Provider failure or repeated Hard failure, never for a Soft warning alone.

